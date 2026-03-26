from django.http import HttpResponseNotFound


class HideApiFromDirectNavigationMiddleware:
    """
    Hide API endpoints from direct browser navigation.

    Requests from frontend JS (fetch/axios) are still allowed; only top-level
    document navigations to /api* are masked as 404.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path.rstrip("/")
        is_api_path = path == "/api" or path.startswith("/api/")
        if is_api_path and request.method in ("GET", "HEAD"):
            sec_fetch_mode = (request.META.get("HTTP_SEC_FETCH_MODE") or "").lower()
            sec_fetch_dest = (request.META.get("HTTP_SEC_FETCH_DEST") or "").lower()
            accept = (request.META.get("HTTP_ACCEPT") or "").lower()

            is_browser_navigation = (
                sec_fetch_mode == "navigate"
                or sec_fetch_dest == "document"
                or "text/html" in accept
            )
            if is_browser_navigation:
                return HttpResponseNotFound("Not Found")

        return self.get_response(request)
