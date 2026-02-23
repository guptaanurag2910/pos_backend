from rest_framework import status, viewsets, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction

from .serializers import (
    UserSerializer, CustomTokenObtainPairSerializer, ChangePasswordSerializer, 
    UserSessionSerializer, AuditLogSerializer
)
from .models import UserSession, AuditLog
from .permissions import IsAdminUser, IsManagerUser, IsOwnerOrAdmin
from .utils import get_client_ip, get_user_agent

User = get_user_model()

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
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
        
        return response

class LogoutView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data['refresh_token']
            token = RefreshToken(refresh_token)
            token.blacklist()
            
            # Update user session
            UserSession.objects.filter(
                user=request.user, 
                session_key=refresh_token,
                is_active=True
            ).update(
                logout_time=timezone.now(),
                is_active=False
            )
            
            # Log logout activity
            AuditLog.objects.create(
                user=request.user,
                action='logout',
                ip_address=get_client_ip(request),
                details={'user_agent': get_user_agent(request)}
            )
            
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        if self.action == 'create':
            permission_classes = [IsAdminUser]
        elif self.action in ['update', 'partial_update', 'destroy']:
            permission_classes = [IsOwnerOrAdmin]
        else:
            permission_classes = [IsAuthenticated, IsManagerUser]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return User.objects.all()
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
            
            return Response({"detail": "Password updated successfully"}, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def perform_create(self, serializer):
        with transaction.atomic():
            user = serializer.save()
            
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