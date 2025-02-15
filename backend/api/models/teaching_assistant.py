from django.db import models
from .student import Student
from ._class import Class

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