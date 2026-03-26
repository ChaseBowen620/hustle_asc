import fcntl
import logging
import os
import sys
from pathlib import Path

from django.apps import AppConfig

logger = logging.getLogger(__name__)

# Keep lock file open for the process lifetime so only one worker runs the scheduler.
_scheduler_lock_file = None

# Do not start background scheduler for these manage.py subcommands.
_SKIP_SCHEDULER_MANAGE_COMMANDS = frozenset(
    {
        "migrate",
        "makemigrations",
        "test",
        "shell",
        "collectstatic",
        "flush",
        "createsuperuser",
        "dumpdata",
        "loaddata",
        "check",
        "dbshell",
        "compilemessages",
        "makemessages",
    }
)


def _should_start_scheduler():
    from django.conf import settings

    if not getattr(settings, "ENABLE_DAILY_EVENT_CLEANUP_SCHEDULER", True):
        return False
    if "pytest" in sys.modules:
        return False

    argv0 = sys.argv[0] if sys.argv else ""
    if len(sys.argv) > 1 and argv0.endswith("manage.py"):
        sub = sys.argv[1]
        if sub in _SKIP_SCHEDULER_MANAGE_COMMANDS:
            return False
        # runserver: parent imports before autoreload child; only child should schedule
        if sub == "runserver" and os.environ.get("RUN_MAIN") != "true":
            return False

    return True


def _start_daily_event_cleanup_scheduler():
    global _scheduler_lock_file

    from django.conf import settings

    lock_path = Path(settings.BASE_DIR) / ".event_cleanup_scheduler.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock_file = open(lock_path, "w")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock_file.close()
        logger.debug(
            "event_cleanup: another process holds the scheduler lock; skipping APScheduler"
        )
        return

    _scheduler_lock_file = lock_file

    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    from django.db import close_old_connections

    from api.event_cleanup import run_delete_events_no_attendance_after_day

    def job():
        close_old_connections()
        try:
            result = run_delete_events_no_attendance_after_day(dry_run=False)
            if result["to_delete_count"] and result.get("deleted_total", 0):
                logger.info(
                    "event_cleanup: removed %s DB row(s) for empty past events; %s",
                    result["deleted_total"],
                    result.get("details"),
                )
        except Exception:
            logger.exception("event_cleanup: scheduled job failed")
        finally:
            close_old_connections()

    scheduler = BackgroundScheduler(timezone="America/Denver")
    scheduler.add_job(
        job,
        CronTrigger(hour=0, minute=5, timezone="America/Denver"),
        id="delete_events_no_attendance_after_day",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "event_cleanup: APScheduler started (daily at 00:05 America/Denver)"
    )


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"

    def ready(self):
        if not _should_start_scheduler():
            return
        try:
            _start_daily_event_cleanup_scheduler()
        except Exception:
            logger.exception("event_cleanup: failed to start daily scheduler")
