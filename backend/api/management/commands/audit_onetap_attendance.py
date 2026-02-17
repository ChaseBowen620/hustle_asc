"""
Audit OneTap attendance CSV and add any missing students, events, and attendances
to the SQLite database.

CSV columns: name, email, A-Number, listName, checkedIn, checkInDate
- Only processes rows where checkedIn = Yes
- Converts full name to first_name and last_name (last_name = [Unknown] if no space)
- If student already in system, existing name is kept
- Matches attendances to existing events by name + date (±1 day for UTC/MST).
"""
import csv
import os
import re
from collections import Counter
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth.models import User
from django.db.models import Q
from api.models import Event, Student, Attendance, Organization
from api.onetap_webhook_handler import create_or_find_student, create_or_find_event


def parse_full_name(full_name):
    """Convert full name to (first_name, last_name). No last name -> [Unknown]."""
    full_name = (full_name or '').strip()
    if not full_name:
        return '', '[Unknown]'
    parts = full_name.split()
    if len(parts) == 1:
        return parts[0], '[Unknown]'
    return parts[0], ' '.join(parts[1:])


def normalize_a_number(raw):
    """Strip and lowercase; ensure a + 8 digits format for lookup."""
    raw = (raw or '').strip().lower()
    if not raw:
        return ''
    # Accept A02517885 or a02517885
    if raw.startswith('a') and len(raw) == 9 and raw[1:].isdigit():
        return raw
    # If it's 8 digits, prepend 'a'
    if raw.isdigit() and len(raw) == 8:
        return 'a' + raw
    return raw


def parse_checkin_date(s):
    """Parse checkInDate e.g. '2026-02-13 01:32PM -07:00'. Return naive datetime for USE_TZ=False."""
    from dateutil.parser import parse as dateutil_parse
    s = (s or '').strip()
    if not s:
        return None
    try:
        dt = dateutil_parse(s)
        if getattr(dt, 'tzinfo', None) is not None:
            dt = dt.replace(tzinfo=None)  # SQLite with USE_TZ=False
        return dt
    except Exception:
        return None


def normalize_event_name(name):
    """Normalize for matching: strip, collapse spaces."""
    if not name:
        return ''
    return ' '.join((name or '').strip().split())


def find_existing_event(event_name, date_only, org_name=None):
    """
    Find an existing event by name (exact or normalized) and date within ±1 day
    (handles UTC vs MST / next-day). Returns Event or None.
    """
    if not event_name or not date_only:
        return None
    day_before = date_only - timedelta(days=1)
    day_after = date_only + timedelta(days=1)
    name_norm = normalize_event_name(event_name)
    qs = Event.objects.filter(
        Q(date__date__gte=day_before) & Q(date__date__lte=day_after)
    )
    if org_name:
        qs = qs.filter(organization=org_name)
    # Exact name match first
    exact = qs.filter(name=event_name).first()
    if exact:
        return exact
    # Normalized match (collapse spaces, strip)
    for e in qs:
        if normalize_event_name(e.name) == name_norm:
            return e
    return None


class Command(BaseCommand):
    help = 'Audit OneTap attendance CSV and add missing students, events, and attendances'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the OneTap attendance CSV')
        parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
        parser.add_argument('--organization', type=str, default='ASC', help='Organization name for new events')

    def handle(self, *args, **options):
        csv_path = options['csv_file']
        dry_run = options['dry_run']
        org_name = (options['organization'] or 'ASC').strip()

        if not os.path.exists(csv_path):
            self.stdout.write(self.style.ERROR(f'CSV file not found: {csv_path}'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))

        # Ensure organization exists
        if not dry_run:
            Organization.objects.get_or_create(name=org_name)

        # Parse CSV: only checkedIn = Yes
        records = []
        unique_events = set()
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if (row.get('checkedIn') or '').strip() != 'Yes':
                    continue
                checkin_date = parse_checkin_date(row.get('checkInDate') or '')
                if not checkin_date:
                    self.stdout.write(self.style.WARNING(f'Skipping row with invalid date: {row.get("checkInDate")}'))
                    continue
                event_name = (row.get('listName') or '').strip()
                if not event_name:
                    continue
                full_name = (row.get('name') or '').strip()
                first_name, last_name = parse_full_name(full_name)
                email = (row.get('email') or '').strip()
                a_number = normalize_a_number(row.get('A-Number') or '')
                # Placeholder email if missing (so we can still create user)
                if not email:
                    if a_number:
                        email = f'{a_number}@placeholder.audit'
                    else:
                        email = f'unknown.{first_name}.{last_name}@placeholder.audit'.replace(' ', '.').replace('[Unknown]', 'unknown')[:60]
                records.append({
                    'first_name': first_name,
                    'last_name': last_name,
                    'email': email,
                    'a_number': a_number,
                    'event_name': event_name,
                    'checkin_date': checkin_date,
                    'date_only': checkin_date.date(),
                })
                unique_events.add(event_name)

        self.stdout.write(f'Parsed {len(records)} attendance rows (checkedIn=Yes), {len(unique_events)} unique events')

        # Unique (event_name, date_only) from records; match to existing events by name + date (±1 day)
        event_map = {}  # (event_name, date_only) -> Event or None (would create)
        events_created = 0
        events_matched = 0
        unique_pairs = set((r['event_name'], r['date_only']) for r in records)
        for event_name, date_only in sorted(unique_pairs):
            existing = find_existing_event(event_name, date_only, org_name)
            if existing:
                event_map[(event_name, date_only)] = existing
                events_matched += 1
                continue
            # No match: would create or do create
            event_datetime = datetime.combine(date_only, datetime.min.time().replace(hour=12, minute=0, second=0))
            if not dry_run:
                event = create_or_find_event(
                    event_name,
                    event_datetime,
                    f'{event_name} (imported from OneTap)',
                    primary_org_name=org_name,
                )
                event_map[(event_name, date_only)] = event
                events_created += 1
                self.stdout.write(f'Created event: {event_name} ({date_only})')
            else:
                event_map[(event_name, date_only)] = None
                events_created += 1

        self.stdout.write(f'Events: {events_matched} matched by name+date (±1 day), {events_created} would create / created')

        # Process each record: get or create student, then attendance
        attendance_created = 0
        attendance_existing = 0
        attendance_no_event = 0  # dry run: would create but no event (counted in events_created)
        errors = 0
        for rec in records:
            try:
                key = (rec['event_name'], rec['date_only'])
                event = event_map.get(key)
                if dry_run:
                    if event:
                        attendance_created += 1  # would create or already exists; we don't check DB in dry run
                    else:
                        attendance_no_event += 1
                    continue
                if not event:
                    errors += 1
                    continue
                student = create_or_find_student(
                    rec['first_name'],
                    rec['last_name'],
                    rec['email'],
                    rec['a_number'] or None,
                    '',
                )
                att, created = Attendance.objects.get_or_create(
                    student=student,
                    event=event,
                    defaults={'checked_in_at': rec['checkin_date']},
                )
                if created:
                    attendance_created += 1
                    # Set check-in time (defaults may override)
                    if att.checked_in_at != rec['checkin_date']:
                        Attendance.objects.filter(pk=att.pk).update(checked_in_at=rec['checkin_date'])
                else:
                    attendance_existing += 1
            except Exception as e:
                errors += 1
                self.stdout.write(self.style.ERROR(f'Error: {rec.get("first_name","")} {rec.get("last_name","")}: {e}'))

        self.stdout.write(self.style.SUCCESS('\n=== AUDIT SUMMARY ==='))
        self.stdout.write(f'Events: {events_matched} matched by name+date, {events_created} would create / created')
        self.stdout.write(f'Attendance created: {attendance_created}')
        self.stdout.write(f'Attendance already existing: {attendance_existing}')
        if dry_run and attendance_no_event:
            self.stdout.write(f'Rows with no matching event (would create event first): {attendance_no_event}')
        self.stdout.write(f'Errors: {errors}')
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no changes were made. Run without --dry-run to apply.'))
