import datetime
import secrets

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Token(models.Model):
    # Secure, un-guessable 40-character hex token
    key = models.CharField(max_length=40, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tokens")
    created_at = models.DateTimeField(auto_now_add=True)

    expires_at = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.key:
            self.key = secrets.token_hex(20)  # Generates a 40-character string
        if not self.expires_at:
            # Set default expiration to 30 days from now
            self.expires_at = timezone.now() + datetime.timedelta(days=30)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Token for {self.user.username}"
