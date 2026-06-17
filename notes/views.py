import io

import qrcode
from django.conf import settings
from django.contrib import messages
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers

from .models import QRCode


@cache_page(60 * 60 * 24)  # Caches the QR code image for 24 hours
@vary_on_headers(
    "host"
)  # Tells the cache to separate localhost, staging, and production
def generate_qr_code_image(request, qr_id):
    # 1. Fetch the QRCode object from the database
    qrcode_obj = get_object_or_404(QRCode, id=qr_id)

    target_url = request.build_absolute_uri(
        reverse("qrcode_landing_page", args=[qrcode_obj.id])
    )

    # 2. Configure the QR code generator
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )

    # 3. Add the fallback URL path
    qr.add_data(target_url)
    qr.make(fit=True)

    # 4. Create the image in memory
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    # 5. Return the raw bytes as a PNG image response
    return HttpResponse(buffer.getvalue(), content_type="image/png")


def qrcode_landing_view(request, qr_id):
    # Ensure it's a valid QR code before showing the landing page
    qrcode_obj = get_object_or_404(QRCode, id=qr_id)

    context = {
        "qrcode": qrcode_obj,
        "edit": qrcode_obj.is_allowed(request.user),
        "allowed": qrcode_obj.is_allowed(request.user, edit=False),
        "login": f"{settings.LOGIN_URL}?next={request.path}",
    }

    if not context["allowed"]:
        if not request.user.is_authenticated:
            messages.warning(
                request,
                "Ce QRCode et ses notes sont privés. Vous n'avez pas l'autorisation d'y accéder.",
            )
            return redirect(context["login"])

        return render(request, "notes/qrcode_landing.html", context)

    return render(request, "notes/qrcode_landing.html", context)
