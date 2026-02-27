from django.db import models


class Student(models.Model):
    id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    a_number = models.CharField(
        max_length=150,
        blank=True,
        db_index=True,
        verbose_name="A-number",
        help_text="A-number (e.g. a01234567) or other identifier"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def total_points(self):
        return self.attendances.count()

    def get_attendance_by_event_type(self):
        return (
            self.attendances.all()
            .values("event__organization")
            .annotate(count=models.Count("id"))
        )
