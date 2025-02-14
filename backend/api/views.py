from django.shortcuts import render

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from .models import Student, Event, Attendance, Semester, Professor, Class, TeachingAssistant
from .serializers import (
    StudentSerializer, 
    EventSerializer, 
    AttendanceSerializer,
    SemesterSerializer, 
    ProfessorSerializer, 
    ClassSerializer, 
    TeachingAssistantSerializer,
    ClassCreateSerializer,
    TeachingAssistantCreateSerializer,
    ClassListSerializer
)
from django.contrib.auth.models import User, Group
from rest_framework.permissions import AllowAny, IsAuthenticated
import re
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all().order_by('first_name', 'last_name')
    serializer_class = StudentSerializer

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        print(f"Students API - Returning {len(serializer.data)} records")
        return Response(serializer.data)

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        upcoming_events = Event.objects.filter(date__gt=timezone.now()).order_by('date')
        serializer = self.get_serializer(upcoming_events, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def past(self, request):
        past_events = Event.objects.filter(date__lte=timezone.now()).order_by('-date')
        serializer = self.get_serializer(past_events, many=True)
        return Response(serializer.data)

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related('student', 'event').all()
    serializer_class = AttendanceSerializer

    def create(self, request, *args, **kwargs):
        try:
            student_id = request.data.get('student')
            event_id = request.data.get('event')
            
            if not student_id or not event_id:
                return Response(
                    {'error': 'Both student and event are required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if student exists using id
            try:
                student = Student.objects.get(id=student_id)
            except Student.DoesNotExist:
                return Response(
                    {'error': f'Student with id {student_id} does not exist'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if event exists using id
            try:
                event = Event.objects.get(id=event_id)
            except Event.DoesNotExist:
                return Response(
                    {'error': f'Event with id {event_id} does not exist'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check for existing attendance
            if Attendance.objects.filter(student_id=student_id, event_id=event_id).exists():
                return Response(
                    {'error': 'Student already checked in'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Create the attendance record
            attendance = Attendance.objects.create(
                student_id=student_id,
                event_id=event_id
            )
            
            # Return the serialized data
            return Response(
                AttendanceSerializer(attendance).data,
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class SemesterViewSet(viewsets.ModelViewSet):
    queryset = Semester.objects.all().order_by('-year', 'season')
    serializer_class = SemesterSerializer

class ProfessorViewSet(viewsets.ModelViewSet):
    queryset = Professor.objects.all().order_by('first_name', 'last_name')
    serializer_class = ProfessorSerializer

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        print(f"Professors API - Returning {len(serializer.data)} records")
        return Response(serializer.data)

class ClassViewSet(viewsets.ModelViewSet):
    queryset = Class.objects.select_related('professor', 'semester').all().order_by('course_code')
    
    def get_serializer_class(self):
        if self.action == 'list' or self.action == 'retrieve':
            return ClassSerializer
        return ClassListSerializer

class TeachingAssistantViewSet(viewsets.ModelViewSet):
    queryset = TeachingAssistant.objects.select_related(
        'student',
        'class_assigned',
        'class_assigned__professor',
        'class_assigned__semester'
    ).all()
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TeachingAssistantCreateSerializer
        return TeachingAssistantSerializer

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        print("Serialized TA data:", serializer.data)
        return Response(serializer.data)

@api_view(['POST'])
@permission_classes([AllowAny])
def register_student(request):
    try:
        email = request.data.get('email', '').lower()
        
        # Validate email format
        email_pattern = r'^a\d{8}@usu\.edu$'
        if not re.match(email_pattern, email):
            return Response({
                'error': 'Please enter a valid student email (format: a########@usu.edu)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract A-Number from email
        a_number = email.split('@')[0]  # This will be 'a########'
        
        # Create user account
        user = User.objects.create_user(
            username=a_number,  # Using A-Number as username
            email=email,
            password=request.data['password'],
            first_name=request.data['first_name'],
            last_name=request.data['last_name']
        )
        
        # Add to Students group
        student_group, _ = Group.objects.get_or_create(name='Students')
        user.groups.add(student_group)
        
        # Student profile is automatically created via signal
        
        return Response({
            'message': 'Student account created successfully',
            'a_number': a_number
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_details(request):
    user = request.user
    student = user.student_profile if hasattr(user, 'student_profile') else None
    
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'groups': list(user.groups.values_list('name', flat=True)),
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'student_id': student.id if student else None
    })

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add custom claims
        data['username'] = self.user.username
        data['email'] = self.user.email
        data['first_name'] = self.user.first_name
        data['last_name'] = self.user.last_name
        data['groups'] = list(self.user.groups.values_list('name', flat=True))
        data['is_staff'] = self.user.is_staff
        data['is_superuser'] = self.user.is_superuser
        
        if hasattr(self.user, 'student_profile'):
            data['student_id'] = self.user.student_profile.id
        
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer