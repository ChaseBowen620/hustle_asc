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
from django.db.models import Q
from datetime import datetime
from dateutil.relativedelta import relativedelta
import calendar

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all().order_by('first_name', 'last_name')
    serializer_class = StudentSerializer
    permission_classes = [AllowAny]  # Make read operations public

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        print(f"Students API - Returning {len(serializer.data)} records")
        return Response(serializer.data)

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [AllowAny]  # Make read operations public

    def get_queryset(self):
        """Filter events by organization based on admin role"""
        from .models import EventOrganization, Organization
        
        queryset = Event.objects.all()
        
        # Check if user is authenticated and is admin, then filter by organization
        # Super Admin, DAISSA, and Faculty can see all events
        if self.request.user and self.request.user.is_authenticated:
            admin_profile = getattr(self.request.user, 'adminuser', None)
            if admin_profile and admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
                # Include events where organization is primary OR where organization is secondary
                # For primary: organization is a CharField, so match by name
                # For secondary: event_organizations__organization is a ForeignKey, so match by name through the relationship
                queryset = queryset.filter(
                    Q(organization=admin_profile.role) |
                    Q(event_organizations__organization__name=admin_profile.role)
                ).distinct()
        
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

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def types(self, request):
        """Get unique event types from filtered events"""
        # Get queryset, handling unauthenticated users
        queryset = self.get_queryset()
        unique_types = queryset.values_list('event_type', flat=True).distinct().order_by('event_type')
        return Response(list(unique_types))

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def organizations(self, request):
        """
        Get all organizations from the Organization table.
        Returns list of organization objects with id and name.
        """
        from .models import Organization
        organizations = Organization.objects.all().order_by('name')
        organizations_data = [{'id': org.id, 'name': org.name} for org in organizations]
        return Response(organizations_data)

    @action(detail=False, methods=['get'])
    def functions(self, request):
        """Get unique functions from filtered events"""
        unique_functions = self.get_queryset().values_list('function', flat=True).distinct().order_by('function')
        return Response(list(unique_functions))

    @action(detail=False, methods=['get'])
    def all_functions(self, request):
        """Get all unique functions from all events (universal)"""
        unique_functions = Event.objects.values_list('function', flat=True).distinct().order_by('function')
        return Response(list(unique_functions))

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

    def create(self, request, *args, **kwargs):
        """Override create to handle recurring events and organization validation"""
        try:
            # Check if user is a club leader and restrict organization to their role
            admin_profile = getattr(request.user, 'adminuser', None)
            if admin_profile and admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
                # Club leaders can only create events for their own organization
                organization = request.data.get('organization')
                if organization and organization != admin_profile.role:
                    return Response(
                        {'error': f'You can only create events for your own organization ({admin_profile.role})'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                # Auto-set organization to their role if not provided
                if not organization:
                    request.data['organization'] = admin_profile.role
            
            # Create the main event
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            event = serializer.save()
            
            # If this is a recurring event, create recurring instances
            if event.is_recurring and event.recurrence_type != 'none':
                self._create_recurring_instances(event)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def _create_recurring_instances(self, parent_event):
        """Create recurring instances of an event"""
        from datetime import timedelta
        import calendar
        
        current_date = parent_event.date
        end_date = parent_event.recurrence_end_date or (current_date + timedelta(days=365))  # Default to 1 year
        
        while current_date <= end_date:
            # Calculate next occurrence based on recurrence type
            if parent_event.recurrence_type == 'daily':
                current_date += timedelta(days=1)
            elif parent_event.recurrence_type == 'weekly':
                current_date += timedelta(weeks=1)
            elif parent_event.recurrence_type == 'biweekly':
                current_date += timedelta(weeks=2)
            elif parent_event.recurrence_type == 'monthly':
                # Add one month
                if current_date.month == 12:
                    current_date = current_date.replace(year=current_date.year + 1, month=1)
                else:
                    try:
                        current_date = current_date.replace(month=current_date.month + 1)
                    except ValueError:
                        # Handle cases where the day doesn't exist in the next month
                        current_date = current_date.replace(month=current_date.month + 1, day=1)
                        current_date = current_date.replace(day=min(parent_event.date.day, calendar.monthrange(current_date.year, current_date.month)[1]))
            else:
                break
            
            if current_date <= end_date:
                # Create recurring instance
                Event.objects.create(
                    name=parent_event.name,
                    organization=parent_event.organization,
                    event_type=parent_event.event_type,
                    description=parent_event.description,
                    date=current_date,
                    location=parent_event.location,
                    is_recurring=False,  # Instances are not recurring themselves
                    recurrence_type='none',
                    parent_event=parent_event
                )

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related('student', 'event').all()
    serializer_class = AttendanceSerializer
    permission_classes = [AllowAny]  # Make read operations public

    def get_queryset(self):
        """Filter attendance by organization based on admin role"""
        from .models import EventOrganization, Organization
        
        queryset = Attendance.objects.select_related('student', 'event').all()
        
        # Check if user is admin and filter by organization
        # Super Admin, DAISSA, and Faculty can see all events
        admin_profile = getattr(self.request.user, 'adminuser', None)
        if admin_profile and admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
            # Include attendances for events where organization is primary OR secondary
            # For primary: event__organization is a CharField, so match by name
            # For secondary: event__event_organizations__organization is a ForeignKey, so match by name through the relationship
            queryset = queryset.filter(
                Q(event__organization=admin_profile.role) |
                Q(event__event_organizations__organization__name=admin_profile.role)
            ).distinct()
        
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
        # Get A-number from request (can be passed as 'a_number' or 'email' for backwards compatibility)
        a_number = request.data.get('a_number', '').lower().strip()
        if not a_number:
            # Try to extract from email if provided (for backwards compatibility)
            email = request.data.get('email', '').lower()
            if email and '@usu.edu' in email:
                a_number = email.split('@')[0]
        
        if not a_number:
            return Response({
                'error': 'A-number is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate A-number format (should be 'a' followed by 8 digits)
        a_number_pattern = r'^a\d{8}$'
        if not re.match(a_number_pattern, a_number):
            return Response({
                'error': 'Please enter a valid A-number (format: a########)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user with this A-number already exists
        if User.objects.filter(username=a_number).exists():
            return Response({
                'error': 'A user with this A-number already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create user account
        user = User.objects.create_user(
            username=a_number,  # Using A-Number as username
            password=request.data.get('password', 'changeme!'),
            first_name=request.data.get('first_name', ''),
            last_name=request.data.get('last_name', '')
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
@permission_classes([AllowAny])
def total_students(request):
    # Check if user is admin and filter by organization
    organization_filter = request.GET.get('organization', None)
    admin_profile = getattr(request.user, 'adminuser', None)
    
    # With AllowAny permission, we allow organization filtering via query parameter
    if organization_filter:
        # Filter students who attended events from the specified organization (primary or secondary)
        from .models import EventOrganization
        count = Student.objects.filter(
            Q(attendances__event__organization=organization_filter) |
            Q(attendances__event__event_organizations__organization__name=organization_filter)
        ).distinct().count()
    elif admin_profile and admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
        # Filter students who attended events from this admin's organization (primary or secondary)
        from .models import EventOrganization
        count = Student.objects.filter(
            Q(attendances__event__organization=admin_profile.role) |
            Q(attendances__event__event_organizations__organization__name=admin_profile.role)
        ).distinct().count()
    else:
        # Super Admin, DAISSA, Faculty, or non-admin sees all students
        count = Student.objects.count()
    return Response({'count': count})

@api_view(['GET'])
@permission_classes([AllowAny])
def participating_students(request):
    filter_type = request.GET.get('filter', 'semester')
    organization_filter = request.GET.get('organization', None)
    
    # Check if user is admin and filter by organization
    admin_profile = getattr(request.user, 'adminuser', None)
    
    # Base query
    query = Student.objects
    
    # Apply organization filter
    # With AllowAny permission, we allow organization filtering via query parameter
    from .models import EventOrganization
    if organization_filter:
        # Filter by organization parameter (primary or secondary)
        query = query.filter(
            Q(attendances__event__organization=organization_filter) |
            Q(attendances__event__event_organizations__organization__name=organization_filter)
        )
    elif admin_profile and admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
        # Filter by admin's organization (primary or secondary)
        query = query.filter(
            Q(attendances__event__organization=admin_profile.role) |
            Q(attendances__event__event_organizations__organization__name=admin_profile.role)
        )
    
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
@permission_classes([AllowAny])
def student_points(request):
    filter_type = request.GET.get('filter', 'semester')
    organization_filter = request.GET.get('organization', None)
    
    # Check if user is admin and filter by organization
    admin_profile = getattr(request.user, 'adminuser', None)
    
    # Base query
    students = Student.objects.all()
    
    # Apply organization filter
    # With AllowAny permission, we allow organization filtering via query parameter
    from .models import EventOrganization
    if organization_filter:
        # Filter by organization parameter (primary or secondary)
        students = students.filter(
            Q(attendances__event__organization=organization_filter) |
            Q(attendances__event__event_organizations__organization__name=organization_filter)
        ).distinct()
    elif admin_profile and admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
        # If no organization filter but user is authenticated non-super-admin, filter by their role
        students = students.filter(
            Q(attendances__event__organization=admin_profile.role) |
            Q(attendances__event__event_organizations__organization__name=admin_profile.role)
        ).distinct()
    
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
        
        # For organization filtering, we need to check both primary and secondary organizations
        if organization_filter:
            # Filter by organization parameter (primary or secondary) AND date range
            students = students.annotate(
                filtered_points=Count(
                    'attendances',
                    filter=models.Q(
                        Q(attendances__event__organization=organization_filter) |
                        Q(attendances__event__event_organizations__organization__name=organization_filter),
                        attendances__event__date__gte=semester_start,
                        attendances__event__date__lt=semester_end
                    )
                )
            )
        elif admin_profile and admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
            # Filter by organization (primary or secondary) AND date range (for authenticated non-super-admin)
            students = students.annotate(
                filtered_points=Count(
                    'attendances',
                    filter=models.Q(
                        Q(attendances__event__organization=admin_profile.role) |
                        Q(attendances__event__event_organizations__organization__name=admin_profile.role),
                        attendances__event__date__gte=semester_start,
                        attendances__event__date__lt=semester_end
                    )
                )
            )
        else:
            # No organization filter, just date range
            students = students.annotate(
                filtered_points=Count(
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
        
        # For organization filtering, we need to check both primary and secondary organizations
        if organization_filter:
            # Filter by organization parameter (primary or secondary) AND date range
            students = students.annotate(
                filtered_points=Count(
                    'attendances',
                    filter=models.Q(
                        Q(attendances__event__organization=organization_filter) |
                        Q(attendances__event__event_organizations__organization__name=organization_filter),
                        attendances__event__date__gte=academic_year_start
                    )
                )
            )
        elif admin_profile and admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
            # Filter by organization (primary or secondary) AND date range (for authenticated non-super-admin)
            students = students.annotate(
                filtered_points=Count(
                    'attendances',
                    filter=models.Q(
                        Q(attendances__event__organization=admin_profile.role) |
                        Q(attendances__event__event_organizations__organization__name=admin_profile.role),
                        attendances__event__date__gte=academic_year_start
                    )
                )
            )
        else:
            # No organization filter, just date range
            students = students.annotate(
                filtered_points=Count(
                    'attendances',
                    filter=models.Q(attendances__event__date__gte=academic_year_start)
                )
            )
    
    else:  # 'all'
        # For organization filtering, we need to check both primary and secondary organizations
        if organization_filter:
            # Filter by organization parameter (primary or secondary)
            students = students.annotate(
                filtered_points=Count(
                    'attendances',
                    filter=models.Q(
                        Q(attendances__event__organization=organization_filter) |
                        Q(attendances__event__event_organizations__organization__name=organization_filter)
                    )
                )
            )
        elif admin_profile and admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
            # Filter by organization (primary or secondary) (for authenticated non-super-admin)
            students = students.annotate(
                filtered_points=Count(
                    'attendances',
                    filter=models.Q(
                        Q(attendances__event__organization=admin_profile.role) |
                        Q(attendances__event__event_organizations__organization__name=admin_profile.role)
                    )
                )
            )
        else:
            # No organization filter
            students = students.annotate(
                filtered_points=Count('attendances')
            )

    # Order by points (handling NULL values)
    students = students.order_by(models.F('filtered_points').desc(nulls_last=True))
    
    data = [{
        'student_id': student.id,
        'first_name': student.first_name,
        'last_name': student.last_name,
        'total_points': student.filtered_points or 0
    } for student in students]
    
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_admin_users(request):
    """Get all admin users - only accessible to Super Admin, DAISSA, or Faculty"""
    admin_profile = getattr(request.user, 'adminuser', None)
    if not admin_profile or admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
        return Response(
            {'error': 'You do not have permission to view admin users'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    from .models import AdminUser
    admin_users = AdminUser.objects.select_related('user').all().order_by('last_name', 'first_name')
    
    admin_users_data = []
    for admin_user in admin_users:
        admin_users_data.append({
            'id': admin_user.id,
            'user_id': admin_user.user.id,
            'username': admin_user.user.username,
            'first_name': admin_user.first_name,
            'last_name': admin_user.last_name,
            'role': admin_user.role,
            'created_at': admin_user.created_at,
            'student_id': admin_user.user.student_profile.id if hasattr(admin_user.user, 'student_profile') else None
        })
    
    return Response(admin_users_data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_admin_user(request):
    """Create a new admin user - only accessible to Super Admin, DAISSA, or Faculty"""
    admin_profile = getattr(request.user, 'adminuser', None)
    if not admin_profile or admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
        return Response(
            {'error': 'You do not have permission to create admin users'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    from .models import AdminUser
    from django.contrib.auth.models import User
    
    role = request.data.get('role')
    student_id = request.data.get('student_id')
    first_name = request.data.get('first_name')
    last_name = request.data.get('last_name')
    
    if not role:
        return Response(
            {'error': 'role is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # If student_id is provided, create admin from existing student
    if student_id:
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response(
                {'error': 'Student not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if admin user already exists for this student
        if hasattr(student.user, 'adminuser'):
            return Response(
                {'error': 'This student is already an admin user'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create admin user from student
        admin_user = AdminUser.objects.create(
            user=student.user,
            first_name=student.first_name,
            last_name=student.last_name,
            role=role
        )
    else:
        # Create new user and admin user (for Faculty)
        if not first_name or not last_name:
            return Response(
                {'error': 'first_name and last_name are required when creating a new user'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate username from first_name and last_name
        base_username = f"{first_name.lower()}{last_name.lower()}".replace(' ', '')
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
        
        # Create user with default password
        user = User.objects.create_user(
            username=username,
            password='changeme!',
            first_name=first_name,
            last_name=last_name
        )
        
        # Create admin user
        admin_user = AdminUser.objects.create(
            user=user,
            first_name=first_name,
            last_name=last_name,
            role=role
        )
    
    return Response({
        'id': admin_user.id,
        'user_id': admin_user.user.id,
        'username': admin_user.user.username,
        'first_name': admin_user.first_name,
        'last_name': admin_user.last_name,
        'role': admin_user.role,
        'created_at': admin_user.created_at
    }, status=status.HTTP_201_CREATED)

@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_admin_user(request, admin_user_id):
    """Update an admin user - only accessible to Super Admin, DAISSA, or Faculty"""
    admin_profile = getattr(request.user, 'adminuser', None)
    if not admin_profile or admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
        return Response(
            {'error': 'You do not have permission to update admin users'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    from .models import AdminUser
    
    try:
        admin_user = AdminUser.objects.get(id=admin_user_id)
    except AdminUser.DoesNotExist:
        return Response(
            {'error': 'Admin user not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    role = request.data.get('role')
    if role:
        admin_user.role = role
        admin_user.save()
    
    return Response({
        'id': admin_user.id,
        'user_id': admin_user.user.id,
        'username': admin_user.user.username,
        'first_name': admin_user.first_name,
        'last_name': admin_user.last_name,
        'role': admin_user.role,
        'created_at': admin_user.created_at
    })

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_admin_user(request, admin_user_id):
    """Delete an admin user - only accessible to Super Admin, DAISSA, or Faculty"""
    admin_profile = getattr(request.user, 'adminuser', None)
    if not admin_profile or admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
        return Response(
            {'error': 'You do not have permission to delete admin users'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    from .models import AdminUser
    
    try:
        admin_user = AdminUser.objects.get(id=admin_user_id)
        admin_user.delete()
        return Response({'message': 'Admin user deleted successfully'}, status=status.HTTP_200_OK)
    except AdminUser.DoesNotExist:
        return Response(
            {'error': 'Admin user not found'},
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_students(request):
    """Search for students by name, email, or A-number - accessible to all admin users"""
    from .models import AdminUser
    
    # Allow any admin user to search students (for check-in and other admin functions)
    admin_profile = getattr(request.user, 'adminuser', None)
    if not admin_profile:
        return Response(
            {'error': 'You do not have permission to search students'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    query = request.GET.get('q', '').strip()
    
    if not query or len(query) < 2:
        return Response([])
    
    # Search by name or username (which contains A-number)
    students = Student.objects.filter(
        Q(first_name__icontains=query) |
        Q(last_name__icontains=query) |
        Q(user__username__icontains=query) |
        Q(username__icontains=query)
    ).select_related('user')[:20]  # Limit to 20 results
    
    students_data = []
    for student in students:
        # Check if user has an admin profile
        # Django's OneToOneField raises RelatedObjectDoesNotExist when the related object doesn't exist
        try:
            admin_user = student.user.adminuser
            is_admin = True
            admin_role = admin_user.role
        except Exception:
            # Catch any exception (RelatedObjectDoesNotExist or AttributeError)
            is_admin = False
            admin_role = None
        
        students_data.append({
            'id': student.id,
            'first_name': student.first_name,
            'last_name': student.last_name,
            'a_number': student.user.username if student.user.username else '',
            'username': student.user.username,
            'is_admin': is_admin,
            'admin_role': admin_role
        })
    
    return Response(students_data)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def list_organizations(request):
    """List all organizations or create a new one - only accessible to Super Admin, DAISSA, or Faculty"""
    from .models import Organization
    
    admin_profile = getattr(request.user, 'adminuser', None)
    if not admin_profile or admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
        return Response(
            {'error': 'You do not have permission to manage organizations'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    if request.method == 'GET':
        organizations = Organization.objects.all().order_by('name')
        organizations_data = [{
            'id': org.id,
            'name': org.name,
            'created_at': org.created_at,
            'updated_at': org.updated_at
        } for org in organizations]
        return Response(organizations_data)
    
    elif request.method == 'POST':
        name = request.data.get('name', '').strip()
        if not name:
            return Response(
                {'error': 'Organization name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if organization already exists
        if Organization.objects.filter(name=name).exists():
            return Response(
                {'error': 'An organization with this name already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        organization = Organization.objects.create(name=name)
        return Response({
            'id': organization.id,
            'name': organization.name,
            'created_at': organization.created_at,
            'updated_at': organization.updated_at
        }, status=status.HTTP_201_CREATED)

@api_view(['PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_organization(request, organization_id):
    """Update or delete an organization - only accessible to Super Admin, DAISSA, or Faculty"""
    from .models import Organization
    
    admin_profile = getattr(request.user, 'adminuser', None)
    if not admin_profile or admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
        return Response(
            {'error': 'You do not have permission to manage organizations'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        return Response(
            {'error': 'Organization not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if request.method in ['PUT', 'PATCH']:
        name = request.data.get('name', '').strip()
        if not name:
            return Response(
                {'error': 'Organization name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if another organization with this name exists
        if Organization.objects.filter(name=name).exclude(id=organization_id).exists():
            return Response(
                {'error': 'An organization with this name already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        organization.name = name
        organization.save()
        
        return Response({
            'id': organization.id,
            'name': organization.name,
            'created_at': organization.created_at,
            'updated_at': organization.updated_at
        })
    
    elif request.method == 'DELETE':
        # Check if organization is being used by any admin users
        from .models import AdminUser
        admin_users_with_role = AdminUser.objects.filter(role=organization.name).count()
        if admin_users_with_role > 0:
            return Response(
                {'error': f'Cannot delete organization. It is currently assigned to {admin_users_with_role} admin user(s).'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        organization.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([AllowAny])
def attendance_overview(request):
    # Check if user is admin and filter by organization
    # Super Admin, DAISSA, and Faculty can see all events
    admin_profile = getattr(request.user, 'adminuser', None)
    
    # Base query
    attendance_query = Attendance.objects.all()
    
    # Apply organization filter if admin
    if admin_profile and admin_profile.role not in ['Super Admin', 'DAISSA', 'Faculty']:
        from .models import EventOrganization
        # Include attendances for events where organization is primary OR secondary
        attendance_query = attendance_query.filter(
            Q(event__organization=admin_profile.role) |
            Q(event__event_organizations__organization__name=admin_profile.role)
        ).distinct()
    
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