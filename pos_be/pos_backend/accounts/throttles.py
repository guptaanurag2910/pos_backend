from rest_framework.throttling import SimpleRateThrottle


class LoginRateThrottle(SimpleRateThrottle):
    scope = 'login'
    rate = '10/min'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        email = (request.data.get('email') or '').strip().lower()
        return self.cache_format % {
            'scope': self.scope,
            'ident': f'{ident}:{email or "anonymous"}',
        }


class ForgotPasswordRequestThrottle(SimpleRateThrottle):
    scope = 'forgot_password_request'
    rate = '5/min'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        email = (request.data.get('email') or '').strip().lower()
        return self.cache_format % {
            'scope': self.scope,
            'ident': f'{ident}:{email or "anonymous"}',
        }


class ForgotPasswordVerifyThrottle(SimpleRateThrottle):
    scope = 'forgot_password_verify'
    rate = '10/min'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        email = (request.data.get('email') or '').strip().lower()
        return self.cache_format % {
            'scope': self.scope,
            'ident': f'{ident}:{email or "anonymous"}',
        }
