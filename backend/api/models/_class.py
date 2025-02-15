from django.db import models
from .professor import Professor
from .semester import Semester

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