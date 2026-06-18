from django.urls import path

from . import views

urlpatterns = [
    # The URL embedded INSIDE the QR Code (where scanned users go)
    path("qrcode/<uuid:qr_id>/", views.qrcode_landing_view, name="qrcode_landing_page"),
    # The endpoint that generates the image
    path(
        "qrcodes/<uuid:qr_id>/image/", views.generate_qr_code_image, name="qrcode_image"
    ),
    path("voice_dev", views.voice_dev_view, name="voice_dev"),
]
