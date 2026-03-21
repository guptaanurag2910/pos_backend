from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView,
    LogoutView,
    UserViewSet,
    UserSessionViewSet,
    AuditLogViewSet,
    RegisterView,
    RegisterWithStoreView,
    ForgotPasswordRequestOTPView,
    ForgotPasswordConfirmOTPView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'sessions', UserSessionViewSet, basename='session')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('', include(router.urls)),
    path('register/', RegisterView.as_view(), name='register'),
    path('register-with-store/', RegisterWithStoreView.as_view(), name='register_with_store'),
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('password-reset/request-otp/', ForgotPasswordRequestOTPView.as_view(), name='password_reset_request_otp'),
    path('password-reset/confirm-otp/', ForgotPasswordConfirmOTPView.as_view(), name='password_reset_confirm_otp'),
]
