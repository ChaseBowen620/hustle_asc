# Add Student.email, backfill from User, then remove Student.user

from django.conf import settings
from django.db import migrations, models


def backfill_from_user(apps, schema_editor):
    Student = apps.get_model('api', 'Student')
    User = apps.get_model(settings.AUTH_USER_MODEL)
    for s in Student.objects.all():
        user_id = getattr(s, 'user_id', None)
        if not user_id:
            continue
        try:
            u = User.objects.get(id=user_id)
            updates = {}
            if not (getattr(s, 'username', None) or '').strip():
                updates['username'] = u.username or ''
            updates['email'] = getattr(u, 'email', '') or ''
            for k, v in updates.items():
                setattr(s, k, v)
            s.save(update_fields=list(updates.keys()))
        except User.DoesNotExist:
            pass


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0037_remove_event_description_location_recurrence_parent'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='email',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),
        migrations.RunPython(backfill_from_user, noop_reverse),
        migrations.RemoveField(
            model_name='student',
            name='user',
        ),
    ]
