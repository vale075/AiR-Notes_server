from django.contrib.auth.models import AnonymousUser
from ninja.security import HttpBearer, SessionAuth

from users.models import Token


class TokenAuth(HttpBearer):
    def authenticate(self, request, token):
        if not token:
            return None

        try:
            # Look up the token in the database
            db_token = Token.objects.select_related("user").get(key=token)
        except Token.DoesNotExist:
            return None
        else:
            # Check if the token has expired
            if db_token.is_expired:
                db_token.delete()  # Clean up expired token
                return None

            # Return the user object. Django Ninja will attach this to request.auth
            return db_token.user


def anonymous_auth(request):
    return AnonymousUser()


default_auth = [TokenAuth(), SessionAuth()]
guest_allowed_auth = [*default_auth, anonymous_auth]
