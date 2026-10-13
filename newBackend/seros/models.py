from django.db import models


class Section(models.Model):
    name = models.CharField(max_length=120)
    subtitle = models.CharField(max_length=200, blank=True)
    camera_url = models.URLField(blank=True)
    empty_delay_seconds = models.PositiveIntegerField(default=600)


class Device(models.Model):
    LIGHT = "lights"
    FAN = "fans"
    AC = "ac"
    CATEGORY_CHOICES = [(LIGHT, "Lights"), (FAN, "Fans"), (AC, "AC")]
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="devices")
    device_id = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    relay = models.PositiveIntegerField(null=True, blank=True)
    is_on = models.BooleanField(default=False)
    manual_override = models.BooleanField(default=False)
    speed = models.PositiveSmallIntegerField(default=0)
    power_watts = models.FloatField(default=0)
    target_temperature = models.FloatField(default=24)
    updated_at = models.DateTimeField(auto_now=True)


class Zone(models.Model):
    RECTANGLE = "rectangle"
    POLYGON = "polygon"
    SHAPES = [(RECTANGLE, "Rectangle"), (POLYGON, "Polygon")]
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="zones")
    name = models.CharField(max_length=120)
    shape_type = models.CharField(max_length=20, choices=SHAPES, default=POLYGON)
    points = models.JSONField(default=list)
    color = models.CharField(max_length=16, default="#FFB547")
    assigned_devices = models.ManyToManyField(Device, blank=True, related_name="zones")


class Rule(models.Model):
    title = models.CharField(max_length=160)
    when_text = models.CharField(max_length=240)
    then_text = models.CharField(max_length=240)
    is_active = models.BooleanField(default=True)


class Detection(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="detections")
    person_count = models.PositiveIntegerField(default=0)
    boxes = models.JSONField(default=list)
    processed_frame = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
