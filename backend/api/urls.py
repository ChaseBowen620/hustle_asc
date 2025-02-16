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
]