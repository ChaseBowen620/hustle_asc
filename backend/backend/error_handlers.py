"""
Custom error handlers so API requests get JSON errors instead of HTML.
"""
import logging
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def custom_500(request):
    """Return JSON for 500 so API clients see a proper error body."""
    logger.exception("Unhandled exception (500)")
    return JsonResponse(
        {"error": "Internal server error."},
        status=500,
    )
