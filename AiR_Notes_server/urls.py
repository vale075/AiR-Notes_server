"""
URL configuration for AiR_Notes_server project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.utils.html import format_html
from django.views.generic.base import RedirectView

from .api import api

admin.site.site_header = "AiR Notes Administration"
admin.site.site_title = "AiR Notes Admin Portal"

# Changes the sub-title on the main admin dashboard page
admin.site.index_title = format_html(
    "Bienvenue sur le panneau de contrôle. 🚀 "
    '<a href="/api/docs" target="_blank" style="margin-left: 15px; text-decoration: underline; color: #79aec8;">Voir '
    "la doc API</a>"
)

urlpatterns = [
    path("", RedirectView.as_view(url="admin/", permanent=False)),
    path("admin/", admin.site.urls),
    path("api/", api.urls),
    path("", include("notes.urls")),
    path("", include("users.urls")),
]

# Made with ChatGPT to serve Media files even when debug=False
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    from django.urls import re_path
    from django.views.static import serve

    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve,
            {
                "document_root": settings.MEDIA_ROOT,
            },
        ),
    ]
# By serving media files via Django directly, we loose performance. But we cannot serve
# them with whitenoise, so serving them outside of Django would necessitate a nginx
# server.

if settings.DEBUG and not settings.MINIMAL:
    # Include django_browser_reload URLs only in DEBUG mode
    urlpatterns += [
        path("__reload__/", include("django_browser_reload.urls")),
    ]
