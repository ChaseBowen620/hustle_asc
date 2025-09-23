import csv
import os
from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from api.models import Student, Event, Attendance


class Command(BaseCommand):
    help = 'Import attendance records from CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the CSV file')

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        
        if not os.path.exists(csv_file):
            raise CommandError(f'CSV file "{csv_file}" does not exist')

        # Get the absolute path
        csv_path = os.path.abspath(csv_file)
        
        self.stdout.write(f'Importing attendance records from: {csv_path}')
        
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
                    
                    # Get attendance data (handle BOM in column names)
                    student_id = row.get('\ufeffstudent_id', row.get('student_id', '')).strip()
                    event_id = row.get('event_id', '').strip()
                    checked_in_at_str = row.get('checked_in_at', '').strip()
                    
                    # Validate required fields
                    if not student_id:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Empty student_id, skipping')
                        )
                        error_count += 1
                        continue
                    
                    if not event_id:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Empty event_id, skipping')
                        )
                        error_count += 1
                        continue
                    
                    # Validate student exists
                    try:
                        student = Student.objects.get(id=int(student_id))
                    except (ValueError, Student.DoesNotExist):
                        self.stdout.write(
                            self.style.ERROR(f'Row {row_num}: Invalid student_id "{student_id}"')
                        )
                        error_count += 1
                        continue
                    
                    # Validate event exists
                    try:
                        event = Event.objects.get(id=int(event_id))
                    except (ValueError, Event.DoesNotExist):
                        self.stdout.write(
                            self.style.ERROR(f'Row {row_num}: Invalid event_id "{event_id}"')
                        )
                        error_count += 1
                        continue
                    
                    # Check for existing attendance
                    if Attendance.objects.filter(student=student, event=event).exists():
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Student {student.first_name} {student.last_name} already attended {event.name}, skipping')
                        )
                        skipped_count += 1
                        continue
                    
                    # Parse checked_in_at timestamp
                    if checked_in_at_str:
                        try:
                            checked_in_at = datetime.strptime(checked_in_at_str, '%Y-%m-%d %H:%M:%S')
                            checked_in_at = timezone.make_aware(checked_in_at)
                        except ValueError:
                            self.stdout.write(
                                self.style.ERROR(f'Row {row_num}: Invalid date format "{checked_in_at_str}". Expected YYYY-MM-DD HH:MM:SS')
                            )
                            error_count += 1
                            continue
                    else:
                        # Use current time if not provided
                        checked_in_at = timezone.now()
                    
                    # Create the attendance record
                    attendance = Attendance.objects.create(
                        student=student,
                        event=event,
                        checked_in_at=checked_in_at
                    )
                    
                    imported_count += 1
                    self.stdout.write(f'✓ Imported: {student.first_name} {student.last_name} → {event.name} ({checked_in_at.strftime("%m/%d/%Y %H:%M")})')
                    
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
