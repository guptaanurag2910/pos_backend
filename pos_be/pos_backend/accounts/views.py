import logging
import secrets
from datetime import timedelta

from rest_framework import status, viewsets, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.db import transaction

from .serializers import (
    UserSerializer, CustomTokenObtainPairSerializer, ChangePasswordSerializer, 
    UserSessionSerializer, AuditLogSerializer, LogoutSerializer, RegistrationSerializer,
    RegistrationWithStoreSerializer, ForgotPasswordOTPRequestSerializer,
    ForgotPasswordOTPConfirmSerializer, CustomTokenRefreshSerializer
)
from .models import UserSession, AuditLog, PasswordResetOTP
from .permissions import IsAdminUser, IsManagerUser, IsOwnerOrAdmin
from .utils import get_client_ip, get_user_agent
from .throttles import LoginRateThrottle, ForgotPasswordRequestThrottle, ForgotPasswordVerifyThrottle

User = get_user_model()
logger = logging.getLogger('accounts')
GENERIC_FORGOT_PASSWORD_MESSAGE = "If the account exists, an OTP has been sent to the store recovery email."
INVALID_OR_EXPIRED_OTP_MESSAGE = "Invalid or expired OTP."


def _is_global_admin(user):
    return bool(
        getattr(user, 'is_superuser', False) or
        (getattr(user, 'role', None) == 'admin' and not getattr(user, 'store_id', None))
    )


class RegisterView(generics.CreateAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        logger.info(f"register_requested email={request.data.get('email')}")
        response = super().create(request, *args, **kwargs)
        logger.info(f"register_completed status={response.status_code} email={request.data.get('email')}")
        return response


class RegisterWithStoreView(generics.GenericAPIView):
    serializer_class = RegistrationWithStoreSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        logger.info(f"register_with_store_requested email={request.data.get('email')}")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)

        logger.info(f"register_with_store_completed user_id={user.id} email={user.email} store_id={user.store_id}")
        return Response(
            {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'user_id': user.id,
                    'email': user.email,
                    'name': user.name,
                    'role': user.role,
                    'store_id': user.store_id,
                },
                'store': {
                    'id': user.store_id,
                },
            },
            status=status.HTTP_201_CREATED
        )

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        logger.info(f"login_requested email={request.data.get('email')}")
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            user_id = response.data.get('user_id')
            user = User.objects.filter(id=user_id).first()
            if not user:
                logger.warning(
                    f"login_completed_missing_user email={request.data.get('email')} user_id={user_id}"
                )
                return response
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])
            
            # Create user session record
            UserSession.objects.create(
                user=user,
                session_key=response.data['refresh'],
                ip_address=get_client_ip(request),
                device_info=get_user_agent(request)
            )
            
            # Log login activity
            AuditLog.objects.create(
                user=user,
                action='login',
                ip_address=get_client_ip(request),
                details={'user_agent': get_user_agent(request)}
            )
            logger.info(f"login_completed user_id={user.id} email={user.email}")
        else:
            logger.warning(f"login_failed status={response.status_code} email={request.data.get('email')}")
        
        return response


class CustomTokenRefreshView(TokenRefreshView):
    serializer_class = CustomTokenRefreshSerializer

class LogoutView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = LogoutSerializer
    
    def post(self, request):
        actor = request.user if getattr(request, 'user', None) and request.user.is_authenticated else None
        try:
            logger.info(f"logout_requested user_id={getattr(actor, 'id', None)}")
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            refresh_token = serializer.validated_data['refresh_token']
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                # Token may already be blacklisted/expired; logout should remain idempotent.
                pass
            
            # Update user session
            session_qs = UserSession.objects.filter(
                session_key=refresh_token,
                is_active=True
            )
            if actor:
                session_qs = session_qs.filter(user=actor)
            session_qs.update(
                logout_time=timezone.now(),
                is_active=False
            )
            
            # Log logout activity
            if actor:
                AuditLog.objects.create(
                    user=actor,
                    action='logout',
                    ip_address=get_client_ip(request),
                    details={'user_agent': get_user_agent(request)}
                )
            
            logger.info(f"logout_completed user_id={getattr(actor, 'id', None)}")
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.warning(f"logout_failed_graceful user_id={getattr(actor, 'id', None)} error={str(e)}")
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)


class ForgotPasswordRequestOTPView(generics.GenericAPIView):
    serializer_class = ForgotPasswordOTPRequestSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ForgotPasswordRequestThrottle]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        logger.info(f"forgot_password_request_otp_requested email={email}")

        user = User.objects.filter(email__iexact=email, is_active=True).select_related('store').first()
        if not user or not user.store or not user.store.recovery_email:
            logger.info(f"forgot_password_request_otp_noop email={email} reason=no_user_or_store_or_recovery_email")
            return Response({"detail": GENERIC_FORGOT_PASSWORD_MESSAGE}, status=status.HTTP_200_OK)

        now = timezone.now()
        PasswordResetOTP.objects.filter(user=user, is_used=False, expires_at__gt=now).update(is_used=True)

        otp = f"{secrets.randbelow(1000000):06d}"
        otp_record = PasswordResetOTP.objects.create(
            user=user,
            otp_hash=make_password(otp),
            expires_at=now + timedelta(minutes=10),
        )

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@billsathi.local')
        subject = "BillSathi password reset OTP"
        message = (
            f"Your OTP for password reset is: {otp}\n\n"
            f"This OTP is valid for 10 minutes.\n"
            f"If you did not request this, please ignore this email."
        )
        sent = False
        try:
            send_mail(subject, message, from_email, [user.store.recovery_email], fail_silently=False)
            sent = True
        except Exception as exc:
            logger.warning(
                f"forgot_password_request_otp_email_failed email={email} recovery_email={user.store.recovery_email} error={exc}"
            )

        AuditLog.objects.create(
            user=user,
            action='other',
            model_name='PasswordResetOTP',
            object_id=str(otp_record.id),
            object_repr=f"Password reset OTP for {user.email}",
            ip_address=get_client_ip(request),
            details={
                'action': 'forgot_password_request_otp',
                'sent': sent,
            },
        )

        logger.info(
            f"forgot_password_request_otp_completed email={email} store_id={user.store_id} sent={sent}"
        )
        return Response({"detail": GENERIC_FORGOT_PASSWORD_MESSAGE}, status=status.HTTP_200_OK)


class ForgotPasswordConfirmOTPView(generics.GenericAPIView):
    serializer_class = ForgotPasswordOTPConfirmSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ForgotPasswordVerifyThrottle]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        otp = serializer.validated_data['otp']
        new_password = serializer.validated_data['new_password']
        logger.info(f"forgot_password_confirm_otp_requested email={email}")

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            logger.info(f"forgot_password_confirm_otp_failed email={email} reason=user_not_found")
            return Response({"detail": INVALID_OR_EXPIRED_OTP_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        otp_record = PasswordResetOTP.objects.filter(user=user, is_used=False).order_by('-created_at').first()
        now = timezone.now()
        if not otp_record:
            logger.info(f"forgot_password_confirm_otp_failed email={email} reason=otp_not_found")
            return Response({"detail": INVALID_OR_EXPIRED_OTP_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.expires_at <= now:
            otp_record.is_used = True
            otp_record.save(update_fields=['is_used', 'updated_at'])
            logger.info(f"forgot_password_confirm_otp_failed email={email} reason=otp_expired")
            return Response({"detail": INVALID_OR_EXPIRED_OTP_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.attempts >= otp_record.max_attempts:
            otp_record.is_used = True
            otp_record.save(update_fields=['is_used', 'updated_at'])
            logger.info(f"forgot_password_confirm_otp_failed email={email} reason=max_attempts_reached")
            return Response({"detail": INVALID_OR_EXPIRED_OTP_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        if not check_password(otp, otp_record.otp_hash):
            otp_record.attempts += 1
            if otp_record.attempts >= otp_record.max_attempts:
                otp_record.is_used = True
                otp_record.save(update_fields=['attempts', 'is_used', 'updated_at'])
            else:
                otp_record.save(update_fields=['attempts', 'updated_at'])
            logger.info(
                f"forgot_password_confirm_otp_failed email={email} reason=otp_mismatch attempts={otp_record.attempts}"
            )
            return Response({"detail": INVALID_OR_EXPIRED_OTP_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user.set_password(new_password)
            user.save(update_fields=['password'])

            otp_record.is_used = True
            otp_record.save(update_fields=['is_used', 'updated_at'])

            active_sessions = UserSession.objects.filter(user=user, is_active=True)
            session_count = active_sessions.count()
            for session in active_sessions:
                try:
                    token = RefreshToken(session.session_key)
                    token.blacklist()
                except Exception:
                    pass
            active_sessions.update(logout_time=now, is_active=False)

            AuditLog.objects.create(
                user=user,
                action='update',
                model_name='User',
                object_id=str(user.id),
                object_repr=str(user),
                ip_address=get_client_ip(request),
                details={
                    'action': 'forgot_password_confirm_otp',
                    'session_logout_count': session_count,
                },
            )

        logger.info(
            f"forgot_password_confirm_otp_completed email={email} user_id={user.id}"
        )
        return Response({"detail": "Password reset successfully."}, status=status.HTTP_200_OK)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        if self.action in ['create', 'reset_password', 'create_store_user']:
            permission_classes = [IsAdminUser]
        elif self.action in ['me', 'force_logout_sessions']:
            permission_classes = [IsAuthenticated]
        elif self.action in ['update', 'partial_update', 'destroy']:
            permission_classes = [IsOwnerOrAdmin]
        else:
            permission_classes = [IsAuthenticated, IsManagerUser]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        user = self.request.user
        if _is_global_admin(user):
            return User.objects.all()
        if user.role in ['admin', 'manager']:
            if user.store:
                return User.objects.filter(store=user.store)
            return User.objects.none()
        return User.objects.filter(id=user.id)
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsOwnerOrAdmin])
    def change_password(self, request, pk=None):
        user = self.get_object()
        logger.info(f"change_password_requested actor_id={request.user.id} target_id={user.id}")
        serializer = ChangePasswordSerializer(data=request.data)
        
        if serializer.is_valid():
            # Check old password
            if not user.check_password(serializer.data.get('old_password')):
                return Response({"old_password": ["Wrong password."]}, 
                               status=status.HTTP_400_BAD_REQUEST)
            
            # Set new password
            user.set_password(serializer.data.get('new_password'))
            user.save()
            
            # Log password change
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='User',
                object_id=str(user.id),
                object_repr=str(user),
                ip_address=get_client_ip(request),
                details={'action': 'password_change'}
            )
            
            logger.info(f"change_password_completed actor_id={request.user.id} target_id={user.id}")
            return Response({"detail": "Password updated successfully"}, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        logger.info(f"reset_password_requested actor_id={request.user.id} target_id={user.id}")
        new_password = request.data.get('new_password')
        if not new_password or len(new_password) < 8:
            return Response(
                {"detail": "new_password is required and must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save(update_fields=['password'])
        AuditLog.objects.create(
            user=request.user,
            action='update',
            model_name='User',
            object_id=str(user.id),
            object_repr=str(user),
            ip_address=get_client_ip(request),
            details={'action': 'admin_password_reset'}
        )
        logger.info(f"reset_password_completed actor_id={request.user.id} target_id={user.id}")
        return Response({"detail": "Password reset successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def force_logout_sessions(self, request, pk=None):
        target_user = self.get_object()
        logger.info(f"force_logout_requested actor_id={request.user.id} target_id={target_user.id}")
        if request.user.role != 'admin' and request.user.id != target_user.id:
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

        active_sessions = UserSession.objects.filter(user=target_user, is_active=True)
        count = active_sessions.count()

        with transaction.atomic():
            for session in active_sessions:
                try:
                    token = RefreshToken(session.session_key)
                    token.blacklist()
                except Exception:
                    pass
            active_sessions.update(logout_time=timezone.now(), is_active=False)

            AuditLog.objects.create(
                user=request.user,
                action='logout',
                model_name='UserSession',
                object_id=str(target_user.id),
                object_repr=str(target_user),
                ip_address=get_client_ip(request),
                details={'action': 'force_logout_sessions', 'count': count}
            )

        logger.info(f"force_logout_completed actor_id={request.user.id} target_id={target_user.id} count={count}")
        return Response({"detail": f"Logged out {count} active session(s)."}, status=status.HTTP_200_OK)
    
    def perform_create(self, serializer):
        with transaction.atomic():
            user = serializer.save()
            logger.info(f"user_create_completed actor_id={self.request.user.id} new_user_id={user.id}")
            
            # Log user creation
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='User',
                object_id=str(user.id),
                object_repr=str(user),
                ip_address=get_client_ip(self.request),
                details={'user_data': serializer.data}
            )
    
    def perform_update(self, serializer):
        with transaction.atomic():
            user = serializer.save()
            logger.info(f"user_update_completed actor_id={self.request.user.id} target_id={user.id}")
            
            # Log user update
            AuditLog.objects.create(
                user=self.request.user,
                action='update',
                model_name='User',
                object_id=str(user.id),
                object_repr=str(user),
                ip_address=get_client_ip(self.request),
                details={'user_data': serializer.data}
            )
    
    def perform_destroy(self, instance):
        with transaction.atomic():
            logger.info(f"user_soft_delete_requested actor_id={self.request.user.id} target_id={instance.id}")
            # Log user deletion
            AuditLog.objects.create(
                user=self.request.user,
                action='delete',
                model_name='User',
                object_id=str(instance.id),
                object_repr=str(instance),
                ip_address=get_client_ip(self.request)
            )
            
            # Instead of deleting, we deactivate the user
            instance.is_active = False
            instance.save()

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser], url_path='create-store-user')
    def create_store_user(self, request):
        actor = request.user
        logger.info(f"create_store_user_requested actor_id={actor.id} email={request.data.get('email')}")

        if not actor.store_id and not actor.is_superuser:
            return Response(
                {"detail": "Store admin must be associated with a store."},
                status=status.HTTP_400_BAD_REQUEST
            )

        role = request.data.get('role', 'cashier')
        if role not in ['admin', 'manager', 'cashier']:
            return Response(
                {"detail": "Invalid role. Allowed roles: admin, manager, cashier."},
                status=status.HTTP_400_BAD_REQUEST
            )

        generated_password = request.data.get('password') or (
            f"{get_random_string(4, allowed_chars='ABCDEFGHJKLMNPQRSTUVWXYZ')}"
            f"{get_random_string(4, allowed_chars='abcdefghijkmnopqrstuvwxyz')}"
            f"{get_random_string(4, allowed_chars='23456789')}"
            "!"
        )

        payload = {
            'name': request.data.get('name'),
            'email': request.data.get('email'),
            'role': role,
            'store': actor.store_id,
            'password': generated_password,
        }
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            user = serializer.save()
            AuditLog.objects.create(
                user=actor,
                action='create',
                model_name='User',
                object_id=str(user.id),
                object_repr=str(user),
                ip_address=get_client_ip(request),
                details={
                    'action': 'create_store_user',
                    'role': role,
                    'store_id': actor.store_id,
                    'credentials_generated': bool(not request.data.get('password')),
                }
            )

        logger.info(f"create_store_user_completed actor_id={actor.id} new_user_id={user.id} store_id={actor.store_id}")
        return Response(
            {
                'user': self.get_serializer(user).data,
                'credentials': {
                    'email': user.email,
                    'password': generated_password,
                }
            },
            status=status.HTTP_201_CREATED
        )

class UserSessionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSessionSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]
    
    def get_queryset(self):
        user = self.request.user
        if _is_global_admin(user):
            return UserSession.objects.all()
        if user.role in ['admin', 'manager'] and user.store:
            return UserSession.objects.filter(user__store=user.store)
        return UserSession.objects.filter(user=user)

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]
    filterset_fields = ['action', 'model_name', 'user']
    
    def get_queryset(self):
        user = self.request.user
        if _is_global_admin(user):
            return AuditLog.objects.all()
        if user.role in ['admin', 'manager'] and user.store:
            return AuditLog.objects.filter(user__store=user.store)
        return AuditLog.objects.filter(user=user)
