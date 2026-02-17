"""
Import a single OneTap list export CSV or XLSX into the database.

Expected columns: Name, Email, Checked In, Check-in Date, A-Number (and optionally Phone).
- Only processes rows where "Checked In" = Yes
- Creates or finds the event (by --event-name and date from file)
- Creates or finds each student, then adds attendance for that event
- Supports .csv (multiple encodings) and .xlsx (Excel) files.
"""
import csv
import os
import re
from datetime import datetime
from django.core.management.base import BaseCommand
from api.models import Event, Attendance, Organization
from api.onetap_webhook_handler import create_or_find_student, create_or_find_event


def _is_xlsx(path):
    """Return True if file is Excel (OOXML) by content or extension."""
    if (path or '').lower().endswith('.xlsx'):
        return True
    try:
        with open(path, 'rb') as f:
            return f.read(2) == b'PK'
    except Exception:
        return False


def _iter_rows_from_xlsx(path):
    """Yield dicts from first sheet of an xlsx (first row = headers). Path may have .csv extension."""
    import openpyxl
    with open(path, 'rb') as f:
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        return
    headers = [str(h).strip() if h is not None else '' for h in rows[0]]
    for row in rows[1:]:
        yield dict(zip(headers, [str(v).strip() if v is not None else '' for v in row]))


def parse_full_name(full_name):
    full_name = (full_name or '').strip()
    if not full_name:
        return '', '[Unknown]'
    parts = full_name.split()
    if len(parts) == 1:
        return parts[0], '[Unknown]'
    return parts[0], ' '.join(parts[1:])


def normalize_a_number(raw):
    raw = (raw or '').strip().lower()
    if not raw:
        return ''
    if raw.startswith('a') and len(raw) == 9 and raw[1:].isdigit():
        return raw
    if raw.isdigit() and len(raw) == 8:
        return 'a' + raw
    return raw


def parse_checkin_date(s):
    from dateutil.parser import parse as dateutil_parse
    s = (s or '').strip()
    if not s:
        return None
    try:
        dt = dateutil_parse(s)
        if getattr(dt, 'tzinfo', None) is not None:
            dt = dt.replace(tzinfo=None)
        return dt
    except Exception:
        return None


def event_name_from_filename(path):
    """e.g. _list_sports_analytics_club_ryan_hammer_16-feb-2026.csv -> Sports Analytics Club: Ryan Hammer"""
    basename = os.path.basename(path).replace('.csv', '').replace('.xlsx', '')
    if basename.startswith('_list_'):
        rest = basename[6:]  # drop _list_
        # remove trailing _DD-mon-YYYY or _YYYY-MM-DD
        rest = re.sub(r'_\d{4}-\d{2}-\d{2}$', '', rest)
        rest = re.sub(r'_\d{1,2}-[a-z]{3}-\d{4}$', '', rest, flags=re.I)
        # replace underscores with spaces, then title case
        name = rest.replace('_', ' ').strip().title()
        if name:
            return name
    return 'Imported Event'


class Command(BaseCommand):
    help = 'Import a single OneTap list export CSV (Name, Email, Checked In, Check-in Date, A-Number)'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the CSV')
        parser.add_argument('--event-name', type=str, default=None, help='Event name (default: from filename)')
        parser.add_argument('--organization', type=str, default='ASC', help='Organization for the event')
        parser.add_argument('--dry-run', action='store_true', help='Do not write to DB')

    def handle(self, *args, **options):
        csv_path = options['csv_file']
        event_name = (options['event_name'] or '').strip() or event_name_from_filename(csv_path)
        org_name = (options['organization'] or 'ASC').strip()
        dry_run = options['dry_run']

        if not os.path.exists(csv_path):
            self.stdout.write(self.style.ERROR(f'File not found: {csv_path}'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no changes'))

        Organization.objects.get_or_create(name=org_name)

        records = []
        if _is_xlsx(csv_path):
            try:
                for row in _iter_rows_from_xlsx(csv_path):
                    if (row.get('Checked In') or '').strip() != 'Yes':
                        continue
                    checkin_val = row.get('Check-in Date') or ''
                    if checkin_val and hasattr(checkin_val, 'strftime'):
                        from datetime import datetime as dt_type
                        if hasattr(checkin_val, 'replace') and getattr(checkin_val, 'tzinfo', None) is not None:
                            checkin_date = checkin_val.replace(tzinfo=None)
                        else:
                            checkin_date = checkin_val if hasattr(checkin_val, 'hour') else dt_type.combine(checkin_val, dt_type.min.time())
                    else:
                        checkin_date = parse_checkin_date(str(checkin_val).strip() if checkin_val else '')
                    if not checkin_date:
                        continue
                    full_name = (row.get('Name') or '').strip()
                    first_name, last_name = parse_full_name(full_name)
                    email = (row.get('Email') or '').strip()
                    a_number = normalize_a_number(row.get('A-Number') or '')
                    phone = (row.get('Phone') or '').strip()
                    if not email:
                        email = f'{a_number}@placeholder.import' if a_number else f'unknown.{first_name}.{last_name}@placeholder.import'.replace(' ', '.')[:60]
                    records.append({
                        'first_name': first_name,
                        'last_name': last_name,
                        'email': email,
                        'a_number': a_number,
                        'phone': phone,
                        'checkin_date': checkin_date,
                    })
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Failed to read XLSX: {e}'))
                return
        else:
            encodings = ('utf-8-sig', 'utf-8', 'cp1252', 'latin-1')
            for enc in encodings:
                try:
                    with open(csv_path, 'r', encoding=enc) as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            if (row.get('Checked In') or '').strip() != 'Yes':
                                continue
                            checkin_str = (row.get('Check-in Date') or '').strip()
                            if not checkin_str:
                                continue
                            checkin_date = parse_checkin_date(checkin_str)
                            if not checkin_date:
                                continue
                            full_name = (row.get('Name') or '').strip()
                            first_name, last_name = parse_full_name(full_name)
                            email = (row.get('Email') or '').strip()
                            a_number = normalize_a_number(row.get('A-Number') or '')
                            phone = (row.get('Phone') or '').strip()
                            if not email:
                                email = f'{a_number}@placeholder.import' if a_number else f'unknown.{first_name}.{last_name}@placeholder.import'.replace(' ', '.')[:60]
                            records.append({
                                'first_name': first_name,
                                'last_name': last_name,
                                'email': email,
                                'a_number': a_number,
                                'phone': phone,
                                'checkin_date': checkin_date,
                            })
                    break
                except (UnicodeDecodeError, UnicodeError):
                    records = []
                    continue
            else:
                self.stdout.write(self.style.ERROR('Could not decode CSV (tried utf-8, cp1252, latin-1)'))
                return

        if not records:
            self.stdout.write(self.style.WARNING('No rows with Checked In=Yes and valid Check-in Date.'))
            return

        date_only = records[0]['checkin_date'].date()
        event_datetime = datetime.combine(date_only, datetime.min.time().replace(hour=12, minute=0, second=0))

        if dry_run:
            self.stdout.write(f'Would create/find event: {event_name} ({date_only})')
            self.stdout.write(f'Would add {len(records)} attendance record(s).')
            return

        event = create_or_find_event(
            event_name,
            event_datetime,
            f'{event_name} (imported from list CSV)',
            primary_org_name=org_name,
        )
        created = 0
        existing = 0
        for rec in records:
            student = create_or_find_student(
                rec['first_name'],
                rec['last_name'],
                rec['email'],
                rec['a_number'] or None,
                rec.get('phone') or '',
            )
            att, is_new = Attendance.objects.get_or_create(
                student=student,
                event=event,
                defaults={'checked_in_at': rec['checkin_date']},
            )
            if is_new:
                created += 1
                if att.checked_in_at != rec['checkin_date']:
                    Attendance.objects.filter(pk=att.pk).update(checked_in_at=rec['checkin_date'])
            else:
                existing += 1

        self.stdout.write(self.style.SUCCESS(f'Event: {event.name} (id={event.id})'))
        self.stdout.write(f'Attendance created: {created}, already existing: {existing}')
        self.stdout.write(self.style.SUCCESS('Done.'))
