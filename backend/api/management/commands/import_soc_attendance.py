import csv
import os
from datetime import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth.models import User
from api.models import Event, Student, Attendance

class Command(BaseCommand):
    help = 'Import SOC attendance data from CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the CSV file')
        parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        dry_run = options['dry_run']
        
        if not os.path.exists(csv_file):
            self.stdout.write(self.style.ERROR(f'CSV file not found: {csv_file}'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))

        # Parse CSV data
        attendance_data = []
        unique_dates = set()
        
        with open(csv_file, 'r', encoding='utf-8-sig') as file:
            reader = csv.DictReader(file)
            for row in reader:
                if row['Checked In'] == 'Yes' and row['Check-in Date']:
                    # Parse the check-in date
                    checkin_date_str = row['Check-in Date']
                    try:
                        # Parse date like "2025-08-27 07:11PM -06:00"
                        checkin_date = datetime.strptime(checkin_date_str, '%Y-%m-%d %I:%M%p %z')
                        date_only = checkin_date.date()
                        
                        attendance_data.append({
                            'name': row['Name'],
                            'email': row['Email'],
                            'a_number': row['A-Number'],
                            'checkin_date': checkin_date,
                            'date_only': date_only
                        })
                        unique_dates.add(date_only)
                    except ValueError as e:
                        self.stdout.write(self.style.WARNING(f'Could not parse date: {checkin_date_str} - {e}'))
                        continue

        self.stdout.write(f'Found {len(attendance_data)} attendance records across {len(unique_dates)} unique dates')
        
        # Create events for each unique date
        events_created = 0
        events_existing = 0
        event_map = {}  # Map date to event object
        
        for date_only in sorted(unique_dates):
            event_name = f"SOC Meeting - {date_only.strftime('%B %d, %Y')}"
            
            # Check if event already exists
            existing_event = Event.objects.filter(
                name=event_name,
                organization='SOC'
            ).first()
            
            if existing_event:
                self.stdout.write(f'Event already exists: {event_name}')
                events_existing += 1
                event_map[date_only] = existing_event
                continue
            
            if not dry_run:
                # Create the event
                event = Event.objects.create(
                    name=event_name,
                    organization='SOC',
                    event_type='Meeting',
                    description=f'SOC weekly meeting on {date_only.strftime("%B %d, %Y")}',
                    location='TBD',
                    date=timezone.make_aware(datetime.combine(date_only, datetime.min.time().replace(hour=19)))  # 7 PM
                )
                self.stdout.write(f'Created event: {event_name}')
                event_map[date_only] = event
            else:
                self.stdout.write(f'Would create event: {event_name}')
                # For dry run, create a mock event object
                class MockEvent:
                    def __init__(self, name):
                        self.name = name
                event_map[date_only] = MockEvent(event_name)
            
            events_created += 1

        # Process attendance records
        attendance_created = 0
        students_created = 0
        students_updated = 0
        
        for record in attendance_data:
            # Find or create student
            student = None
            
            # Try to find by A-Number first (stored as username)
            if record['a_number']:
                try:
                    user = User.objects.get(username=record['a_number'])
                    try:
                        student = user.student_profile
                    except Student.DoesNotExist:
                        student = None
                except User.DoesNotExist:
                    pass
            
            # Try to find by email
            if not student:
                try:
                    user = User.objects.get(email=record['email'])
                    try:
                        student = user.student_profile
                    except Student.DoesNotExist:
                        student = None
                except User.DoesNotExist:
                    pass
            
            # Create new student if not found
            if not student:
                if not dry_run:
                    # Create user account
                    username = record['a_number'] if record['a_number'] else record['email'].split('@')[0]
                    user = User.objects.create_user(
                        username=username,
                        email=record['email'],
                        first_name=record['name'].split()[0] if record['name'] else '',
                        last_name=' '.join(record['name'].split()[1:]) if len(record['name'].split()) > 1 else '',
                        is_active=True
                    )
                    
                    # Create student profile
                    student = Student.objects.create(
                        user=user,
                        first_name=record['name'].split()[0] if record['name'] else '',
                        last_name=' '.join(record['name'].split()[1:]) if len(record['name'].split()) > 1 else '',
                        email=record['email'],
                        username=record['a_number'] if record['a_number'] else ''
                    )
                    self.stdout.write(f'Created student: {record["name"]} ({record["email"]})')
                else:
                    self.stdout.write(f'Would create student: {record["name"]} ({record["email"]})')
                
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
                        self.stdout.write(f'Updated student: {record["name"]}')
                else:
                    self.stdout.write(f'Would update student: {record["name"]}')
                
                students_updated += 1
            
            # Find the corresponding event
            event = event_map.get(record['date_only'])
            if not event:
                self.stdout.write(self.style.ERROR(f'Event not found for date: {record["date_only"]}'))
                continue
            
            # Check if attendance already exists (only in non-dry-run mode)
            if not dry_run:
                existing_attendance = Attendance.objects.filter(
                    student=student,
                    event=event
                ).first()
                
                if existing_attendance:
                    self.stdout.write(f'Attendance already exists: {record["name"]} for {event.name}')
                    continue
                
                # Create attendance record
                Attendance.objects.create(
                    student=student,
                    event=event,
                    checked_in_at=record['checkin_date']
                )
                self.stdout.write(f'Created attendance: {record["name"]} for {event.name}')
            else:
                self.stdout.write(f'Would create attendance: {record["name"]} for {event.name}')
            
            attendance_created += 1

        # Summary
        self.stdout.write(self.style.SUCCESS('\n=== IMPORT SUMMARY ==='))
        self.stdout.write(f'Events created: {events_created}')
        self.stdout.write(f'Events already existing: {events_existing}')
        self.stdout.write(f'Students created: {students_created}')
        self.stdout.write(f'Students updated: {students_updated}')
        self.stdout.write(f'Attendance records created: {attendance_created}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\nThis was a dry run. Use without --dry-run to make actual changes.'))
