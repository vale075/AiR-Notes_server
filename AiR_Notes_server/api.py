from datetime import datetime

from django.contrib.auth import authenticate
from ninja import NinjaAPI, Schema
from ninja.security import HttpBearer
from ninja.throttling import AnonRateThrottle, AuthRateThrottle

from notes.api import router as notes_router
from users.api import router as users_router
from users.models import Token


class TokenAuth(HttpBearer):
    def authenticate(self, request, token):
        if not token:
            return
        try:
            # Look up the token in the database
            db_token = Token.objects.select_related("user").get(key=token)

            # Check if the token has expired
            if db_token.is_expired:
                db_token.delete()  # Clean up expired token
                return None

            # Return the user object. Django Ninja will attach this to request.auth
            return db_token.user

        except Token.DoesNotExist:
            return None


api = NinjaAPI(
    auth=TokenAuth(),
    throttle=[
        AnonRateThrottle("10/s"),
        AuthRateThrottle("100/s"),
    ],
)


class AuthenticateResponseSchema(Schema):
    key: str
    expires_at: datetime


@api.post(
    "/authenticate", auth=None, response={200: AuthenticateResponseSchema, 401: dict}
)
def get_api_token(request, username: str, password: str):
    # Verify Django User credentials
    user = authenticate(username=username, password=password)

    if not user:
        return 401, {"detail": "Invalid username or password"}

    # Create a fresh database token for this device session
    token_obj = Token.objects.create(user=user)

    return 200, token_obj


api.add_router("/users", users_router, tags=["Users"])
api.add_router("/notes", notes_router)
