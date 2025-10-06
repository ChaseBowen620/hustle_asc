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
    EventTypeViewSet,
    get_user_details,
    total_students,
    participating_students,
    student_points,
    attendance_overview
)
from .webhook_views import attendance_webhook, webhook_status, secure_attendance_webhook
from .onetap_webhook_views import onetap_webhook, onetap_webhook_status
from .unified_webhook_views import unified_webhook, unified_webhook_status

router = DefaultRouter()
router.register(r'students', StudentViewSet)
router.register(r'events', EventViewSet)
router.register(r'attendance', AttendanceViewSet)
router.register(r'semesters', SemesterViewSet)
router.register(r'professors', ProfessorViewSet)
router.register(r'classes', ClassViewSet)
router.register(r'teaching-assistants', TeachingAssistantViewSet)
router.register(r'event-types', EventTypeViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('user/me/', get_user_details, name='user-details'),
    path('students/total/', total_students, name='total-students'),
    path('students/participating/', participating_students, name='participating-students'),
    path('students/points/', student_points, name='student-points'),
    path('attendance/overview/', attendance_overview, name='attendance-overview'),
    
    # Webhook endpoints
    path('webhook/attendance/', attendance_webhook, name='attendance-webhook'),
    path('webhook/attendance/secure/', secure_attendance_webhook, name='secure-attendance-webhook'),
    path('webhook/status/', webhook_status, name='webhook-status'),
    
    # OneTap webhook endpoints
    path('webhook/onetap/', onetap_webhook, name='onetap-webhook'),
    path('webhook/onetap/status/', onetap_webhook_status, name='onetap-webhook-status'),
    
    # Unified webhook endpoints
    path('webhook/unified/', unified_webhook, name='unified-webhook'),
    path('webhook/unified/status/', unified_webhook_status, name='unified-webhook-status'),
]