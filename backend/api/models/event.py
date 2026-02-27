from django.db import models
from django.utils import timezone

class Event(models.Model):
    RECURRENCE_CHOICES = [
        ('none', 'No Recurrence'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('biweekly', 'Every 2 Weeks'),
        ('monthly', 'Monthly'),
    ]
    
    id = models.AutoField(primary_key=True)
    organization = models.CharField(
        max_length=100,
        help_text="Organization hosting the event"
    )
    name = models.CharField(max_length=200)
    date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_recurring = models.BooleanField(
        default=False,
        help_text="Whether this event repeats regularly"
    )
    recurrence_type = models.CharField(
        max_length=20,
        choices=RECURRENCE_CHOICES,
        default='none',
        help_text="How often the event repeats"
    )

    def __str__(self):
        return self.name
    
    @property
    def has_passed(self):
        return self.date < timezone.now()