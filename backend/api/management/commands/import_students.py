import csv
import os
from django.core.management.base import BaseCommand, CommandError
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
                    
                    # Use email local part as A-number; ensure unique
                    a_num = email.split('@')[0].lower()
                    base_a_num = a_num
                    counter = 1
                    while Student.objects.filter(a_number=a_num).exists():
                        a_num = f"{base_a_num}_{counter}"
                        counter += 1
                    
                    student = Student.objects.create(
                        first_name=first_name,
                        last_name=last_name,
                        a_number=a_num
                    )
                    imported_count += 1
                    self.stdout.write(f'✓ Imported: {first_name} {last_name} ({email})')
                    
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
