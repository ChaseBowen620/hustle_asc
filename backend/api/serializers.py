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
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name
        }

class EventOrganizationSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(source='organization.id', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    
    class Meta:
        model = EventOrganization
        fields = ['id', 'organization', 'organization_id', 'organization_name', 'created_at']

class EventSerializer(serializers.ModelSerializer):
    has_passed = serializers.BooleanField(read_only=True)
    event_organizations = EventOrganizationSerializer(many=True, read_only=True)
    organizations = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="List of organization IDs (from Organization table) for secondary organizations"
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
        """Validate that all organization IDs exist in the Organization table"""
        from .models import Organization
        if not value:
            return value
        
        # Check if all organization IDs exist in the Organization table
        valid_org_ids = set(Organization.objects.values_list('id', flat=True))
        
        invalid_orgs = [org_id for org_id in value if org_id not in valid_org_ids]
        if invalid_orgs:
            raise serializers.ValidationError(
                f"Invalid organization IDs: {', '.join(map(str, invalid_orgs))}. Please select from existing organizations."
            )
        
        return value
    
    def create(self, validated_data):
        from .models import Organization
        import logging
        
        logger = logging.getLogger(__name__)
        
        organizations = validated_data.pop('organizations', [])
        event = Event.objects.create(**validated_data)
        
        # Debug: Log what's being created
        logger.info(f"🔍 [EventOrganization Debug] Creating event {event.id} ({event.name})")
        logger.info(f"   Primary organization: {validated_data.get('organization')}")
        logger.info(f"   Secondary organization IDs received: {organizations}")
        
        # Create EventOrganization entries for secondary organizations
        created_entries = []
        if organizations:
            for org_id in organizations:
                try:
                    org = Organization.objects.get(id=org_id)
                    # Don't add the primary organization as a secondary
                    if org.name != validated_data.get('organization'):
                        eo, created = EventOrganization.objects.get_or_create(
                            event=event,
                            organization=org
                        )
                        created_entries.append({
                            'id': eo.id,
                            'event_id': event.id,
                            'organization_id': org.id,
                            'organization_name': org.name,
                            'created': created
                        })
                        logger.info(f"   ✅ Created EventOrganization: ID={eo.id}, Event={event.id}, Org={org.name} (ID={org.id})")
                    else:
                        logger.info(f"   ⏭️  Skipped {org.name} (same as primary organization)")
                except Organization.DoesNotExist:
                    logger.warning(f"   ❌ Organization ID {org_id} not found, skipping")
        
        logger.info(f"   📊 Total EventOrganization entries created: {len(created_entries)}")
        
        return event
    
    def update(self, instance, validated_data):
        from .models import Organization
        import logging
        
        logger = logging.getLogger(__name__)
        
        organizations = validated_data.pop('organizations', None)
        
        # Update event fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update event organizations if provided
        if organizations is not None:
            logger.info(f"🔍 [EventOrganization Update Debug] Updating event {instance.id} ({instance.name})")
            logger.info(f"   Primary organization: {validated_data.get('organization') or instance.organization}")
            logger.info(f"   Secondary organization IDs received: {organizations}")
            
            # Delete existing event organizations
            deleted_count = EventOrganization.objects.filter(event=instance).delete()[0]
            logger.info(f"   🗑️  Deleted {deleted_count} existing EventOrganization entries")
            
            # Create new event organizations (secondary organizations only)
            primary_org_name = validated_data.get('organization') or instance.organization
            created_entries = []
            for org_id in organizations:
                try:
                    org = Organization.objects.get(id=org_id)
                    # Don't add the primary organization as a secondary
                    if org.name != primary_org_name:
                        eo = EventOrganization.objects.create(
                            event=instance,
                            organization=org
                        )
                        created_entries.append({
                            'id': eo.id,
                            'event_id': instance.id,
                            'organization_id': org.id,
                            'organization_name': org.name
                        })
                        logger.info(f"   ✅ Created EventOrganization: ID={eo.id}, Event={instance.id}, Org={org.name} (ID={org.id})")
                    else:
                        logger.info(f"   ⏭️  Skipped {org.name} (same as primary organization)")
                except Organization.DoesNotExist:
                    logger.warning(f"   ❌ Organization ID {org_id} not found, skipping")
            
            logger.info(f"   📊 Total EventOrganization entries created: {len(created_entries)}")
        
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

