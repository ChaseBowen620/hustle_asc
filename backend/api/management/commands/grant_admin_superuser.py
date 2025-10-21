from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from api.models import AdminUser


class Command(BaseCommand):
    help = 'Grant Django superuser status to all users with admin profiles'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Find all admin users
        admin_users = AdminUser.objects.all()
        
        if not admin_users.exists():
            self.stdout.write(
                self.style.WARNING('No admin users found.')
            )
            return
        
        self.stdout.write(f'Found {admin_users.count()} admin users:')
        self.stdout.write('')
        
        updated_count = 0
        already_superuser_count = 0
        
        for admin in admin_users:
            user = admin.user
            
            # Check current status
            is_staff = user.is_staff
            is_superuser = user.is_superuser
            
            self.stdout.write(f'Admin: {admin.first_name} {admin.last_name} ({admin.role})')
            self.stdout.write(f'  Username: {user.username}')
            self.stdout.write(f'  Email: {user.email}')
            self.stdout.write(f'  Current - Staff: {is_staff}, Superuser: {is_superuser}')
            
            if is_staff and is_superuser:
                self.stdout.write(f'  Status: ✅ Already has superuser access')
                already_superuser_count += 1
            else:
                if dry_run:
                    self.stdout.write(f'  Status: 🔄 Would grant superuser access')
                else:
                    # Grant superuser access
                    user.is_staff = True
                    user.is_superuser = True
                    user.save()
                    self.stdout.write(f'  Status: ✅ Granted superuser access')
                    updated_count += 1
            
            self.stdout.write('')
        
        # Summary
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f'DRY RUN COMPLETE:\n'
                    f'  - {already_superuser_count} already have superuser access\n'
                    f'  - {updated_count} would be granted superuser access\n'
                    f'  - Total admin users: {admin_users.count()}'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'SUPERUSER GRANT COMPLETE:\n'
                    f'  - {already_superuser_count} already had superuser access\n'
                    f'  - {updated_count} granted superuser access\n'
                    f'  - Total admin users: {admin_users.count()}'
                )
            )
        
        if not dry_run and updated_count > 0:
            self.stdout.write('')
            self.stdout.write(
                self.style.WARNING(
                    'Note: Admin users can now access Django admin at /admin/'
                )
            )


