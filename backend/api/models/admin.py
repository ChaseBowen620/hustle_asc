from django.db import models
from django.contrib.auth.models import User

class AdminUser(models.Model):
    """
    Admin model that references the User table as a foreign key.
    Contains admin-specific information including role.
    """
    id = models.AutoField(primary_key=True)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='adminuser'
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    role = models.CharField(max_length=100, help_text="Admin role (e.g., 'Super Admin', 'Event Manager', etc.)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Admin User"
        verbose_name_plural = "Admin Users"
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.role})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
