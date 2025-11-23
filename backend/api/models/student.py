from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class Student(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='student_profile'
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    username = models.CharField(max_length=150, blank=True, help_text="Username from the user account")
    created_at = models.DateTimeField(auto_now_add=True)
    cached_attendance_count = models.IntegerField(default=0)
    last_attendance_update = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    
    def update_attendance_cache(self):
        self.cached_attendance_count = self.attendances.count()
        self.save(update_fields=['cached_attendance_count', 'last_attendance_update'])

    @property
    def total_points(self):
        return self.cached_attendance_count

    def get_attendance_by_event_type(self):
        return (
            self.attendances.all()
            .values('event__event_type')
            .annotate(
                count=models.Count('id')
            )
        )

@receiver(post_save, sender=User)
def create_student_profile(sender, instance, created, **kwargs):
    if created and not hasattr(instance, 'student'):
        Student.objects.create(
            user=instance,
            first_name=instance.first_name or '',
            last_name=instance.last_name or '',
            username=instance.username
        )
