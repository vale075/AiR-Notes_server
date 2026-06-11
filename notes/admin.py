from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import ArrowNote, ImageNote, QRCode, TextNote


# --- INLINES ---
# This allows you to view and edit notes directly inside the QRCode admin page.
class TextNoteInline(admin.StackedInline):
    model = TextNote
    extra = 0
    fieldsets = (
        (None, {"fields": ("title", "content", "anchored")}),
        (
            "3D Positioning (Anchor)",
            {"fields": ("pos_x", "pos_y", "pos_z", "rot_x", "rot_y", "rot_z")},
        ),
    )


class ImageNoteInline(admin.StackedInline):
    model = ImageNote
    extra = 0
    fieldsets = (
        (None, {"fields": ("title", "image", "anchored")}),
        (
            "3D Positioning (Anchor)",
            {"fields": ("pos_x", "pos_y", "pos_z", "rot_x", "rot_y", "rot_z")},
        ),
    )


class ArrowNoteInline(admin.StackedInline):
    model = ArrowNote
    extra = 0
    fieldsets = (
        (None, {"fields": ("title",)}),
        ("Start Point (Point 1)", {"fields": ("pos_x", "pos_y", "pos_z")}),
        ("End Point (Point 2)", {"fields": ("pos2_x", "pos2_y", "pos2_z")}),
    )


# --- MODEL ADMINS ---


@admin.register(QRCode)
class QRCodeAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "id",
        "owner",
        "share_status",
        "created_at",
        "display_qr_code",
    )
    list_filter = ("share_status", "created_at", "owner")
    search_fields = ("name", "id", "owner__username")
    readonly_fields = ("id", "created_at", "display_qr_code")

    # Integrates the specific note types straight into the QRCode details view
    inlines = [TextNoteInline, ImageNoteInline, ArrowNoteInline]

    fieldsets = (
        (None, {"fields": ("id", "name", "owner")}),
        ("Permissions", {"fields": ("share_status",)}),
        ("Live Preview", {"fields": ("display_qr_code",)}),
        ("Metadata", {"fields": ("created_at",)}),
    )

    def display_qr_code(self, obj):
        if obj.id:
            url = reverse("qrcode_image", args=[obj.id])
            return format_html('<img src="{}" width="200" height="200" />', url)
        return "Save the object first to generate a QR Code."

    display_qr_code.short_description = "Live QR Code"


@admin.register(TextNote)
class TextNoteAdmin(admin.ModelAdmin):
    list_display = ("title", "qrcode", "anchored", "created_at")
    list_filter = ("anchored", "created_at")
    search_fields = ("title", "content", "qrcode__name")

    fieldsets = (
        ("General Info", {"fields": ("qrcode", "title", "content", "anchored")}),
        ("3D Position (Vector 3)", {"fields": ("pos_x", "pos_y", "pos_z")}),
        ("3D Rotation", {"fields": ("rot_x", "rot_y", "rot_z")}),
    )


@admin.register(ImageNote)
class ImageNoteAdmin(admin.ModelAdmin):
    list_display = ("title", "qrcode", "image", "anchored", "created_at")
    list_filter = ("anchored", "created_at")
    search_fields = ("title", "qrcode__name")

    fieldsets = (
        ("General Info", {"fields": ("qrcode", "title", "image", "anchored")}),
        ("3D Position (Vector 3)", {"fields": ("pos_x", "pos_y", "pos_z")}),
        ("3D Rotation", {"fields": ("rot_x", "rot_y", "rot_z")}),
    )


@admin.register(ArrowNote)
class ArrowNoteAdmin(admin.ModelAdmin):
    list_display = ("title", "qrcode", "created_at")
    list_filter = ("created_at",)
    search_fields = ("title", "qrcode__name")

    fieldsets = (
        ("General Info", {"fields": ("qrcode", "title")}),
        ("Start Point (PointMixin)", {"fields": ("pos_x", "pos_y", "pos_z")}),
        ("End Point (Point2Mixin)", {"fields": ("pos2_x", "pos2_y", "pos2_z")}),
    )
