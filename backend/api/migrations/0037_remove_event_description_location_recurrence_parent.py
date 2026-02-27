# Remove description, location, recurrence_end_date, parent_event from Event

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0036_remove_event_event_type'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='event',
            name='parent_event',
        ),
        migrations.RemoveField(
            model_name='event',
            name='recurrence_end_date',
        ),
        migrations.RemoveField(
            model_name='event',
            name='description',
        ),
        migrations.RemoveField(
            model_name='event',
            name='location',
        ),
    ]
