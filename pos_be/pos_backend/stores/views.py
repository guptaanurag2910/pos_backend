from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from .models import Store, StoreSettings
from .serializers import StoreSerializer, StoreSettingsSerializer
from accounts.permissions import IsAdminUser, IsManagerUser
from accounts.models import AuditLog
from accounts.utils import get_client_ip

class StoreViewSet(viewsets.ModelViewSet):
    queryset = Store.objects.all()
    serializer_class = StoreSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdminUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Store.objects.all()
        elif user.store:
            return Store.objects.filter(id=user.store.id)
        return Store.objects.none()
    
    @action(detail=True, methods=['get', 'put', 'patch'])
    def settings(self, request, pk=None):
        store = self.get_object()
        
        # Get or create settings object
        settings, created = StoreSettings.objects.get_or_create(store=store)
        
        if request.method == 'GET':
            serializer = StoreSettingsSerializer(settings)
            return Response(serializer.data)
        
        serializer = StoreSettingsSerializer(settings, data=request.data, partial=request.method == 'PATCH')
        if serializer.is_valid():
            with transaction.atomic():
                serializer.save(updated_by=request.user)
                
                # Log the action
                AuditLog.objects.create(
                    user=request.user,
                    action='update',
                    model_name='StoreSettings',
                    object_id=str(settings.id),
                    object_repr=f"{store.name} Settings",
                    ip_address=get_client_ip(request)
                )
                
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def perform_create(self, serializer):
        with transaction.atomic():
            store = serializer.save()
            
            # Create default settings
            StoreSettings.objects.create(store=store, updated_by=self.request.user)
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='create',
                model_name='Store',
                object_id=str(store.id),
                object_repr=store.name,
                ip_address=get_client_ip(self.request)
            )
    
    def perform_update(self, serializer):
        with transaction.atomic():
            store = serializer.save()
            
            # Log the action
            AuditLog.objects.create(
                user=self.request.user,
                action='update',
                model_name='Store',
                object_id=str(store.id),
                object_repr=store.name,
                ip_address=get_client_ip(self.request)
            )