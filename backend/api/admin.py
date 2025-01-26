from django.contrib import admin
from .models import Student, Event, Attendance, Semester, Professor, Class, TeachingAssistant

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'email', 'total_points', 'created_at')
    search_fields = ('first_name', 'last_name', 'email')

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('name', 'date', 'location', 'points', 'has_passed')
    list_filter = ('date',)
    search_fields = ('name', 'location')

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('student', 'event', 'checked_in_at')
    list_filter = ('event', 'checked_in_at')

@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ('season', 'year', 'is_current')
    list_filter = ('season', 'year', 'is_current')
    search_fields = ('season', 'year')

@admin.register(Professor)
class ProfessorAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name')
    search_fields = ('first_name', 'last_name')

@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ('course_code', 'professor', 'semester')
    list_filter = ('semester', 'professor')
    search_fields = ('course_code',)

@admin.register(TeachingAssistant)
class TeachingAssistantAdmin(admin.ModelAdmin):
    list_display = ('student', 'class_assigned', 'points_awarded')
    list_filter = ('class_assigned__semester', 'class_assigned__professor')
    search_fields = ('student__first_name', 'student__last_name', 'class_assigned__course_code')

