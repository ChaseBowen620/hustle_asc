"""
Delete events that have zero attendances after the calendar day (America/Denver)
they are scheduled on has ended.

The same logic runs automatically every day at 00:05 America/Denver when the web app
is running (see api.apps.ApiConfig). Use this command for manual runs or dry-run.

With USE_TZ=False, Event.date is stored and interpreted as local time in TIME_ZONE
(America/Denver). "End of day" is start of the next calendar day at 00:00 Denver.
"""
from django.core.management.base import BaseCommand

from api.event_cleanup import run_delete_events_no_attendance_after_day


class Command(BaseCommand):
    help = (
        "Delete events with no attendances after the scheduled day (America/Denver) has ended."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List events that would be deleted without deleting",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        result = run_delete_events_no_attendance_after_day(dry_run=dry_run)

        if result["to_delete_count"] == 0:
            self.stdout.write("No events to delete.")
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"DRY RUN — would delete {result['to_delete_count']} event(s):"
                )
            )
            for row in result["preview"]:
                self.stdout.write(
                    f"  id={row['id']} name={row['name']!r} date={row['date']} org={row['organization']}"
                )
            if result["to_delete_count"] > 50:
                self.stdout.write(f"  ... and {result['to_delete_count'] - 50} more")
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {result['deleted_total']} object(s) (events + cascaded rows). "
                f"Details: {result['details']}"
            )
        )
