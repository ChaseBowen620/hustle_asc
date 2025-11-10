from rest_framework import serializers
from .models import Student, Event, Attendance, Semester, Professor, Class, TeachingAssistant, EventOrganization

class StudentSerializer(serializers.ModelSerializer):
    total_points = serializers.IntegerField(read_only=True)
    user = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = '__all__'
    
    def get_user(self, obj):
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'email': obj.user.email,
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name
        }

class EventOrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventOrganization
        fields = ['id', 'organization', 'created_at']

class EventSerializer(serializers.ModelSerializer):
    has_passed = serializers.BooleanField(read_only=True)
    event_organizations = EventOrganizationSerializer(many=True, read_only=True)
    organizations = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        help_text="List of organization names associated with this event"
    )
    
    class Meta:
        model = Event
        fields = [
            'id', 'name', 'organization', 'event_type', 'description', 'date', 'location', 'has_passed',
            'is_recurring', 'recurrence_type', 'recurrence_end_date', 'parent_event',
            'event_organizations', 'organizations'
        ]
    
    def validate_organization(self, value):
        """Validate that organization exists in AdminUser roles (not just existing events)"""
        from .models import AdminUser
        if not value:
            return value
        
        # Check if organization exists as an AdminUser role (excluding Faculty and Super Admin)
        valid_organizations = AdminUser.objects.exclude(
            role__in=['Faculty', 'Super Admin']
        ).values_list('role', flat=True).distinct()
        
        if value not in valid_organizations:
            raise serializers.ValidationError(
                f"Organization '{value}' is not a valid club. Please select from existing AdminUser roles."
            )
        
        return value
    
    def validate_organizations(self, value):
        """Validate that all organizations in the list exist in AdminUser roles"""
        from .models import AdminUser
        if not value:
            return value
        
        # Check if all organizations exist as AdminUser roles (excluding Faculty and Super Admin)
        valid_organizations = set(AdminUser.objects.exclude(
            role__in=['Faculty', 'Super Admin']
        ).values_list('role', flat=True).distinct())
        
        invalid_orgs = [org for org in value if org not in valid_organizations]
        if invalid_orgs:
            raise serializers.ValidationError(
                f"Invalid organizations: {', '.join(invalid_orgs)}. Please select from existing AdminUser roles."
            )
        
        return value
    
    def create(self, validated_data):
        organizations = validated_data.pop('organizations', [])
        event = Event.objects.create(**validated_data)
        
        # Create EventOrganization entries
        if organizations:
            for org in organizations:
                EventOrganization.objects.get_or_create(
                    event=event,
                    organization=org
                )
        else:
            # If no organizations provided, use the main organization field
            if validated_data.get('organization'):
                EventOrganization.objects.get_or_create(
                    event=event,
                    organization=validated_data['organization']
                )
        
        return event
    
    def update(self, instance, validated_data):
        organizations = validated_data.pop('organizations', None)
        
        # Update event fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update event organizations if provided
        if organizations is not None:
            # Delete existing event organizations
            EventOrganization.objects.filter(event=instance).delete()
            
            # Create new event organizations
            for org in organizations:
                EventOrganization.objects.create(
                    event=instance,
                    organization=org
                )
        elif validated_data.get('organization'):
            # If organizations not provided but organization field is updated,
            # ensure at least one EventOrganization exists
            if not EventOrganization.objects.filter(event=instance).exists():
                EventOrganization.objects.create(
                    event=instance,
                    organization=validated_data['organization']
                )
        
        return instance

class AttendanceSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    
    class Meta:
        model = Attendance
        fields = '__all__'

class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = ['id', 'season', 'year', 'is_current']

class ProfessorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Professor
        fields = ['id', 'first_name', 'last_name']

class ClassSerializer(serializers.ModelSerializer):
    professor = ProfessorSerializer()
    semester = SemesterSerializer()

    class Meta:
        model = Class
        fields = ['id', 'course_code', 'professor', 'semester']

class ClassListSerializer(serializers.ModelSerializer):
    professor = ProfessorSerializer(read_only=True)
    semester = SemesterSerializer(read_only=True)
    professor_id = serializers.PrimaryKeyRelatedField(
        source='professor',
        queryset=Professor.objects.all(),
        write_only=True
    )
    semester_id = serializers.PrimaryKeyRelatedField(
        source='semester',
        queryset=Semester.objects.all(),
        write_only=True
    )

    class Meta:
        model = Class
        fields = ['id', 'course_code', 'professor', 'semester', 'professor_id', 'semester_id']

class TeachingAssistantSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    class_assigned = ClassSerializer(read_only=True)

    class Meta:
        model = TeachingAssistant
        fields = ['id', 'student', 'class_assigned', 'points_awarded']

# Serializers for creating/updating
class ClassCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ['id', 'course_code', 'professor', 'semester']
        extra_kwargs = {
            'professor': {'required': True},
            'semester': {'required': True}
        }

class TeachingAssistantCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeachingAssistant
        fields = ['id', 'student', 'class_assigned']
        extra_kwargs = {
            'student': {'required': True},
            'class_assigned': {'required': True}
        }

