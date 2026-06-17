from django.contrib.auth import authenticate
from ninja import ModelSchema, NinjaAPI, Swagger
from ninja.throttling import AnonRateThrottle, AuthRateThrottle

from AiR_Notes_server.api_auth import default_auth
from notes.api import note_router, qrcode_router
from users.api import router as user_router
from users.models import Token

api = NinjaAPI(
    auth=default_auth,
    throttle=[
        AnonRateThrottle("10/s"),
        AuthRateThrottle("100/s"),
    ],
    docs=Swagger(
        settings={
            "persistAuthorization": True,
            "displayRequestDuration": True,
            "tryItOutEnabled": True,
        }
    ),
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
