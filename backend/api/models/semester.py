from django.db import models

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