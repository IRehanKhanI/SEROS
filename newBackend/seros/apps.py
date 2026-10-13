import os
from django.apps import AppConfig


class SerosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "seros"

    def ready(self):
        # Start camera service only in the main worker process
        if os.environ.get("RUN_MAIN") == "true" or not os.environ.get("DJANGO_SETTINGS_MODULE"):
            try:
                from .camera_service import start_camera_service
                start_camera_service()
            except Exception as exc:
                print(f"[SEROS] Could not start camera service: {exc}")
