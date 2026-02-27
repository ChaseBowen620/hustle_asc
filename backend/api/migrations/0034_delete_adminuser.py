# Remove AdminUser, TeachingAssistant, Class, Professor, Semester models and tables

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0033_pendingcheckin'),
    ]

    operations = [
        migrations.DeleteModel(name='TeachingAssistant'),
        migrations.DeleteModel(name='Class'),
        migrations.DeleteModel(name='Professor'),
        migrations.DeleteModel(name='Semester'),
        migrations.DeleteModel(name='AdminUser'),
    ]
