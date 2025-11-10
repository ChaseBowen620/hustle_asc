from django.db import models
from .event import Event
from .organization import Organization

class EventOrganization(models.Model):
    id = models.AutoField(primary_key=True)
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='event_organizations'
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='event_organizations',
        help_text="Organization associated with this event"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['event', 'organization']
        db_table = 'event_organizations'

    def __str__(self):
        return f"{self.event.name} - {self.organization.name}"

