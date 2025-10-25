from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StudentViewSet, 
    EventViewSet, 
    AttendanceViewSet,
    SemesterViewSet,
    ProfessorViewSet,
    ClassViewSet,
    TeachingAssistantViewSet,
    get_user_details,
    change_password,
    total_students,
    participating_students,
    student_points,
    attendance_overview
)
from .debug_webhook_views import debug_webhook, debug_webhook_status
from .onetap_webhook_handler import onetap_webhook_handler, onetap_webhook_status

router = DefaultRouter()
router.register(r'students', StudentViewSet)
router.register(r'events', EventViewSet)
router.register(r'attendance', AttendanceViewSet)
router.register(r'semesters', SemesterViewSet)
router.register(r'professors', ProfessorViewSet)
router.register(r'classes', ClassViewSet)
router.register(r'teaching-assistants', TeachingAssistantViewSet)

urlpatterns = [
    # Custom endpoints must come before router to avoid conflicts
    path('students/total/', total_students, name='total-students'),
    path('students/participating/', participating_students, name='participating-students'),
    path('students/points/', student_points, name='student-points'),
    path('attendance/overview/', attendance_overview, name='attendance-overview'),
    path('user/me/', get_user_details, name='user-details'),
    path('user/change-password/', change_password, name='change-password'),
    path('', include(router.urls)),
    
    # Debug webhook endpoint (temporary - for diagnosing OneTap issues)
    path('webhook/debug/', debug_webhook, name='debug-webhook'),
    path('webhook/debug/status/', debug_webhook_status, name='debug-webhook-status'),
    
    # OneTap webhook handler (for actual OneTap integration)
    path('webhook/onetap-handler/', onetap_webhook_handler, name='onetap-webhook-handler'),
    path('webhook/onetap-handler/status/', onetap_webhook_status, name='onetap-webhook-handler-status'),
]