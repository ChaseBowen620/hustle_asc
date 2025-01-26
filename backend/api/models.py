from django.db import models
from django.utils import timezone

# Create your models here.

class Student(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def total_points(self):
        return sum(attendance.event.points for attendance in self.attendances.all())

class Event(models.Model):
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
    student = models.ForeignKey(Student, related_name='attendances', on_delete=models.CASCADE)
    event = models.ForeignKey(Event, related_name='attendances', on_delete=models.CASCADE)
    checked_in_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['student', 'event']
        verbose_name_plural = 'Attendance'

    def __str__(self):
        return f"{self.student} at {self.event}"

class Semester(models.Model):
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
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class Class(models.Model):
    course_code = models.CharField(max_length=20)
    professor = models.ForeignKey(Professor, on_delete=models.CASCADE)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE)
    
    class Meta:
        verbose_name_plural = "Classes"
        unique_together = ('course_code', 'professor', 'semester')
    
    def __str__(self):
        return f"{self.course_code} - {self.professor}"

class TeachingAssistant(models.Model):
    student = models.ForeignKey('Student', on_delete=models.CASCADE)
    class_assigned = models.ForeignKey(Class, on_delete=models.CASCADE)
    points_awarded = models.IntegerField(default=5, editable=False)  # Fixed at 5 points
    
    class Meta:
        unique_together = ('student', 'class_assigned')
    
    def __str__(self):
        return f"{self.student} - {self.class_assigned}"
