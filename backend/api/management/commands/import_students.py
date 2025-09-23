import csv
import os
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from api.models import Student


class Command(BaseCommand):
    help = 'Import students from CSV file (creates dummy users for historical data)'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the CSV file')

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        
        if not os.path.exists(csv_file):
            raise CommandError(f'CSV file "{csv_file}" does not exist')

        # Get the absolute path
        csv_path = os.path.abspath(csv_file)
        
        self.stdout.write(f'Importing students from: {csv_path}')
        
        imported_count = 0
        error_count = 0
        
        with open(csv_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 because of header
                try:
                    # Debug: Print the row keys to see what's available
                    if row_num == 2:  # Only print for first row
                        self.stdout.write(f'Available columns: {list(row.keys())}')
                    
                    # Get student data (handle BOM in column names)
                    first_name = row.get('\ufefffirst_name', row.get('first_name', '')).strip()
                    last_name = row.get('last_name', '').strip()
                    email = row.get('email', '').strip()
                    is_admin_str = row.get('is_admin', 'FALSE').strip().upper()
                    
                    # Validate required fields
                    if not first_name:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Empty first_name, skipping')
                        )
                        error_count += 1
                        continue
                    
                    # Handle missing last_name with default
                    if not last_name:
                        last_name = "[Unknown]"
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Missing last_name, using default: "{last_name}"')
                        )
                    
                    # Handle missing email with unique default
                    if not email:
                        # Generate unique email based on first_name and row number
                        email_base = first_name.lower().replace(' ', '')
                        email = f"{email_base}{row_num}@placeholder.com"
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Missing email, using default: "{email}"')
                        )
                    
                    # Check if email already exists
                    if Student.objects.filter(email=email).exists():
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Email {email} already exists, skipping')
                        )
                        error_count += 1
                        continue
                    
                    # Check if username already exists (for the user we're about to create)
                    username = email.split('@')[0]  # Use part before @ as username
                    original_username = username
                    counter = 1
                    
                    # Ensure username is unique
                    while User.objects.filter(username=username).exists():
                        username = f"{original_username}_{counter}"
                        counter += 1
                    
                    # Double-check that the final username doesn't conflict
                    if User.objects.filter(username=username).exists():
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Username {username} already exists, skipping')
                        )
                        error_count += 1
                        continue
                    
                    # Parse admin status
                    is_admin = is_admin_str in ['TRUE', '1', 'YES', 'Y']
                    
                    # Create dummy user (username already validated above)
                    
                    # Create user with dummy password
                    user = User.objects.create_user(
                        username=username,
                        email=email,
                        password='dummy_password_for_historical_data',  # Dummy password
                        first_name=first_name,
                        last_name=last_name,
                        is_active=False  # Mark as inactive since it's historical data
                    )
                    
                    # Create student profile
                    student = Student.objects.create(
                        user=user,
                        first_name=first_name,
                        last_name=last_name,
                        email=email,
                        is_admin=is_admin
                    )
                    
                    imported_count += 1
                    self.stdout.write(f'✓ Imported: {first_name} {last_name} ({email}) - Admin: {is_admin}')
                    
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Row {row_num}: Error importing student: {str(e)}')
                    )
                    error_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nImport completed!\n'
                f'Successfully imported: {imported_count} students\n'
                f'Errors: {error_count} students\n'
                f'Note: All imported students have dummy user accounts with inactive status'
            )
        )
