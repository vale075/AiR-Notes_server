from django.contrib.auth import logout
from django.shortcuts import redirect


def logout_view(request):
    logout(request)
    next_page = request.GET.get("next")
    if next_page:
        return redirect(next_page)
    return redirect("/")
