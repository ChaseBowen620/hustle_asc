"""
Merge duplicate student accounts (same A-number or same name) into one per person.
Uses shared logic from api.duplicate_students for the actual merge.
"""
from django.core.management.base import BaseCommand
from api.duplicate_students import get_duplicate_groups, run_merge


class Command(BaseCommand):
    help = 'Merge duplicate student accounts (same A-number or same name) into one per person'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Only report what would be done')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no changes will be made\n'))
        log = []
        stats = run_merge(dry_run=dry_run, log=log)
        for msg in log:
            self.stdout.write('   ' + msg)
        self.stdout.write(self.style.SUCCESS(f'\nDone. Groups processed: {stats["groups_processed"]}, duplicate accounts merged: {stats["accounts_merged"]}'))
        if dry_run:
            self.stdout.write(self.style.WARNING('Run without --dry-run to apply merges.'))
