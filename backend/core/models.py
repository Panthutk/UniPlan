from django.db import models

class GoogleAccount(models.Model):
    email = models.EmailField(primary_key=True)
    credentials = models.JSONField()  # serialized google Credentials
    name = models.CharField(max_length=255, blank=True, default="")
    picture = models.URLField(blank=True, default="")

    def __str__(self):
        return self.email
