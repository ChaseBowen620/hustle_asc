from rest_framework import serializers
from .models import Student, Event, Attendance, Semester, Professor, Class, TeachingAssistant

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

class EventSerializer(serializers.ModelSerializer):
    has_passed = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Event
        fields = ['id', 'name', 'organization', 'event_type', 'description', 'date', 'location', 'has_passed']

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

