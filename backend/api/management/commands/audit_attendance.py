import csv
import os
from datetime import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth.models import User
from api.models import Event, Student, Attendance

class Command(BaseCommand):
    help = 'Audit and import missing attendance data from comprehensive CSV'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the comprehensive CSV file')
        parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
        parser.add_argument('--organization', type=str, default='ASC', help='Organization to filter by')

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        dry_run = options['dry_run']
        organization = options['organization']
        
        if not os.path.exists(csv_file):
            self.stdout.write(self.style.ERROR(f'CSV file not found: {csv_file}'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))

        # Parse CSV data
        attendance_data = []
        unique_events = set()
        unique_dates = set()
        
        with open(csv_file, 'r', encoding='utf-8-sig') as file:
            reader = csv.DictReader(file)
            for row in reader:
                if row['checkedIn'] == 'Yes' and row['checkInDate']:
                    # Parse the check-in date
                    checkin_date_str = row['checkInDate']
                    try:
                        # Parse date like "2025-10-23 01:12PM -06:00"
                        checkin_date = datetime.strptime(checkin_date_str, '%Y-%m-%d %I:%M%p %z')
                        date_only = checkin_date.date()
                        
                        # Extract event name from listName
                        event_name = row['listName'].strip()
                        if not event_name:
                            continue
                            
                        attendance_data.append({
                            'name': row['name'],
                            'email': row['email'],
                            'a_number': row['A-Number'],
                            'checkin_date': checkin_date,
                            'date_only': date_only,
                            'event_name': event_name,
                            'phone': row['phone']
                        })
                        unique_events.add(event_name)
                        unique_dates.add(date_only)
                    except ValueError as e:
                        self.stdout.write(self.style.WARNING(f'Could not parse date: {checkin_date_str} - {e}'))
                        continue

        self.stdout.write(f'Found {len(attendance_data)} attendance records')
        self.stdout.write(f'Unique events: {len(unique_events)}')
        self.stdout.write(f'Unique dates: {len(unique_dates)}')
        
        # Show some sample events
        self.stdout.write('\nSample events found:')
        for event in sorted(unique_events)[:10]:
            self.stdout.write(f'  - {event}')
        if len(unique_events) > 10:
            self.stdout.write(f'  ... and {len(unique_events) - 10} more')

        # Create events for each unique event name
        events_created = 0
        events_existing = 0
        event_map = {}  # Map event_name to event object
        
        for event_name in sorted(unique_events):
            # Check if event already exists
            existing_event = Event.objects.filter(
                name=event_name,
                organization=organization
            ).first()
            
            if existing_event:
                self.stdout.write(f'Event already exists: {event_name}')
                events_existing += 1
                event_map[event_name] = existing_event
                continue
            
            # Get the most common date for this event
            event_dates = [record['date_only'] for record in attendance_data if record['event_name'] == event_name]
            if not event_dates:
                continue
                
            # Use the most frequent date for this event
            from collections import Counter
            date_counts = Counter(event_dates)
            most_common_date = date_counts.most_common(1)[0][0]
            
            if not dry_run:
                # Create the event
                event = Event.objects.create(
                    name=event_name,
                    organization=organization,
                    event_type='Meeting',  # Default event type
                    description=f'{event_name} - Imported from comprehensive data',
                    location='TBD',
                    date=timezone.make_aware(datetime.combine(most_common_date, datetime.min.time().replace(hour=19)))  # 7 PM
                )
                self.stdout.write(f'Created event: {event_name} ({most_common_date})')
                event_map[event_name] = event
            else:
                self.stdout.write(f'Would create event: {event_name} ({most_common_date})')
                # For dry run, create a mock event object
                class MockEvent:
                    def __init__(self, name):
                        self.name = name
                event_map[event_name] = MockEvent(event_name)
            
            events_created += 1

        # Process attendance records
        attendance_created = 0
        attendance_existing = 0
        students_created = 0
        students_updated = 0
        errors = 0
        
        for record in attendance_data:
            try:
                # Find or create student
                student = None
                
                # Try to find existing student by email first
                try:
                    student = Student.objects.get(email=record['email'])
                except Student.DoesNotExist:
                    pass
                
                # Create new student if not found
                if not student:
                    if not dry_run:
                        # Create user account
                        username = record['a_number'] if record['a_number'] else record['email'].split('@')[0]
                        user, user_created = User.objects.get_or_create(
                            username=username,
                            defaults={
                                'email': record['email'],
                                'first_name': record['name'].split()[0] if record['name'] else '',
                                'last_name': ' '.join(record['name'].split()[1:]) if len(record['name'].split()) > 1 else '',
                                'is_active': True
                            }
                        )
                        
                        # Create student profile
                        student, student_created = Student.objects.get_or_create(
                            user=user,
                            defaults={
                                'first_name': record['name'].split()[0] if record['name'] else '',
                                'last_name': ' '.join(record['name'].split()[1:]) if len(record['name'].split()) > 1 else '',
                                'email': record['email'],
                                'username': record['a_number'] if record['a_number'] else ''
                            }
                        )
                        if student_created:
                            students_created += 1
                    else:
                        students_created += 1
                else:
                    # Update existing student info if needed
                    if not dry_run:
                        updated = False
                        if record['a_number'] and not student.username:
                            student.username = record['a_number']
                            updated = True
                        if record['name'] and (not student.first_name or not student.last_name):
                            name_parts = record['name'].split()
                            if name_parts:
                                student.first_name = name_parts[0]
                                student.last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
                                updated = True
                        if updated:
                            student.save()
                            students_updated += 1
                    else:
                        students_updated += 1
                
                # Find the corresponding event
                event = event_map.get(record['event_name'])
                if not event:
                    self.stdout.write(self.style.WARNING(f'Event not found: {record["event_name"]}'))
                    continue
                
                # Check if attendance already exists (only in non-dry-run mode)
                if not dry_run:
                    existing_attendance = Attendance.objects.filter(
                        student=student,
                        event=event
                    ).first()
                    
                    if existing_attendance:
                        attendance_existing += 1
                        continue
                    
                    # Create attendance record
                    Attendance.objects.create(
                        student=student,
                        event=event,
                        checked_in_at=record['checkin_date']
                    )
                    attendance_created += 1
                else:
                    attendance_created += 1
                    
            except Exception as e:
                errors += 1
                self.stdout.write(self.style.ERROR(f'Error processing {record["name"]}: {e}'))

        # Summary
        self.stdout.write(self.style.SUCCESS('\n=== AUDIT SUMMARY ==='))
        self.stdout.write(f'Events created: {events_created}')
        self.stdout.write(f'Events already existing: {events_existing}')
        self.stdout.write(f'Students created: {students_created}')
        self.stdout.write(f'Students updated: {students_updated}')
        self.stdout.write(f'Attendance records created: {attendance_created}')
        self.stdout.write(f'Attendance records already existing: {attendance_existing}')
        self.stdout.write(f'Errors: {errors}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\nThis was a dry run. Use without --dry-run to make actual changes.'))








