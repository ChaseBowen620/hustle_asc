from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group
from api.models import AdminUser

class Command(BaseCommand):
    help = 'Creates a faculty admin user with AdminUser profile'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            required=True,
            help='Username for the faculty member',
        )
        parser.add_argument(
            '--email',
            type=str,
            required=True,
            help='Email for the faculty member',
        )
        parser.add_argument(
            '--first-name',
            type=str,
            required=True,
            help='First name of the faculty member',
        )
        parser.add_argument(
            '--last-name',
            type=str,
            required=True,
            help='Last name of the faculty member',
        )
        parser.add_argument(
            '--role',
            type=str,
            default='Faculty',
            help='Admin role (default: Faculty)',
        )
        parser.add_argument(
            '--password',
            type=str,
            default='changeme!',
            help='Password for the faculty member (default: changeme!)',
        )

    def handle(self, *args, **options):
        username = options['username']
        email = options['email']
        first_name = options['first_name']
        last_name = options['last_name']
        role = options['role']
        password = options['password']

        # Check if user already exists
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'User with username "{username}" already exists')
            )
            return

        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.WARNING(f'User with email "{email}" already exists')
            )
            return

        try:
            # Create the user
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_active=True
            )

            # Add to Admin group
            admin_group, created = Group.objects.get_or_create(name='Admin')
            user.groups.add(admin_group)

            # Create AdminUser profile
            admin_user = AdminUser.objects.create(
                user=user,
                first_name=first_name,
                last_name=last_name,
                role=role
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created faculty admin user:\n'
                    f'  Username: {username}\n'
                    f'  Email: {email}\n'
                    f'  Name: {first_name} {last_name}\n'
                    f'  Role: {role}\n'
                    f'  Password: {password}\n'
                    f'  AdminUser ID: {admin_user.id}'
                )
            )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating faculty admin user: {e}')
            )

