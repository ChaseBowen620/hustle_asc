"""
Delete the 53 events that were created by audit_onetap_attendance (and their
cascade-deleted attendances). Use after a mistaken import to undo.
"""
from django.core.management.base import BaseCommand
from api.models import Event

# Exact names of the 53 events created by the audit run (organization=ASC)
AUDIT_CREATED_EVENT_NAMES = [
    "11/17 Maker Monday",
    "12/1 Maker Monday",
    "ASC - Innovation Lab",
    "ASC - Maker Monday",
    "ASC Fall Opening Social",
    "ASC Innovation Lab",
    "ASC Maker Monday",
    "ASC Open Forum (Sept 26)",
    "ASC Opening Social",
    "ASC Weekly Innovation Lab",
    "ASC Weekly Innovation Lab  (December 4th)",
    "ASC Weekly Innovation Lab  (November 13th)",
    "ASC Weekly Innovation Lab  (November 6th)",
    "ASC Weekly Innovation Lab  (October 16th)",
    "ASC Weekly Innovation Lab  (October 23rd)",
    "ASC Weekly Innovation Lab  (October 2nd)",
    "ASC Weekly Innovation Lab  (October 30th)",
    "ASC Weekly Innovation Lab  (October 9th)",
    "ASC Weekly Innovation Lab  (September 11th)",
    "ASC Weekly Innovation Lab  (September 18th)",
    "ASC Weekly Innovation Lab  (September 25th)",
    "ASC Weekly Innovation Lab  (September 4th)",
    "BOT Galentines",
    "BOT Vision Boards",
    "Five-Slide Friday",
    "Innovation Lab",
    "Innovation Lab (September 12th)",
    "Innovation Lab (September 26th)",
    "Innovation Lab (September 5th)",
    "Innovation Lab - Oct 17",
    "Innovation Lab - October 24",
    "Innovation Lab - October 31",
    "Maker Monday",
    "Maker Monday 11/24",
    "Maker Monday: Vibe Coding — Myth or Magic?",
    "Open Forum",
    "Open Forum - October 17",
    "Open Forum - September 12",
    "PyData",
    "SOC (February 11th)",
    "SOC (February 4th)",
    "SOC (January 14th)",
    "SOC (January 21st)",
    "SOC (January 28th)",
    "SOC (January 7th)",
    "SOC (November 12th)",
    "SOC (November 19th)",
    "SOC (November 5th)",
    "SOC (October 22nd)",
    "SOC (October 29th)",
    "SOC - Weekly Club Meeting",
    "SOC - Weekly Club Meeting (August 27th)",
    "Sports Analytics Club: Ryan Hammer",
]


class Command(BaseCommand):
    help = 'Delete the 53 events created by audit_onetap_attendance (and their attendances)'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Show what would be deleted')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no deletions'))

        # Delete by name; keep scope to ASC to avoid touching other orgs
        to_delete = Event.objects.filter(
            name__in=AUDIT_CREATED_EVENT_NAMES,
            organization='ASC',
        )
        count = to_delete.count()
        if count == 0:
            self.stdout.write('No matching events found.')
            return
        if dry_run:
            self.stdout.write(f'Would delete {count} events (and their attendances):')
            for e in to_delete.order_by('name')[:20]:
                self.stdout.write(f'  - {e.name} (id={e.id}, date={e.date})')
            if count > 20:
                self.stdout.write(f'  ... and {count - 20} more')
            return
        deleted, _ = to_delete.delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} objects (events + cascade attendances).'))
