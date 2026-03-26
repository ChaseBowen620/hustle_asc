"""
Permission that requires a valid CSRF token for unauthenticated POST/PUT/PATCH/DELETE.
Used for public scan endpoints so requests must come from the frontend (cookie + X-CSRFToken).
"""
from rest_framework.permissions import BasePermission
from django.utils.crypto import constant_time_compare


class AllowAnyWithCSRFForUnsafe(BasePermission):
    """
    Allow all GET/HEAD/OPTIONS. For POST/PUT/PATCH/DELETE:
    - If the user is authenticated (e.g. JWT), allow.
    - Otherwise require a valid CSRF token (X-CSRFToken header matching csrftoken cookie).
    """
    message = "CSRF token missing or invalid. Load the scan page in a browser to get a token."

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        if request.user and request.user.is_authenticated:
            return True
        token_header = request.META.get("HTTP_X_CSRFTOKEN", "").strip()
        # Compare against the actual csrftoken cookie value from the request.
        # Using get_token() here can produce a different per-request masked value.
        cookie_token = (request.COOKIES.get("csrftoken") or "").strip()
        if not token_header or not cookie_token:
            return False
        return constant_time_compare(token_header, cookie_token)
