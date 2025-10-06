import csv
import os
from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from api.models import Event, EventType


class Command(BaseCommand):
    help = 'Import events from CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the CSV file')

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        
        if not os.path.exists(csv_file):
            raise CommandError(f'CSV file "{csv_file}" does not exist')

        # Get the absolute path
        csv_path = os.path.abspath(csv_file)
        
        self.stdout.write(f'Importing events from: {csv_path}')
        
        imported_count = 0
        error_count = 0
        
        with open(csv_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 because of header
                try:
                    # Debug: Print the row keys to see what's available
                    if row_num == 2:  # Only print for first row
                        self.stdout.write(f'Available columns: {list(row.keys())}')
                    
                    # Parse the date from M/D/YYYY format
                    date_str = row.get('date', '').strip()
                    if not date_str:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Empty date, skipping')
                        )
                        error_count += 1
                        continue
                    
                    # Parse date in M/D/YYYY format
                    try:
                        parsed_date = datetime.strptime(date_str, '%m/%d/%Y')
                        # Convert to timezone-aware datetime (assuming UTC for now)
                        event_date = timezone.make_aware(parsed_date)
                    except ValueError:
                        self.stdout.write(
                            self.style.ERROR(f'Row {row_num}: Invalid date format "{date_str}". Expected M/D/YYYY')
                        )
                        error_count += 1
                        continue
                    
                    # Get event type (handle BOM in column name)
                    event_type_id = row.get('\ufeffevent_type_id', row.get('event_type_id', '')).strip()
                    if not event_type_id:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Empty event_type_id, skipping')
                        )
                        error_count += 1
                        continue
                    
                    try:
                        event_type = EventType.objects.get(id=int(event_type_id))
                    except (ValueError, EventType.DoesNotExist):
                        self.stdout.write(
                            self.style.ERROR(f'Row {row_num}: Invalid event_type_id "{event_type_id}"')
                        )
                        error_count += 1
                        continue
                    
                    # Get other fields
                    name = row.get('name', '').strip()
                    if not name:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Empty name, skipping')
                        )
                        error_count += 1
                        continue
                    
                    description = row.get('description', '').strip() if row.get('description') else ''
                    location = row.get('location', '').strip() if row.get('location') else 'TBD'  # Default location
                    
                    # Parse points
                    try:
                        points = int(row.get('points', '1')) if row.get('points', '').strip() else 1
                    except ValueError:
                        self.stdout.write(
                            self.style.WARNING(f'Row {row_num}: Invalid points "{row.get("points", "")}", using default 1')
                        )
                        points = 1
                    
                    # Create the event
                    event = Event.objects.create(
                        event_type=event_type,
                        name=name,
                        description=description,
                        date=event_date,
                        location=location,
                        points=points
                    )
                    
                    imported_count += 1
                    self.stdout.write(f'✓ Imported: {name} ({event_date.strftime("%m/%d/%Y")})')
                    
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Row {row_num}: Error importing event: {str(e)}')
                    )
                    error_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nImport completed!\n'
                f'Successfully imported: {imported_count} events\n'
                f'Errors: {error_count} events'
            )
        )
