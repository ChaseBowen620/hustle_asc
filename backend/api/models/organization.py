from django.db import models

class Organization(models.Model):
    """
    Organization model to manage all organizations/clubs in the system.
    """
    id = models.AutoField(primary_key=True)
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Organization name (e.g., 'DAISSA', 'Innovation Lab', etc.)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"
        ordering = ['name']
        db_table = 'organizations'

    def __str__(self):
        return self.name

