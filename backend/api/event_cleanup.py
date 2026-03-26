"""
Delete events with zero attendances after the scheduled calendar day (America/Denver) ends.

Used by the management command and the daily in-process scheduler in apps.py.
"""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count

from api.models import Event

DENVER = ZoneInfo("America/Denver")


def now_denver_naive():
    """Wall clock in Denver as naive datetime (matches app storage convention)."""
    return datetime.now(DENVER).replace(tzinfo=None)


def start_of_next_day_after_event(event_date):
    """Midnight at the start of the calendar day after `event_date` (Denver)."""
    d = event_date.date() if hasattr(event_date, "date") else event_date
    return datetime.combine(d + timedelta(days=1), time.min)


def run_delete_events_no_attendance_after_day(dry_run=False):
    """
    Find events with no attendances whose scheduled Denver day has ended; delete unless dry_run.

    Returns a dict with:
      - dry_run: bool
      - to_delete_count: int
      - deleted_total: int (Django delete() first element; 0 if dry_run)
      - details: dict from delete() or None
      - preview: list of {id, name, date, organization} for dry_run (capped)
    """
    now = now_denver_naive()

    candidates = (
        Event.objects.annotate(attend_count=Count("attendances"))
        .filter(attend_count=0)
        .order_by("date", "id")
    )

    to_delete = []
    for event in candidates:
        cutoff = start_of_next_day_after_event(event.date)
        if now >= cutoff:
            to_delete.append(event)

    if not to_delete:
        return {
            "dry_run": dry_run,
            "to_delete_count": 0,
            "deleted_total": 0,
            "details": None,
            "preview": [],
        }

    preview = [
        {
            "id": e.id,
            "name": e.name,
            "date": e.date,
            "organization": e.organization,
        }
        for e in to_delete[:50]
    ]

    if dry_run:
        return {
            "dry_run": True,
            "to_delete_count": len(to_delete),
            "deleted_total": 0,
            "details": None,
            "preview": preview,
        }

    ids = [e.id for e in to_delete]
    deleted_total, details = Event.objects.filter(id__in=ids).delete()
    return {
        "dry_run": False,
        "to_delete_count": len(to_delete),
        "deleted_total": deleted_total,
        "details": details,
        "preview": preview,
    }
