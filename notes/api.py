from enum import Enum
from uuid import UUID  # noqa: TC003

from django.shortcuts import get_object_or_404
from ninja import File, ModelSchema, Router, UploadedFile

from AiR_Notes_server.api_auth import guest_allowed_auth
from notes.models import ArrowNote, ImageNote, Note, QRCode, TextNote

qrcode_router = Router()


QRCodeShareEnum = Enum(
    "QRCodeShareEnum",
    {choice.name: choice.value for choice in QRCode.QRCodeShareChoices},
    type=str,
)


class QRCodeIn(ModelSchema):
    share_status: QRCodeShareEnum | None = None

    class Meta:
        model = QRCode
        fields = ["name", "owner"]
        fields_optional = "__all__"


class QRCodeOut(ModelSchema):
    share_status: QRCodeShareEnum

    class Meta:
        model = QRCode
        fields = ["id", "name", "owner", "created_at"]


@qrcode_router.post("qrcode", response={200: QRCodeOut, 403: dict})
def create_qrcode(request, payload: QRCodeIn):
    fields = payload.dict(exclude_unset=True)

    if "owner_id" in fields:
        if not (request.auth.is_superuser or fields["owner_id"] == request.auth.id):
            return 403, {
                "detail": "You are not allowed to create a qrcode for this user."
            }
    else:
        fields["owner_id"] = request.auth.id
    return QRCode.objects.create(**fields)


@qrcode_router.get("qrcode", response={200: list[QRCodeOut], 403: dict})
def get_user_qrcodes(request, user_id: int | None = None):
    if user_id is None:
        return request.auth.QRcodes.all()

    if request.auth.is_superuser or user_id == request.auth.id:
        return QRCode.objects.filter(owner=user_id)

    return 403, {
        "detail": "You do not have the necessary permissions to view this user's QRCodes."
    }


@qrcode_router.get("qrcode/all", response={200: list[QRCodeOut], 403: dict})
def get_all_qrcodes(request):
    if not request.auth.is_superuser:
        return 403, {"detail": "You need to be an admin to get all QR codes."}

    return QRCode.objects.all()


@qrcode_router.get(
    "qrcode/{qr_id}", auth=guest_allowed_auth, response={200: QRCodeOut, 403: dict}
)
def get_qrcode(request, qr_id: str):
    qrcode = get_object_or_404(QRCode, id=qr_id)

    if not qrcode.is_allowed(request.auth, edit=False):
        return 403, {"detail": "You do not have the necessary permissions to view."}

    return qrcode


@qrcode_router.put(
    "qrcode/{qr_id}", auth=guest_allowed_auth, response={200: QRCodeOut, 403: dict}
)
def edit_qrcode(request, qr_id: str, payload: QRCodeIn):
    qrcode = get_object_or_404(QRCode, id=qr_id)

    if not qrcode.is_allowed(request.auth, edit=True):
        return 403, {"detail": "You do not have the necessary permissions to edit."}

    for attr, value in payload.dict(exclude_unset=True).items():
        setattr(qrcode, attr, value)
    qrcode.save()

    return qrcode


@qrcode_router.get(
    "qrcode/{qr_id}/notes",
    auth=guest_allowed_auth,
    response={200: list, 403: dict},
)
def get_qrcode_notes(request, qr_id: str):
    qrcode = get_object_or_404(QRCode, id=qr_id)

    if not qrcode.is_allowed(request.auth, edit=False):
        return 403, {"detail": "You do not have the necessary permissions to view."}

    return [serialize_note(note) for note in qrcode.notes.all()]


note_router = Router()


# Output Schemas
class TextNoteOut(ModelSchema):
    qrcode_id: UUID

    class Meta:
        model = TextNote
        fields = "__all__"
        exclude = ["note_ptr", "qrcode"]


class ImageNoteOut(ModelSchema):
    qrcode_id: UUID
    image: str

    class Meta:
        model = ImageNote
        fields = "__all__"
        exclude = ["note_ptr", "qrcode"]


class ArrowNoteOut(ModelSchema):
    qrcode_id: UUID

    class Meta:
        model = ArrowNote
        fields = "__all__"
        exclude = ["note_ptr", "qrcode"]


# Input Schemas
class TextNoteBaseIn(ModelSchema):
    class Meta:
        model = TextNote
        exclude = ["note_ptr", "qrcode", "id", "note_type", "created_at", "updated_at"]
        fields_optional = "__all__"


class TextNoteIn(TextNoteBaseIn):
    qrcode_id: UUID


class TextNoteUpdateIn(TextNoteBaseIn):
    qrcode_id: UUID | None = None


class ImageNoteBaseIn(ModelSchema):
    class Meta:
        model = ImageNote
        exclude = [
            "note_ptr",
            "qrcode",
            "id",
            "note_type",
            "image",
            "created_at",
            "updated_at",
        ]
        fields_optional = "__all__"


class ImageNoteIn(ImageNoteBaseIn):
    qrcode_id: UUID


class ImageNoteUpdateIn(ImageNoteBaseIn):
    qrcode_id: UUID | None = None


class ArrowNoteBaseIn(ModelSchema):
    class Meta:
        model = ArrowNote
        exclude = ["note_ptr", "qrcode", "id", "note_type", "created_at", "updated_at"]
        fields_optional = "__all__"


class ArrowNoteIn(ArrowNoteBaseIn):
    qrcode_id: UUID  # Mandatory for POST


class ArrowNoteUpdateIn(ArrowNoteBaseIn):
    qrcode_id: UUID | None = None  # Optional for PUT


# Helper functions to convert ORM models to typed Ninja schemas
def serialize_note(note: Note):
    if hasattr(note, "textnote"):
        return TextNoteOut.from_orm(note.textnote)

    if hasattr(note, "imagenote"):
        img_note = note.imagenote
        # 1. Build the dictionary schema using Pydantic's from_orm/model_validate
        data = ImageNoteOut.from_orm(img_note).dict()
        # 2. Overwrite the file object with its actual string URL path
        data["image"] = img_note.image.url if img_note.image else ""
        return ImageNoteOut(**data)

    if hasattr(note, "arrownote"):
        return ArrowNoteOut.from_orm(note.arrownote)

    return note


@note_router.post(
    "notes/text", auth=guest_allowed_auth, response={200: TextNoteOut, 403: dict}
)
def create_text_note(request, payload: TextNoteIn):
    qrcode = get_object_or_404(QRCode, id=payload.qrcode_id)
    if not qrcode.is_allowed(request.auth, edit=True):
        return 403, {
            "detail": "You do not have the necessary permissions to add elements here."
        }

    fields = payload.dict(exclude_unset=True)
    fields["qrcode"] = qrcode  # Django ORM will accept the full instance cleanly
    del fields["qrcode_id"]

    note = TextNote.objects.create(**fields)
    return TextNoteOut.from_orm(note)


@note_router.post(
    "notes/image", auth=guest_allowed_auth, response={200: ImageNoteOut, 403: dict}
)
def create_image_note(
    request,
    payload: ImageNoteIn,
    file: File[UploadedFile],
):
    """Multipart-form data upload endpoint tailored for AR target image frames."""
    qrcode = get_object_or_404(QRCode, id=payload.qrcode_id)
    if not qrcode.is_allowed(request.auth, edit=True):
        return 403, {"detail": "You do not have permission to upload to this space."}

    fields = payload.dict(exclude_unset=True)
    fields["image"] = file
    fields["qrcode"] = qrcode  # Django ORM will accept the full instance cleanly
    del fields["qrcode_id"]

    note = ImageNote.objects.create(**fields)
    return serialize_note(note)


@note_router.post(
    "notes/arrow", auth=guest_allowed_auth, response={200: ArrowNoteOut, 403: dict}
)
def create_arrow_note(request, payload: ArrowNoteIn):
    qrcode = get_object_or_404(QRCode, id=payload.qrcode_id)
    if not qrcode.is_allowed(request.auth, edit=True):
        return 403, {"detail": "You do not have permission to edit."}

    fields = payload.dict(exclude_unset=True)
    fields["qrcode"] = qrcode  # Django ORM will accept the full instance cleanly
    del fields["qrcode_id"]

    note = ArrowNote.objects.create(**fields)
    return ArrowNoteOut.from_orm(note)


@note_router.get(
    "notes/{note_id}", auth=guest_allowed_auth, response={200: dict, 403: dict}
)
def get_note(request, note_id: int):
    note = get_object_or_404(Note, id=note_id)

    if not note.qrcode.is_allowed(request.auth, edit=False):
        return 403, {"detail": "You do not have permission to view this note."}

    serialized_data = serialize_note(note)

    if hasattr(serialized_data, "dict"):
        return serialized_data.dict()

    return serialized_data


@note_router.put(
    "notes/text/{note_id}",
    auth=guest_allowed_auth,
    response={200: TextNoteOut, 403: dict},
)
def update_text_note(request, note_id: int, payload: TextNoteUpdateIn):
    note = get_object_or_404(TextNote, id=note_id)

    # Permission verification via the parent QRCode relation
    if not note.qrcode.is_allowed(request.auth, edit=True):
        return 403, {"detail": "You do not have permission to edit this note."}

    fields = payload.dict(exclude_unset=True)

    # If the client wants to move the note to a different QRCode anchor
    if "qrcode_id" in fields:
        new_qrcode = get_object_or_404(QRCode, id=fields.pop("qrcode_id"))
        if not new_qrcode.is_allowed(request.auth, edit=True):
            return 403, {
                "detail": "You do not have permission to move items to this QRCode."
            }
        note.qrcode = new_qrcode

    for attr, value in fields.items():
        setattr(note, attr, value)

    note.save()
    return TextNoteOut.from_orm(note)


@note_router.put(
    "notes/image/{note_id}",
    auth=guest_allowed_auth,
    response={200: ImageNoteOut, 403: dict},
)
def update_image_note(
    request,
    note_id: int,
    payload: ImageNoteUpdateIn,
    file: UploadedFile = File(None),  # noqa: B008
):
    note = get_object_or_404(ImageNote, id=note_id)

    if not note.qrcode.is_allowed(request.auth, edit=True):
        return 403, {"detail": "You do not have permission to edit this note."}

    fields = payload.dict(exclude_unset=True)

    if "qrcode_id" in fields:
        new_qrcode = get_object_or_404(QRCode, id=fields.pop("qrcode_id"))
        if not new_qrcode.is_allowed(request.auth, edit=True):
            return 403, {
                "detail": "You do not have permission to move items to this anchor."
            }
        note.qrcode = new_qrcode

    if file:
        fields["image"] = file

    for attr, value in fields.items():
        setattr(note, attr, value)

    note.save()
    return serialize_note(note)


@note_router.put(
    "notes/arrow/{note_id}",
    auth=guest_allowed_auth,
    response={200: ArrowNoteOut, 403: dict},
)
def update_arrow_note(request, note_id: int, payload: ArrowNoteUpdateIn):
    note = get_object_or_404(ArrowNote, id=note_id)

    if not note.qrcode.is_allowed(request.auth, edit=True):
        return 403, {"detail": "You do not have permission to edit this note."}

    fields = payload.dict(exclude_unset=True)

    if "qrcode_id" in fields:
        new_qrcode = get_object_or_404(QRCode, id=fields.pop("qrcode_id"))
        if not new_qrcode.is_allowed(request.auth, edit=True):
            return 403, {
                "detail": "You do not have permission to move items to this anchor."
            }
        note.qrcode = new_qrcode

    for attr, value in fields.items():
        setattr(note, attr, value)

    note.save()
    return ArrowNoteOut.from_orm(note)


@note_router.delete(
    "notes/{note_id}", auth=guest_allowed_auth, response={200: dict, 403: dict}
)
def delete_note(request, note_id: int):
    note = get_object_or_404(Note, id=note_id)

    if not note.qrcode.is_allowed(request.auth, edit=True):
        return 403, {"detail": "You are not allowed to delete items from this anchor."}

    note.delete()
    return {"success": True}
