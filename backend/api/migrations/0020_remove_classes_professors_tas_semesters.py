# Generated manually to remove Class, Professor, TeachingAssistant, and Semester models

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_event_parent_event_event_recurrence_end_date_and_more'),
    ]

    operations = [
        migrations.DeleteModel(
            name='TeachingAssistant',
        ),
        migrations.DeleteModel(
            name='Class',
        ),
        migrations.DeleteModel(
            name='Professor',
        ),
        migrations.DeleteModel(
            name='Semester',
        ),
    ]


