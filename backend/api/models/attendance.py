from django.db import models
from .student import Student
from .event import Event


class Attendance(models.Model):
    id = models.AutoField(primary_key=True)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='attendances',
        to_field='id'
    )
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='attendances',
        to_field='id'
    )
    checked_in_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['student', 'event']
        verbose_name_plural = 'Attendance'

    def __str__(self):
        return f"{self.student} at {self.event}"