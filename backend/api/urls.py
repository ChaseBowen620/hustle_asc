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
    get_user_details
)

router = DefaultRouter()
router.register(r'students', StudentViewSet)
router.register(r'events', EventViewSet)
router.register(r'attendance', AttendanceViewSet)
router.register(r'semesters', SemesterViewSet)
router.register(r'professors', ProfessorViewSet)
router.register(r'classes', ClassViewSet)
router.register(r'teaching-assistants', TeachingAssistantViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('user/me/', get_user_details, name='user-details'),
]