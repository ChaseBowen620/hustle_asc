from django.db import models
from django.utils import timezone
from .event_type import EventType

class Event(models.Model):
    id = models.AutoField(primary_key=True)
    event_type = models.ForeignKey(
        EventType,
        on_delete=models.CASCADE,
        related_name='events',
        null=True,
        blank=True
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date = models.DateTimeField()
    location = models.CharField(max_length=200)
    points = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
    
    @property
    def has_passed(self):
        return self.date < timezone.now()