from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'No-op: students no longer have linked user accounts; username is stored on Student.'

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('Student usernames are stored on the Student model. Nothing to migrate.')
        )
