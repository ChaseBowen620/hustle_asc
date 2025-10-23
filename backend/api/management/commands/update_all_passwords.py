from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Update all user passwords to "changeme!"'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            type=str,
            default='changeme!',
            help='Password to set for all users (default: changeme!)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes'
        )

    def handle(self, *args, **options):
        password = options['password']
        dry_run = options['dry_run']
        
        # Get all users
        users = User.objects.all()
        user_count = users.count()
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'DRY RUN: Would update {user_count} user passwords to "{password}"')
            )
            for user in users:
                self.stdout.write(f'  - {user.username} ({user.email})')
            return
        
        # Update passwords
        updated_count = 0
        for user in users:
            user.set_password(password)
            user.save()
            updated_count += 1
            self.stdout.write(f'Updated password for {user.username}')
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully updated {updated_count} user passwords to "{password}"')
        )


