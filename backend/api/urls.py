from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StudentViewSet,
    EventViewSet,
    AttendanceViewSet,
    total_students,
    participating_students,
    student_points,
    attendance_overview,
    search_students,
    no_attendance_in_period,
    events_before,
    student_duplicates,
    student_merge_duplicates,
    list_organizations,
    manage_organization,
    public_scan_csrf_cookie,
    public_scan_events,
    public_scan_student_lookup,
    public_scan_checkin,
)
from .debug_webhook_views import debug_webhook, debug_webhook_status
from .onetap_webhook_handler import onetap_webhook_handler, onetap_webhook_status

router = DefaultRouter()
router.register(r'students', StudentViewSet)
router.register(r'events', EventViewSet)
router.register(r'attendance', AttendanceViewSet)

urlpatterns = [
    # Custom endpoints must come before router to avoid conflicts
    path('students/no-attendance-in-period/', no_attendance_in_period, name='no-attendance-in-period'),
    path('students/duplicates/', student_duplicates, name='student-duplicates'),
    path('students/merge-duplicates/', student_merge_duplicates, name='student-merge-duplicates'),
    path('students/total/', total_students, name='total-students'),
    path('students/participating/', participating_students, name='participating-students'),
    path('students/points/', student_points, name='student-points'),
    path('events/before/', events_before, name='events-before'),
    path('attendance/overview/', attendance_overview, name='attendance-overview'),
    path('students/search/', search_students, name='search-students'),
    path('organizations/', list_organizations, name='list-organizations'),
    path('organizations/<int:organization_id>/', manage_organization, name='manage-organization'),
    # Public scan (QR check-in; no auth)
    path('public/scan/csrf/', public_scan_csrf_cookie, name='public-scan-csrf'),
    path('public/scan/events/', public_scan_events, name='public-scan-events'),
    path('public/scan/student/', public_scan_student_lookup, name='public-scan-student'),
    path('public/scan/checkin/', public_scan_checkin, name='public-scan-checkin'),
    path('', include(router.urls)),
    
    # Debug webhook endpoint (temporary - for diagnosing OneTap issues)
    path('webhook/debug/', debug_webhook, name='debug-webhook'),
    path('webhook/debug/status/', debug_webhook_status, name='debug-webhook-status'),
    
    # OneTap webhook handler (for actual OneTap integration)
    path('webhook/onetap-handler/', onetap_webhook_handler, name='onetap-webhook-handler'),
    path('webhook/onetap-handler/status/', onetap_webhook_status, name='onetap-webhook-handler-status'),
]