from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.db import transaction

from .models import Store, StoreSettings
from .serializers import StoreSerializer, StoreSettingsSerializer, StoreBootstrapImportSerializer
from .bootstrap_import import StoreBootstrapImporter
from accounts.permissions import IsAdminUser, IsManagerUser
from accounts.models import AuditLog
from accounts.utils import get_client_ip

class StoreViewSet(viewsets.ModelViewSet):
    queryset = Store.objects.all()
    serializer_class = StoreSerializer
    permission_classes = [IsAuthenticated, IsManagerUser]
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'activate', 'deactivate', 'set_main', 'bootstrap_import']:
            permission_classes = [IsAdminUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_parsers(self):
        if self.action == 'bootstrap_import':
            return [MultiPartParser(), FormParser()]
        return super().get_parsers()
    
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

    @action(detail=False, methods=['get'])
    def active(self, request):
        queryset = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        store = self.get_object()
        store.is_active = True
        store.save(update_fields=['is_active', 'updated_at'])
        AuditLog.objects.create(
            user=request.user,
            action='update',
            model_name='Store',
            object_id=str(store.id),
            object_repr=store.name,
            ip_address=get_client_ip(request),
            details={'action': 'activate'}
        )
        return Response(self.get_serializer(store).data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        store = self.get_object()
        store.is_active = False
        store.save(update_fields=['is_active', 'updated_at'])
        AuditLog.objects.create(
            user=request.user,
            action='update',
            model_name='Store',
            object_id=str(store.id),
            object_repr=store.name,
            ip_address=get_client_ip(request),
            details={'action': 'deactivate'}
        )
        return Response(self.get_serializer(store).data)

    @action(detail=True, methods=['post'])
    def set_main(self, request, pk=None):
        store = self.get_object()
        with transaction.atomic():
            Store.objects.exclude(id=store.id).update(is_main=False)
            store.is_main = True
            store.save(update_fields=['is_main', 'updated_at'])
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='Store',
                object_id=str(store.id),
                object_repr=store.name,
                ip_address=get_client_ip(request),
                details={'action': 'set_main'}
            )
        return Response(self.get_serializer(store).data)

    @action(detail=True, methods=['post'], url_path='bootstrap-import')
    def bootstrap_import(self, request, pk=None):
        store = self.get_object()
        serializer = StoreBootstrapImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        importer = StoreBootstrapImporter(
            store=store,
            user=request.user,
            strict=serializer.validated_data.get('strict', True),
        )

        try:
            result = importer.run(serializer.validated_data['file'])
        except Exception as exc:  # noqa: BLE001
            return Response(
                {'detail': str(exc), 'errors': importer.errors, 'stats': importer.stats},
                status=status.HTTP_400_BAD_REQUEST
            )

        AuditLog.objects.create(
            user=request.user,
            action='create',
            model_name='StoreBootstrapImport',
            object_id=str(store.id),
            object_repr=store.name,
            ip_address=get_client_ip(request),
            details={
                'action': 'bootstrap_import',
                'strict': result.get('strict_mode'),
                'stats': result.get('stats'),
                'error_count': len(result.get('errors', [])),
            }
        )

        http_status = status.HTTP_207_MULTI_STATUS if result.get('errors') else status.HTTP_200_OK
        return Response(result, status=http_status)
    
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

    def perform_destroy(self, instance):
        # Soft delete for safer production operations
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])
        AuditLog.objects.create(
            user=self.request.user,
            action='update',
            model_name='Store',
            object_id=str(instance.id),
            object_repr=instance.name,
            ip_address=get_client_ip(self.request),
            details={'action': 'soft_delete'}
        )
