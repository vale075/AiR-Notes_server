from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from ninja import ModelSchema, Router, Schema

router = Router()


class BasicUserSchema(ModelSchema):
    class Meta:
        model = User
        fields = ["id", "username"]


class UserSchema(ModelSchema):
    class Meta:
        model = User
        fields = ["id", "username", "date_joined", "is_superuser"]


class UserUpdateIn(Schema):
    username: str | None = None
    password: str | None = None


@router.post("", auth=None, response={200: dict, 400: dict})
def create_user(request, username: str, password: str):
    if User.objects.filter(username=username).exists():
        return 400, {"detail": "Username is already taken."}

    User.objects.create_user(username=username, password=password)

    return {"detail": "Account successfully created!"}


@router.get("", auth=None, response={200: list[BasicUserSchema], 400: dict})
def get_all_users(request):
    return User.objects.all()


@router.get("{user_id}", response={200: UserSchema, 403: dict})
def get_user(request, user_id: int):
    if not (request.auth.is_superuser or request.auth.id == user_id):
        return 403, {"detail": "You need to be an admin or the owner of the account."}

    return get_object_or_404(User, id=user_id)


@router.delete("{user_id}", response={200: dict, 403: dict})
def delete_user(request, user_id: int):
    if not (request.auth.is_superuser or request.auth.id == user_id):
        return 403, {"detail": "You need to be an admin or the owner of the account."}

    get_object_or_404(User, id=user_id).delete()
    return {"detail": "Account successfully deleted."}


@router.put("{user_id}", response={200: dict, 400: dict, 403: dict})
def update_user(request, user_id: int, payload: UserUpdateIn):
    if not (request.auth.is_superuser or request.auth.id == user_id):
        return 403, {"detail": "You need to be an admin or the owner of the account."}

    employee = get_object_or_404(User, id=user_id)
    fields = payload.dict(exclude_unset=True)
    if "username" in fields:
        existing_user = User.objects.get(username=fields["username"])
        if existing_user.exists() and existing_user.first().id != user_id:
            return 400, {"detail": "The username is already taken"}

    for attr, value in fields.items():
        setattr(employee, attr, value)
    employee.save()
    return {"detail": "Account successfully updated."}
