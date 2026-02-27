from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import Student, Event, Attendance, EventOrganization, Organization

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('id', 'first_name', 'last_name', 'a_number', 'total_points', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('id', 'first_name', 'last_name', 'a_number')

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'organization', 'date', 'has_passed')
    list_filter = ('date', 'organization')
    search_fields = ('id', 'name', 'organization')
    list_editable = ('organization',)
    fields = ('name', 'organization', 'date', 'is_recurring', 'recurrence_type')

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'event', 'checked_in_at')
    list_filter = ('event', 'checked_in_at')
    search_fields = ('id', 'student__id', 'event__id')

@admin.register(EventOrganization)
class EventOrganizationAdmin(admin.ModelAdmin):
    list_display = ('id', 'event_id', 'organization', 'created_at')
    list_filter = ('organization', 'created_at')
    search_fields = ('id', 'event__id', 'event__name', 'organization__name')
    list_editable = ('organization',)
    
    def event_id(self, obj):
        """Display the Event ID (primary key) instead of event name"""
        return obj.event.id
    event_id.short_description = 'Event ID'

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

