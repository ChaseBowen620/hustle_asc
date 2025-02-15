from django.db import models
from .student import Student
from .event import Event
from django.db.models.signals import post_save
from django.dispatch import receiver

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

@receiver(post_save, sender=Attendance)
def update_student_points(sender, instance, **kwargs):
    instance.student.update_points_cache()