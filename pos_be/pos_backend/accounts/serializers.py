from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import UserSession, AuditLog

User = get_user_model()

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

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'role', 'store', 'is_active', 
                  'date_joined', 'last_login', 'password')
        read_only_fields = ('id', 'date_joined', 'last_login')
        extra_kwargs = {'password': {'write_only': True}}
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
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
