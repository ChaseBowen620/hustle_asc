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
    ClassListSerializer,
)
from django.contrib.auth.models import User, Group
from rest_framework.permissions import AllowAny, IsAuthenticated
import re
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.db.models import Count, Sum
from django.db import models
from datetime import datetime
from dateutil.relativedelta import relativedelta
import calendar

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

    def get_queryset(self):
        """Filter events by organization based on admin role"""
        queryset = Event.objects.all()
        
        # Check if user is admin and filter by organization
        admin_profile = getattr(self.request.user, 'adminuser', None)
        if admin_profile and admin_profile.role != 'Super Admin':
            queryset = queryset.filter(organization=admin_profile.role)
        
        return queryset

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        upcoming_events = self.get_queryset().filter(date__gt=timezone.now()).order_by('date')
        serializer = self.get_serializer(upcoming_events, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def past(self, request):
        past_events = self.get_queryset().filter(date__lte=timezone.now()).order_by('-date')
        serializer = self.get_serializer(past_events, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def types(self, request):
        """Get unique event types from filtered events"""
        unique_types = self.get_queryset().values_list('event_type', flat=True).distinct().order_by('event_type')
        return Response(list(unique_types))

    @action(detail=False, methods=['get'])
    def organizations(self, request):
        """Get unique organizations from filtered events"""
        unique_organizations = self.get_queryset().values_list('organization', flat=True).distinct().order_by('organization')
        return Response(list(unique_organizations))


    @action(detail=False, methods=['post'])
    def create_event_type(self, request):
        """Create a new event type for the organization"""
        try:
            event_type = request.data.get('event_type')
            if not event_type:
                return Response({'error': 'Event type is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if event type already exists for this organization
            admin_profile = getattr(request.user, 'adminuser', None)
            if admin_profile and admin_profile.role != 'Super Admin':
                existing = Event.objects.filter(
                    organization=admin_profile.role,
                    event_type=event_type
                ).exists()
            else:
                existing = Event.objects.filter(event_type=event_type).exists()
            
            if existing:
                return Response({'error': 'Event type already exists'}, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({'message': 'Event type created successfully', 'event_type': event_type})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related('student', 'event').all()
    serializer_class = AttendanceSerializer

    def get_queryset(self):
        """Filter attendance by organization based on admin role"""
        queryset = Attendance.objects.select_related('student', 'event').all()
        
        # Check if user is admin and filter by organization
        admin_profile = getattr(self.request.user, 'adminuser', None)
        if admin_profile and admin_profile.role != 'Super Admin':
            queryset = queryset.filter(event__organization=admin_profile.role)
        
        return queryset

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
    admin_profile = user.adminuser if hasattr(user, 'adminuser') else None
    
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'groups': list(user.groups.values_list('name', flat=True)),
        'is_superuser': user.is_superuser,
        'student_id': student.id if student else None,
        'student_profile': {
            'id': student.id,
            'total_points': student.total_points
        } if student else None,
        'admin_profile': {
            'id': admin_profile.id,
            'role': admin_profile.role,
            'first_name': admin_profile.first_name,
            'last_name': admin_profile.last_name
        } if admin_profile else None,
        'is_admin': admin_profile is not None
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Change user password"""
    try:
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')
        
        # Validate required fields
        if not all([current_password, new_password, confirm_password]):
            return Response({
                'error': 'All password fields are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate password confirmation
        if new_password != confirm_password:
            return Response({
                'error': 'New passwords do not match'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate current password
        if not user.check_password(current_password):
            return Response({
                'error': 'Current password is incorrect'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate new password strength
        if len(new_password) < 8:
            return Response({
                'error': 'New password must be at least 8 characters long'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Set new password
        user.set_password(new_password)
        user.save()
        
        return Response({
            'message': 'Password changed successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add custom claims
        data['username'] = self.user.username
        data['email'] = self.user.email
        data['first_name'] = self.user.first_name
        data['last_name'] = self.user.last_name
        data['groups'] = list(self.user.groups.values_list('name', flat=True))
        data['is_superuser'] = self.user.is_superuser
        
        if hasattr(self.user, 'student_profile'):
            data['student_id'] = self.user.student_profile.id
            data['student_profile'] = {
                'id': self.user.student_profile.id,
                'total_points': self.user.student_profile.total_points
            }
        
        if hasattr(self.user, 'adminuser'):
            data['admin_profile'] = {
                'id': self.user.adminuser.id,
                'role': self.user.adminuser.role,
                'first_name': self.user.adminuser.first_name,
                'last_name': self.user.adminuser.last_name
            }
            data['is_admin'] = True
        else:
            data['is_admin'] = False
        
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def total_students(request):
    # Check if user is admin and filter by organization
    admin_profile = getattr(request.user, 'adminuser', None)
    if admin_profile and admin_profile.role != 'Super Admin':
        # Filter students who attended events from this admin's organization
        count = Student.objects.filter(
            attendances__event__organization=admin_profile.role
        ).distinct().count()
    else:
        # Super Admin or non-admin sees all students
        count = Student.objects.count()
    return Response({'count': count})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def participating_students(request):
    filter_type = request.GET.get('filter', 'semester')
    
    # Check if user is admin and filter by organization
    admin_profile = getattr(request.user, 'adminuser', None)
    
    # Base query
    query = Student.objects
    
    # Apply organization filter if admin
    if admin_profile and admin_profile.role != 'Super Admin':
        query = query.filter(attendances__event__organization=admin_profile.role)
    
    # Get current date
    now = timezone.now()
    
    if filter_type == 'semester':
        # Filter by current semester date range
        current_month = now.month
        current_year = now.year
        
        if current_month >= 8:  # Fall semester (Aug-Dec)
            semester_start = timezone.make_aware(datetime(current_year, 8, 1))
            semester_end = timezone.make_aware(datetime(current_year + 1, 1, 1))
        else:  # Spring semester (Jan-July)
            semester_start = timezone.make_aware(datetime(current_year, 1, 1))
            semester_end = timezone.make_aware(datetime(current_year, 8, 1))
        
        count = query.filter(
            attendances__event__date__gte=semester_start,
            attendances__event__date__lt=semester_end
        ).distinct().count()
    
    elif filter_type == 'year':
        year = now.year if now.month >= 8 else now.year - 1
        academic_year_start = timezone.make_aware(
            datetime(year, 8, 1)
        )
        count = query.filter(
            attendances__event__date__gte=academic_year_start
        ).distinct().count()
    
    else:  # 'all'
        count = query.filter(attendances__isnull=False).distinct().count()
    
    return Response({'count': count})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_points(request):
    filter_type = request.GET.get('filter', 'semester')
    
    # Check if user is admin and filter by organization
    admin_profile = getattr(request.user, 'adminuser', None)
    
    # Base query
    students = Student.objects.all()
    
    # Apply organization filter if admin
    if admin_profile and admin_profile.role != 'Super Admin':
        students = students.filter(attendances__event__organization=admin_profile.role)
    
    # Get current date
    now = timezone.now()
    
    if filter_type == 'semester':
        # Filter by current semester date range
        current_month = now.month
        current_year = now.year
        
        if current_month >= 8:  # Fall semester (Aug-Dec)
            semester_start = timezone.make_aware(datetime(current_year, 8, 1))
            semester_end = timezone.make_aware(datetime(current_year + 1, 1, 1))
        else:  # Spring semester (Jan-July)
            semester_start = timezone.make_aware(datetime(current_year, 1, 1))
            semester_end = timezone.make_aware(datetime(current_year, 8, 1))
        
        students = students.annotate(
            filtered_attendance_count=Count(
                'attendances',
                filter=models.Q(
                    attendances__event__date__gte=semester_start,
                    attendances__event__date__lt=semester_end
                )
            )
        )
    
    elif filter_type == 'year':
        # Calculate academic year start (August 1st of current or previous year)
        year = now.year if now.month >= 8 else now.year - 1
        academic_year_start = timezone.make_aware(
            datetime(year, 8, 1)
        )
        
        students = students.annotate(
            filtered_attendance_count=Count(
                'attendances',
                filter=models.Q(attendances__event__date__gte=academic_year_start)
            )
        )
    
    else:  # 'all'
        students = students.annotate(
            filtered_attendance_count=Count('attendances')
        )

    # Order by attendance count (handling NULL values)
    students = students.order_by(models.F('filtered_attendance_count').desc(nulls_last=True))
    
    data = [{
        'student_id': student.id,
        'first_name': student.first_name,
        'last_name': student.last_name,
        'email': student.email,
        'total_points': student.filtered_attendance_count or 0
    } for student in students]
    
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_overview(request):
    # Check if user is admin and filter by organization
    admin_profile = getattr(request.user, 'adminuser', None)
    
    # Base query
    attendance_query = Attendance.objects.all()
    
    # Apply organization filter if admin
    if admin_profile and admin_profile.role != 'Super Admin':
        attendance_query = attendance_query.filter(event__organization=admin_profile.role)
    
    attendance_data = attendance_query.annotate(
        date=models.functions.TruncMonth('checked_in_at')
    ).values('date', 'event__event_type').annotate(
        count=Count('id')
    ).order_by('date')

    # Transform data for frontend
    transformed_data = []
    for entry in attendance_data:
        transformed_data.append({
            'date': entry['date'],
            'event_type': entry['event__event_type'],
            'attendance_counts': entry['count']
        })

    return Response(transformed_data)