"""
Timezone utilities for normalizing check-in times to Mountain Time (America/Denver).
"""
from datetime import datetime
from zoneinfo import ZoneInfo

from django.utils import timezone


# Mountain Time (handles MST and MDT)
MOUNTAIN_TZ = ZoneInfo("America/Denver")


def normalize_checkin_to_mountain(dt=None):
    """
    Normalize a check-in datetime to Mountain Time (America/Denver).

    - If dt is None, uses current time (UTC).
    - If dt is naive, assumes it is UTC and makes it timezone-aware.
    - Returns a timezone-aware datetime in America/Denver (same instant).
    Django will store this as UTC in the database when USE_TZ is True.
    """
    if dt is None:
        dt = timezone.now()
    if dt.tzinfo is None:
        # Naive datetime: assume UTC (e.g. server local time or ISO "Z")
        dt = timezone.make_aware(dt, timezone.utc)
    # Convert to Mountain Time (same instant, correct for display/storage)
    return dt.astimezone(MOUNTAIN_TZ)
