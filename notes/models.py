import uuid

from django.contrib.auth.models import User
from django.db import models


class QRCode(models.Model):
    """Represents the physical or digital QR code."""

    class QRCodeShareChoices(models.TextChoices):
        PRIVATE = "PRIVATE", "Privé"
        OPEN_VIEW = "OPEN_VIEW", "Ouvert au visionnage"
        OPEN_EDIT = "OPEN_EDIT", "Ouvert à l'édition"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        max_length=150,
        blank=True,
        help_text="Optional name for the QR code location/item",
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="QRcodes",
    )
    share_status = models.CharField(
        choices=QRCodeShareChoices.choices,
        max_length=10,
        default=QRCodeShareChoices.PRIVATE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"QR Code - {self.name} : {self.id}"

    def is_allowed(self, user: User, edit=True):  # noqa: FBT002
        return (
            user.is_superuser
            or self.owner.id == user.id
            or self.share_status == self.QRCodeShareChoices.OPEN_EDIT
            or (self.share_status == self.QRCodeShareChoices.OPEN_VIEW and not edit)
        )


class PointMixin(models.Model):
    """
    Abstract mixin to give ANY note a position in 3D space
    relative to the QR Code anchor.
    """

    # Vector 3 positions (X, Y, Z in meters from the QR code)
    pos_x = models.FloatField(default=0.0)
    pos_y = models.FloatField(default=0.0)
    pos_z = models.FloatField(default=0.0)

    class Meta:
        abstract = True


class Point2Mixin(models.Model):
    """
    Abstract mixin to give ANY note a position in 3D space
    relative to the QR Code anchor.
    """

    # Vector 3 positions (X, Y, Z in meters from the QR code)
    pos2_x = models.FloatField(default=0.0)
    pos2_y = models.FloatField(default=0.0)
    pos2_z = models.FloatField(default=0.0)

    class Meta:
        abstract = True


class RotationMixin(models.Model):
    """
    Abstract mixin to give ANY note a rotation in 3D space
    relative to the QR Code anchor.
    """

    # Rotation (Euler angles or Quaternions depending on your AR framework)
    rot_x = models.FloatField(default=0.0)
    rot_y = models.FloatField(default=0.0)
    rot_z = models.FloatField(default=0.0)

    class Meta:
        abstract = True


class AnchorMixin(PointMixin, RotationMixin):
    """
    Abstract mixin to give ANY note an anchor in 3D space
    relative to the QR Code anchor.
    """

    class Meta:
        abstract = True


class Note(models.Model):
    """Base Note model. Every specific note type inherits from this."""

    class NoteType(models.TextChoices):
        TEXT = "TXT", "Text Note"
        IMAGE = "IMA", "Image Note"
        ARROW = "ARR", "Arrow Note"

    qrcode = models.ForeignKey(QRCode, on_delete=models.CASCADE, related_name="notes")
    note_type = models.CharField(max_length=3, choices=NoteType.choices)
    title = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_note_type_display()}: {self.title or 'Untitled'}"


class TextNote(Note, AnchorMixin):
    content = models.TextField()
    anchored = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        self.note_type = Note.NoteType.TEXT
        super().save(*args, **kwargs)


def image_filename(instance, filename):
    return f"qrcode_{instance.qrcode.id}/{filename}"


class ImageNote(Note, AnchorMixin):
    image = models.ImageField(upload_to=image_filename)
    anchored = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        self.note_type = Note.NoteType.IMAGE
        super().save(*args, **kwargs)


class ArrowNote(Note, PointMixin, Point2Mixin):
    def save(self, *args, **kwargs):
        self.note_type = Note.NoteType.ARROW
        super().save(*args, **kwargs)
