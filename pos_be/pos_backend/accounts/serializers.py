from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from stores.models import Store
from stores.serializers import StoreSerializer
from .models import UserSession, AuditLog

User = get_user_model()


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('email', 'name', 'password')

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        default_store = Store.objects.filter(is_main=True, is_active=True).first()
        if not default_store:
            default_store = Store.objects.filter(is_active=True).order_by('id').first()
        if not default_store:
            raise serializers.ValidationError("No active store available. Create a store first.")

        return User.objects.create_user(
            email=validated_data['email'],
            name=validated_data['name'],
            password=validated_data['password'],
            role='admin',
            is_staff=True,
            is_active=True,
            store=default_store,
        )


class RegistrationWithStoreSerializer(serializers.Serializer):
    email = serializers.EmailField()
    name = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, min_length=8)
    store = serializers.DictField()

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs):
        store_data = dict(attrs.get('store') or {})
        # Default store contact email to owner email when not provided.
        if not store_data.get('email'):
            store_data['email'] = attrs.get('email')
        if store_data.get('recovery_email'):
            store_data['recovery_email'] = str(store_data['recovery_email']).strip().lower()
        if not store_data.get('recovery_email'):
            raise serializers.ValidationError({'store': {'recovery_email': ['Recovery email is required.']}})

        # Keep only one main store globally; auto-demote on conflict.
        if Store.objects.filter(is_main=True).exists():
            store_data['is_main'] = False

        store_data.setdefault('is_active', True)

        # Validate normalized store payload using StoreSerializer.
        store_serializer = StoreSerializer(data=store_data)
        store_serializer.is_valid(raise_exception=True)

        attrs['_validated_store'] = store_serializer.validated_data
        attrs['store'] = store_data
        return attrs

    def create(self, validated_data):
        validated_store_data = validated_data.pop('_validated_store', None)
        validated_data.pop('store', None)
        store = Store.objects.create(**(validated_store_data or {}))
        user = User.objects.create_user(
            email=validated_data['email'],
            name=validated_data['name'],
            password=validated_data['password'],
            role='admin',
            is_staff=True,
            is_active=True,
            store=store,
        )
        from stores.models import StoreSettings
        StoreSettings.objects.create(store=store, updated_by=user)
        return user

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add custom claims
        data.update({
            'user_id': self.user.id,
            'email': self.user.email,
            'name': self.user.name,
            'role': self.user.role,
            'store_id': self.user.store.id if self.user.store else None,
        })
        
        return data


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Refresh token validation with server-side active-session enforcement.
    This ensures logout can immediately invalidate refresh tokens even when
    SimpleJWT blacklist backend is unavailable.
    """

    def validate(self, attrs):
        refresh_token = attrs.get('refresh')
        try:
            decoded = RefreshToken(refresh_token)
            user_id = decoded.get('user_id')
        except Exception:
            raise InvalidToken("Token is invalid or expired.")

        active_session = UserSession.objects.filter(
            user_id=user_id,
            session_key=refresh_token,
            is_active=True,
        ).first()
        if not active_session:
            raise InvalidToken("Session is no longer active. Please login again.")

        data = super().validate(attrs)
        new_refresh = data.get('refresh')

        # Track refresh-token rotation in UserSession so old tokens cannot be reused.
        if new_refresh and new_refresh != refresh_token:
            now = timezone.now()
            active_session.is_active = False
            active_session.logout_time = now
            active_session.save(update_fields=['is_active', 'logout_time'])
            UserSession.objects.create(
                user_id=user_id,
                session_key=new_refresh,
                ip_address=active_session.ip_address,
                device_info=active_session.device_info,
            )

        return data

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'role', 'store', 'is_active', 
                  'date_joined', 'last_login', 'password')
        read_only_fields = ('id', 'date_joined', 'last_login')
        extra_kwargs = {'password': {'write_only': True}}

    def validate(self, attrs):
        request = self.context.get('request')
        actor = getattr(request, 'user', None)

        # Enforce one-store-per-user.
        store = attrs.get('store', None)
        if self.instance is None:
            if store is None:
                raise serializers.ValidationError({'store': 'Store is required for every user.'})
        else:
            if 'store' in attrs and attrs['store'] is None:
                raise serializers.ValidationError({'store': 'Store cannot be null.'})
            if self.instance.store is None and 'store' not in attrs:
                raise serializers.ValidationError({'store': 'Store is required for every user.'})

        # Store admins can only create/update users within their own store.
        if actor and actor.is_authenticated and actor.role == 'admin':
            if not actor.store:
                raise serializers.ValidationError({'store': 'Admin user must be associated with a store.'})

            target_store = attrs.get('store', getattr(self.instance, 'store', None))
            if target_store is None:
                raise serializers.ValidationError({'store': 'Store is required.'})
            if target_store.id != actor.store_id:
                raise serializers.ValidationError({'store': 'You can only assign users to your own store.'})
        return attrs
    
    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            raise serializers.ValidationError({'password': 'Password is required.'})
        user.save()
        return user
    
    def update(self, instance, validated_data):
        if 'password' in validated_data:
            password = validated_data.pop('password')
            instance.set_password(password)
        return super().update(instance, validated_data)

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
    
    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        return value


class ForgotPasswordOTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        return value.strip().lower()


class ForgotPasswordOTPConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    otp = serializers.CharField(required=True, min_length=6, max_length=6)
    new_password = serializers.CharField(required=True, min_length=8)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_otp(self, value):
        otp = value.strip()
        if not otp.isdigit():
            raise serializers.ValidationError("OTP must be a 6-digit number.")
        return otp


class LogoutSerializer(serializers.Serializer):
    refresh_token = serializers.CharField(required=True)


class UserSessionSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    
    class Meta:
        model = UserSession
        fields = ('id', 'user', 'login_time', 'logout_time', 'is_active', 'ip_address', 'device_info')
        read_only_fields = fields

class AuditLogSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    
    class Meta:
        model = AuditLog
        fields = ('id', 'user', 'action', 'model_name', 'object_id', 'object_repr', 'action_time', 'ip_address', 'details')
        read_only_fields = fields
