from django.db import models
from django.utils import timezone
from .admin import AdminUser

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
        help_text="Organization hosting the event (must match an AdminUser role)"
    )
    event_type = models.CharField(
        max_length=100,
        help_text="Type of the event"
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date = models.DateTimeField()
    location = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Recurring event fields
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
    recurrence_end_date = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When the recurring events should stop (optional)"
    )
    parent_event = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        related_name='recurring_instances',
        blank=True,
        null=True,
        help_text="The original event this is a recurring instance of"
    )

    def __str__(self):
        return self.name
    
    @property
    def has_passed(self):
        return self.date < timezone.now()