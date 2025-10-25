from django.contrib import admin
from .models import Student, Event, Attendance, Semester, Professor, Class, TeachingAssistant, AdminUser

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('id', 'first_name', 'last_name', 'email', 'total_points', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('id', 'first_name', 'last_name', 'email', 'user__username')

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'organization', 'event_type', 'date', 'location', 'has_passed')
    list_filter = ('date', 'organization', 'event_type')
    search_fields = ('id', 'name', 'location', 'organization', 'event_type')
    list_editable = ('organization', 'event_type')

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'event', 'checked_in_at')
    list_filter = ('event', 'checked_in_at')
    search_fields = ('id', 'student__id', 'event__id')

@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ('id', 'season', 'year', 'is_current')
    list_filter = ('season', 'year', 'is_current')
    search_fields = ('id', 'season', 'year')

@admin.register(Professor)
class ProfessorAdmin(admin.ModelAdmin):
    list_display = ('id', 'first_name', 'last_name')
    search_fields = ('id', 'first_name', 'last_name')

@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ('id', 'course_code', 'professor', 'semester')
    list_filter = ('semester', 'professor')
    search_fields = ('id', 'course_code')

@admin.register(TeachingAssistant)
class TeachingAssistantAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'class_assigned', 'points_awarded')
    list_filter = ('class_assigned__semester', 'class_assigned__professor')
    search_fields = ('id', 'student__id', 'class_assigned__id')

@admin.register(AdminUser)
class AdminUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'first_name', 'last_name', 'role', 'user', 'created_at')
    list_filter = ('role', 'created_at')
    search_fields = ('id', 'first_name', 'last_name', 'role', 'user__username', 'user__email')
    list_editable = ('role',)

