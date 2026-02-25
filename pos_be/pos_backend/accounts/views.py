import logging

from rest_framework import status, viewsets, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.db import transaction

from .serializers import (
    UserSerializer, CustomTokenObtainPairSerializer, ChangePasswordSerializer, 
    UserSessionSerializer, AuditLogSerializer, LogoutSerializer, RegistrationSerializer,
    RegistrationWithStoreSerializer
)
from .models import UserSession, AuditLog
from .permissions import IsAdminUser, IsManagerUser, IsOwnerOrAdmin
from .utils import get_client_ip, get_user_agent
from .throttles import LoginRateThrottle

User = get_user_model()
logger = logging.getLogger('accounts')


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
            user = User.objects.get(email=request.data['email'])
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
            if actor:
                UserSession.objects.filter(
                    user=actor,
                    session_key=refresh_token,
                    is_active=True
                ).update(
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

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        if self.action == 'create':
            permission_classes = [IsAdminUser]
        elif self.action in ['reset_password']:
            permission_classes = [IsAdminUser]
        elif self.action in ['update', 'partial_update', 'destroy']:
            permission_classes = [IsOwnerOrAdmin]
        elif self.action in ['force_logout_sessions']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAuthenticated, IsManagerUser]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return User.objects.filter(store=user.store) if user.store else User.objects.none()
        elif user.role == 'manager':
            return User.objects.filter(store=user.store)
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
        if user.role == 'admin':
            return UserSession.objects.all()
        elif user.role == 'manager':
            return UserSession.objects.filter(user__store=user.store)
        return UserSession.objects.filter(user=user)

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]
    filterset_fields = ['action', 'model_name', 'user']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return AuditLog.objects.all()
        elif user.role == 'manager':
            return AuditLog.objects.filter(user__store=user.store)
        return AuditLog.objects.filter(user=user)
