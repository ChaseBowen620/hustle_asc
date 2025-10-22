from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group
from api.models import AdminUser
import csv
import io

class Command(BaseCommand):
    help = 'Creates multiple faculty admin users from CSV data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--csv-data',
            type=str,
            help='CSV data as string with columns: username,email,first_name,last_name,role',
        )
        parser.add_argument(
            '--csv-file',
            type=str,
            help='Path to CSV file with columns: username,email,first_name,last_name,role',
        )
        parser.add_argument(
            '--password',
            type=str,
            default='changeme!',
            help='Default password for all faculty members (default: changeme!)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually creating users',
        )

    def handle(self, *args, **options):
        csv_data = options.get('csv_data')
        csv_file = options.get('csv_file')
        password = options['password']
        dry_run = options['dry_run']

        if not csv_data and not csv_file:
            self.stdout.write(
                self.style.ERROR('Either --csv-data or --csv-file must be provided')
            )
            return

        # Read CSV data
        if csv_file:
            try:
                with open(csv_file, 'r') as f:
                    csv_content = f.read()
            except FileNotFoundError:
                self.stdout.write(
                    self.style.ERROR(f'CSV file not found: {csv_file}')
                )
                return
        else:
            csv_content = csv_data

        # Parse CSV
        try:
            csv_reader = csv.DictReader(io.StringIO(csv_content))
            faculty_data = list(csv_reader)
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error parsing CSV: {e}')
            )
            return

        # Validate required columns
        required_columns = ['username', 'email', 'first_name', 'last_name']
        for row in faculty_data:
            for col in required_columns:
                if col not in row or not row[col].strip():
                    self.stdout.write(
                        self.style.ERROR(f'Missing required column "{col}" in CSV data')
                    )
                    return

        # Get or create Admin group
        admin_group, created = Group.objects.get_or_create(name='Admin')
        if created:
            self.stdout.write('Created Admin group')

        created_count = 0
        skipped_count = 0
        error_count = 0

        for row in faculty_data:
            username = row['username'].strip()
            email = row['email'].strip()
            first_name = row['first_name'].strip()
            last_name = row['last_name'].strip()
            role = row.get('role', 'Faculty').strip()

            # Check if user already exists
            if User.objects.filter(username=username).exists():
                self.stdout.write(
                    self.style.WARNING(f'Skipping {username} - user already exists')
                )
                skipped_count += 1
                continue

            if User.objects.filter(email=email).exists():
                self.stdout.write(
                    self.style.WARNING(f'Skipping {email} - email already exists')
                )
                skipped_count += 1
                continue

            if dry_run:
                self.stdout.write(
                    f'[DRY RUN] Would create: {username} ({first_name} {last_name}) - {role}'
                )
                created_count += 1
                continue

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
                user.groups.add(admin_group)

                # Create AdminUser profile
                admin_user = AdminUser.objects.create(
                    user=user,
                    first_name=first_name,
                    last_name=last_name,
                    role=role
                )

                self.stdout.write(
                    self.style.SUCCESS(f'Created: {username} ({first_name} {last_name}) - {role}')
                )
                created_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Error creating {username}: {e}')
                )
                error_count += 1

        # Summary
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(f'[DRY RUN] Would create {created_count} faculty members')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Summary: {created_count} created, {skipped_count} skipped, {error_count} errors'
                )
            )
