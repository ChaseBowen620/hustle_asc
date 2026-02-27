# Remove cached attendance fields; total_points is now computed from attendances.count()

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0039_student_remove_email_rename_username_to_a_number'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='student',
            name='cached_attendance_count',
        ),
        migrations.RemoveField(
            model_name='student',
            name='last_attendance_update',
        ),
    ]
