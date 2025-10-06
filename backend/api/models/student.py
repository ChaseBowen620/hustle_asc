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
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    cached_total_points = models.IntegerField(default=0)
    last_points_update = models.DateTimeField(auto_now=True)
    is_admin = models.BooleanField(default=False, verbose_name="Admin Status")

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    
    def update_points_cache(self):
        self.cached_total_points = sum(
            attendance.event.points 
            for attendance in self.attendances.all()
        )
        self.save(update_fields=['cached_total_points', 'last_points_update'])

    @property
    def total_points(self):
        return self.cached_total_points

    def get_attendance_by_event_type(self):
        return (
            self.attendances.all()
            .values('event__event_type__name')
            .annotate(
                count=models.Count('id'),
                total_points=models.Sum('event__points')
            )
        )

@receiver(post_save, sender=User)
def create_student_profile(sender, instance, created, **kwargs):
    if created and not hasattr(instance, 'student'):
        Student.objects.create(
            user=instance,
            first_name=instance.first_name,
            last_name=instance.last_name,
            email=instance.email
        )
