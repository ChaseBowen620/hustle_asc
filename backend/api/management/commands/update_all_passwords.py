from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'No-op: students do not sign in; only hardcoded login is used.'

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('There are no per-student logins; passwords are not used.')
        )


