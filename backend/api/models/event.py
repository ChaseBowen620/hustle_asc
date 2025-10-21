from django.db import models
from django.utils import timezone
from .admin import AdminUser

class Event(models.Model):
    id = models.AutoField(primary_key=True)
    organization = models.CharField(
        max_length=100,
        help_text="Organization hosting the event (must match an AdminUser role)"
    )
    event_type = models.CharField(
        max_length=100,
        help_text="Type of the event"
    )
    function = models.CharField(
        max_length=100,
        help_text="Function/purpose of the event"
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