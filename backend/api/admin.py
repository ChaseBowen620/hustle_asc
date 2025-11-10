from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import Student, Event, Attendance, Semester, Professor, Class, TeachingAssistant, AdminUser, EventOrganization, Organization

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

@admin.register(EventOrganization)
class EventOrganizationAdmin(admin.ModelAdmin):
    list_display = ('id', 'event', 'organization', 'created_at')
    list_filter = ('organization', 'created_at')
    search_fields = ('id', 'event__name', 'organization')
    list_editable = ('organization',)

@admin.register(AdminUser)
class AdminUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'first_name', 'last_name', 'role', 'user', 'created_at')
    list_filter = ('role', 'created_at')
    search_fields = ('id', 'first_name', 'last_name', 'role', 'user__username', 'user__email')
    list_editable = ('role',)

@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'created_at', 'updated_at')
    list_filter = ('created_at',)
    search_fields = ('id', 'name')
    list_editable = ('name',)

# Custom User Admin to show email field prominently
class UserAdmin(BaseUserAdmin):
    # Fields to show in the add form
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('first_name', 'last_name', 'email', 'password1', 'password2'),
        }),
    )
    
    # Fields to show in the change form
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'email')}),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

# Unregister the default User admin and register our custom one
admin.site.unregister(User)
admin.site.register(User, UserAdmin)

