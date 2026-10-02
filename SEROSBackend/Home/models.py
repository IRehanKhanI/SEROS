from django.db import models
from django.utils import timezone

class Room(models.Model):
    name = models.CharField(max_length=100)
    
    def __str__(self):
        return self.name

class Device(models.Model):
    DEVICE_TYPES = (
        ('fan', 'Fan'),
        ('ac', 'Air Conditioner'),
        ('light', 'Light'),
    )
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='devices')
    name = models.CharField(max_length=100)
    device_type = models.CharField(max_length=50, choices=DEVICE_TYPES)
    ip_address = models.CharField(max_length=15, blank=True, null=True)
    is_on = models.BooleanField(default=False)
    power_rating_watts = models.FloatField(default=60.0)
    
    def __str__(self):
        return f"{self.name} ({self.room.name})"

class OccupancyEvent(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='events')
    timestamp = models.DateTimeField(default=timezone.now)
    is_occupied = models.BooleanField()
    people_count = models.IntegerField(default=0)
    action_taken = models.CharField(max_length=255, blank=True, null=True)
    
    def __str__(self):
        status = "Occupied" if self.is_occupied else "Empty"
        return f"{self.room.name} - {status} at {self.timestamp.strftime('%H:%M:%S')}"

class DeviceUsageSession(models.Model):
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='usage_sessions')
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.FloatField(default=0.0)
    energy_consumed_kwh = models.FloatField(default=0.0)

    def __str__(self):
        return f"{self.device.name} - {self.start_time}"

class EnergyLog(models.Model):
    """Historical energy consumption data (seeded from Kaggle-style dataset).
    Used for ML training and dashboard visualization."""
    timestamp = models.DateTimeField()
    consumption_kwh = models.FloatField()
    temperature_c = models.FloatField(default=25.0)
    humidity_pct = models.FloatField(default=50.0)
    occupancy = models.IntegerField(default=1)
    
    class Meta:
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.timestamp.strftime('%Y-%m-%d %H:%M')} - {self.consumption_kwh} kWh"
