# Remove event_type field from Event model

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0035_alter_event_organization'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='event',
            name='event_type',
        ),
    ]
