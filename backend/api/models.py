from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

# Create your models here.

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

class EventType(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

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

class Semester(models.Model):
    id = models.AutoField(primary_key=True)
    SEASON_CHOICES = [
        ('FALL', 'Fall'),
        ('SPRING', 'Spring'),
        ('SUMMER', 'Summer'),
    ]
    
    season = models.CharField(max_length=6, choices=SEASON_CHOICES)
    year = models.IntegerField()
    is_current = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ('season', 'year')
        
    def __str__(self):
        return f"{self.season} {self.year}"

class Professor(models.Model):
    id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class Class(models.Model):
    id = models.AutoField(primary_key=True)
    course_code = models.CharField(max_length=20)
    professor = models.ForeignKey(
        Professor,
        on_delete=models.CASCADE,
        to_field='id'
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.CASCADE,
        to_field='id'
    )
    
    class Meta:
        verbose_name_plural = "Classes"
        unique_together = ('course_code', 'professor', 'semester')
    
    def __str__(self):
        return f"{self.course_code} - {self.professor}"

class TeachingAssistant(models.Model):
    id = models.AutoField(primary_key=True)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        to_field='id'
    )
    class_assigned = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        to_field='id'
    )
    points_awarded = models.IntegerField(default=5, editable=False)  # Fixed at 5 points
    
    class Meta:
        unique_together = ('student', 'class_assigned')
    
    def __str__(self):
        return f"{self.student} - {self.class_assigned}"
