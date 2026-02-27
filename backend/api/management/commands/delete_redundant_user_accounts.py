"""
Delete redundant User accounts (old student accounts).
Students no longer have linked User accounts; these rows are unused.
Keeps staff/superuser accounts so you can still log into Django admin.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Delete User accounts that are not staff/superuser (redundant former student accounts)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only show what would be deleted.",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Delete ALL users (including staff/superuser). Use only if you will run createsuperuser after.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        delete_all = options["all"]

        if delete_all:
            qs = User.objects.all()
            label = "all users"
        else:
            qs = User.objects.filter(is_staff=False, is_superuser=False)
            label = "redundant (non-staff, non-superuser) users"

        count = qs.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS(f"No {label} to delete."))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING(f"Would delete {count} {label}."))
            for u in qs[:20]:
                self.stdout.write(f"  - id={u.id} username={u.username}")
            if count > 20:
                self.stdout.write(f"  ... and {count - 20} more.")
            return

        deleted, _ = qs.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} {label}."))
