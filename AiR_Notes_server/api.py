from django.contrib.auth import authenticate
from ninja import ModelSchema, NinjaAPI, Swagger
from ninja.security import HttpBearer
from ninja.throttling import AnonRateThrottle, AuthRateThrottle

from notes.api import note_router, qrcode_router
from users.api import router as user_router
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


api = NinjaAPI(
    auth=TokenAuth(),
    throttle=[
        AnonRateThrottle("10/s"),
        AuthRateThrottle("100/s"),
    ],
    docs=Swagger(settings={"persistAuthorization": True}),
    title="AiR Notes API",
)


class AuthenticateResponseSchema(ModelSchema):
    class Meta:
        model = Token
        fields = ["key", "expires_at", "user"]


@api.post(
    "/authenticate",
    auth=None,
    response={200: AuthenticateResponseSchema, 401: dict},
    tags=["Auth"],
)
def get_api_token(request, username: str, password: str):
    # Verify Django User credentials
    user = authenticate(username=username, password=password)

    if not user:
        return 401, {"detail": "Invalid username or password"}

    # Create a fresh database token for this device session
    token_obj = Token.objects.create(user=user)

    return 200, token_obj


api.add_router("/users", user_router, tags=["Users"])
api.add_router("/notes", qrcode_router, tags=["QRCodes"])
api.add_router("/notes", note_router, tags=["Notes"])
