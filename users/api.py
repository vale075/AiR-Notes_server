from typing import List, Optional

from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from ninja import ModelSchema, Router, Schema

router = Router()


class BasicUserSchema(ModelSchema):
    class Meta:
        model = User
        fields = ["username"]


class UserSchema(ModelSchema):
    class Meta:
        model = User
        fields = ["username", "date_joined", "is_superuser"]


class UserUpdateIn(Schema):
    username: Optional[str] = None
    password: Optional[str] = None


@router.post("", auth=None, response={200: dict, 400: dict})
def create_user(request, username: str, password: str):
    if User.objects.filter(username=username).exists():
        return 400, {"detail": "Username is already taken."}

    User.objects.create_user(username=username, password=password)

    return {"detail": "Account successfully created!"}


@router.get("", auth=None, response={200: List[BasicUserSchema], 400: dict})
def get_all_users(request):
    return User.objects.all()


@router.get("{username}", response={200: UserSchema, 403: dict})
def get_user(request, username: str):
    if not (request.auth.is_superuser or request.auth.username == username):
        return 403, {"detail": "You need to be an admin or the owner of the account."}

    return get_object_or_404(User, username=username)


@router.delete("{username}", response={200: dict, 403: dict})
def delete_user(request, username: str):
    if not (request.auth.is_superuser or request.auth.username == username):
        return 403, {"detail": "You need to be an admin or the owner of the account."}

    get_object_or_404(User, username=username).delete()
    return {"detail": "Account successfully deleted."}


@router.put("{username}", response={200: dict, 403: dict})
def update_user(request, username: str, payload: UserUpdateIn):
    if not (request.auth.is_superuser or request.auth.username == username):
        return 403, {"detail": "You need to be an admin or the owner of the account."}

    employee = get_object_or_404(User, username=username)
    for attr, value in payload.dict(exclude_unset=True).items():
        setattr(employee, attr, value)
    employee.save()
    return {"detail": "Account successfully updated."}
