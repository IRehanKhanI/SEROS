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
    ip_address = models.CharField(max_length=15, blank=True, null=True) # For ESP control
    is_on = models.BooleanField(default=False)
    
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
