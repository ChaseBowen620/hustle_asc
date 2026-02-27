# Remove Student.email and rename username to a_number

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0038_student_email_remove_user'),
    ]

    operations = [
        migrations.RenameField(
            model_name='student',
            old_name='username',
            new_name='a_number',
        ),
        migrations.RemoveField(
            model_name='student',
            name='email',
        ),
        migrations.AlterField(
            model_name='student',
            name='a_number',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='A-number (e.g. a01234567) or other identifier',
                max_length=150,
                verbose_name='A-number',
            ),
        ),
    ]
