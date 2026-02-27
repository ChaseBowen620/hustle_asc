# Remove PendingCheckIn; check-ins write directly to Attendance

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0040_remove_student_cached_attendance_fields'),
    ]

    operations = [
        migrations.DeleteModel(
            name='PendingCheckIn',
        ),
    ]
