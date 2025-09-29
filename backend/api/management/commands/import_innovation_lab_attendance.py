import csv
import os
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from api.models import Student, Event, Attendance


class Command(BaseCommand):
    help = 'Import Innovation Lab attendance from CSV file with First Name, Last Name, A-Number format'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the CSV file')
        parser.add_argument('--event-id', type=int, help='Event ID to assign attendance to (optional)')

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        event_id = options.get('event_id')
        
        if not os.path.exists(csv_file):
            raise CommandError(f'CSV file "{csv_file}" does not exist')

        # Get the absolute path
        csv_path = os.path.abspath(csv_file)
        
        self.stdout.write(f'Importing Innovation Lab attendance from: {csv_path}')
        
        # Get the event
        if event_id:
            try:
                event = Event.objects.get(id=event_id)
            except Event.DoesNotExist:
                raise CommandError(f'Event with ID {event_id} does not exist')
        else:
            # Try to find the Innovation Lab event for 9/25/2025
            try:
                event = Event.objects.get(name='Innovation Lab 9/25/2025')
            except Event.DoesNotExist:
                raise CommandError('Innovation Lab 9/25/2025 event not found. Please create it first or specify --event-id')
        
        self.stdout.write(f'Using event: {event.name} (ID: {event.id})')
        
        imported_count = 0
        error_count = 0
        skipped_count = 0
        
        with open(csv_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 because of header
                try:
                    # Debug: Print the row keys to see what's available
                    if row_num == 2:  # Only print for first row
                        self.stdout.write(f'Available columns: {list(row.keys())}')
                    
                    # Get student data (handle BOM in column names)
                    first_name = row.get('\ufeffFirst Name', row.get('First Name', '')).strip()
                    last_name = row.get('Last Name', '').strip()
                    a_number = row.get('A-Number', '').strip()
                    
                    # Skip empty rows
                    if not first_name and not last_name:
                        continue
                    
                    # Validate required fields
                    if not first_name:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Empty first name, skipping')
                        )
                        error_count += 1
                        continue
                    
                    if not last_name:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Empty last name, skipping')
                        )
                        error_count += 1
                        continue
                    
                    # Try to find student by A-number first, then by name
                    student = None
                    match_method = ""
                    
                    if a_number:
                        # Clean up A-number (remove leading zeros, handle case)
                        a_number_clean = a_number.upper().lstrip('0')
                        if not a_number_clean.startswith('A'):
                            a_number_clean = 'A' + a_number_clean
                        
                        # Try to find by A-number in email field (assuming A-number is in email)
                        students_by_email = Student.objects.filter(email__icontains=a_number_clean)
                        if students_by_email.exists():
                            student = students_by_email.first()
                            match_method = f"A-number ({a_number_clean})"
                    
                    # If not found by A-number, try by first + last name
                    if not student:
                        students_by_name = Student.objects.filter(
                            first_name__iexact=first_name,
                            last_name__iexact=last_name
                        )
                        if students_by_name.exists():
                            student = students_by_name.first()
                            match_method = f"name ({first_name} {last_name})"
                    
                    if not student:
                        self.stdout.write(
                            self.style.ERROR(f'Row {row_num}: Student not found: {first_name} {last_name} (A-number: {a_number})')
                        )
                        error_count += 1
                        continue
                    
                    # Check for existing attendance
                    if Attendance.objects.filter(student=student, event=event).exists():
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: {student.first_name} {student.last_name} already attended {event.name}, skipping')
                        )
                        skipped_count += 1
                        continue
                    
                    # Create the attendance record
                    attendance = Attendance.objects.create(
                        student=student,
                        event=event
                    )
                    
                    imported_count += 1
                    self.stdout.write(f'✓ Imported: {student.first_name} {student.last_name} → {event.name} (matched by {match_method})')
                    
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Row {row_num}: Error importing attendance: {str(e)}')
                    )
                    error_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nImport completed!\n'
                f'Successfully imported: {imported_count} attendance records\n'
                f'Skipped (duplicates): {skipped_count} records\n'
                f'Errors: {error_count} records\n'
                f'Note: Student points have been automatically updated'
            )
        )
