from django.db import models
from .student import Student
from .event import Event


class PendingCheckIn(models.Model):
    """Server-side queue for check-ins from scan/check-in pages so Refresh Attendances works across devices."""
    temp_id = models.CharField(max_length=64, unique=True, db_index=True)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='pending_checkins',
    )
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='pending_checkins',
    )
    event_date = models.CharField(max_length=32, blank=True)
    # For new students (when student_id is null)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    a_number = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Pending check-ins'

    def __str__(self):
        if self.student_id:
            return f"Pending {self.student_id} -> event {self.event_id}"
        return f"Pending new {self.a_number} -> event {self.event_id}"
