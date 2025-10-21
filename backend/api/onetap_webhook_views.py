import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.views import View
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from .models import Student, Event, Attendance, Semester
import hashlib
import hmac
from django.conf import settings
from datetime import datetime

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def onetap_webhook(request):
    """
    Comprehensive OneTap webhook endpoint that handles:
    1. Student creation
    2. Event creation  
    3. Attendance recording
    
    Expected payload format:
    {
        "action": "create_student" | "create_event" | "record_attendance",
        "data": {
            // Student data (for create_student)
            "student_identifier": "a12345678",
            "email": "student@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "is_admin": false,
            
            // Event data (for create_event)
            "event_name": "Weekly Meeting",
            "event_date": "2024-01-15T10:00:00Z",
            "event_type": "Meeting",
            "points": 5,
            "description": "Weekly team meeting",
            
            // Attendance data (for record_attendance)
            "student_identifier": "a12345678",
            "event_identifier": "1",
            "check_in_time": "2024-01-15T10:30:00Z"
        },
        "source": "onetap_checkin",
        "metadata": {}
    }
    """
    try:
        # Log the incoming request
        logger.info(f"OneTap webhook received: {request.method} {request.path}")
        logger.info(f"Headers: {dict(request.headers)}")
        
        # Parse JSON payload
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return Response(
                {'error': 'Invalid JSON payload'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract action and data
        action = payload.get('action')
        data = payload.get('data', {})
        source = payload.get('source', 'onetap_webhook')
        metadata = payload.get('metadata', {})
        
        if not action:
            return Response(
                {'error': 'action field is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Route to appropriate handler
        if action == 'create_student':
            return handle_create_student(data, source, metadata)
        elif action == 'create_event':
            return handle_create_event(data, source, metadata)
        elif action == 'record_attendance':
            return handle_record_attendance(data, source, metadata)
        else:
            return Response(
                {'error': f'Unknown action: {action}. Valid actions are: create_student, create_event, record_attendance'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
    except Exception as e:
        logger.error(f"OneTap webhook error: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Internal server error', 'details': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def handle_create_student(data, source, metadata):
    """Handle student creation."""
    try:
        # Extract required fields
        student_identifier = data.get('student_identifier')
        email = data.get('email')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        is_admin = data.get('is_admin', False)
        
        if not all([student_identifier, email, first_name, last_name]):
            return Response(
                {'error': 'student_identifier, email, first_name, and last_name are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if student already exists
        if Student.objects.filter(email=email).exists():
            return Response(
                {'error': f'Student with email {email} already exists'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user already exists
        if User.objects.filter(username=student_identifier.lower()).exists():
            return Response(
                {'error': f'User with identifier {student_identifier} already exists'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create user account
        user = User.objects.create_user(
            username=student_identifier.lower(),
            email=email,
            password='onetap_default_password',  # Default password, should be changed
            first_name=first_name,
            last_name=last_name,
            is_active=True
        )
        
        # Create student profile
        student = Student.objects.create(
            user=user,
            first_name=first_name,
            last_name=last_name,
            email=email,
            is_admin=is_admin
        )
        
        logger.info(f"Student created via OneTap: {student} (ID: {student.id})")
        
        return Response({
            'success': True,
            'message': 'Student created successfully',
            'student': {
                'id': student.id,
                'identifier': student_identifier,
                'name': f"{first_name} {last_name}",
                'email': email,
                'is_admin': is_admin
            },
            'source': source
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating student: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Failed to create student', 'details': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def handle_create_event(data, source, metadata):
    """Handle event creation."""
    try:
        # Extract required fields
        event_name = data.get('event_name')
        event_date = data.get('event_date')
        event_type = data.get('event_type', 'General')
        points = data.get('points', 0)
        description = data.get('description', '')
        
        if not all([event_name, event_date]):
            return Response(
                {'error': 'event_name and event_date are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse event date
        try:
            if isinstance(event_date, str):
                event_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
        except ValueError:
            return Response(
                {'error': 'Invalid event_date format. Use ISO format (e.g., 2024-01-15T10:00:00Z)'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Set default values for new fields
        organization = 'ASC'  # Default organization
        function = 'General'  # Default function
        
        # Create event
        event = Event.objects.create(
            name=event_name,
            date=event_date,
            organization=organization,
            event_type=event_type,
            function=function,
            points=points,
            description=description,
            location='ASC Space'  # Default location
        )
        
        logger.info(f"Event created via OneTap: {event} (ID: {event.id})")
        
        return Response({
            'success': True,
            'message': 'Event created successfully',
            'event': {
                'id': event.id,
                'name': event_name,
                'date': event_date.isoformat(),
                'event_type': event_type,
                'points': points,
                'description': description
            },
            'source': source
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating event: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Failed to create event', 'details': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def handle_record_attendance(data, source, metadata):
    """Handle attendance recording (reuse existing logic)."""
    try:
        # Extract required fields
        student_identifier = data.get('student_identifier')
        event_identifier = data.get('event_identifier')
        check_in_time = data.get('check_in_time')
        
        if not student_identifier or not event_identifier:
            return Response(
                {'error': 'student_identifier and event_identifier are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find student by identifier (A-number or email)
        student = None
        if '@' in student_identifier:
            # Email lookup
            try:
                student = Student.objects.get(email=student_identifier)
            except Student.DoesNotExist:
                return Response(
                    {'error': f'Student with email {student_identifier} not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # A-number lookup (assume it's the username)
            try:
                student = Student.objects.get(user__username=student_identifier.lower())
            except Student.DoesNotExist:
                return Response(
                    {'error': f'Student with identifier {student_identifier} not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Find event by identifier (ID or name)
        event = None
        try:
            # Try by ID first
            event = Event.objects.get(id=event_identifier)
        except (Event.DoesNotExist, ValueError):
            try:
                # Try by name
                event = Event.objects.get(name=event_identifier)
            except Event.DoesNotExist:
                return Response(
                    {'error': f'Event with identifier {event_identifier} not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Check for existing attendance
        if Attendance.objects.filter(student=student, event=event).exists():
            return Response(
                {'error': 'Student already checked in to this event'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create attendance record
        attendance = Attendance.objects.create(
            student=student,
            event=event
        )
        
        # Log successful creation
        logger.info(f"Attendance recorded via OneTap: {student} at {event} (ID: {attendance.id})")
        
        # Return success response
        return Response({
            'success': True,
            'message': 'Attendance recorded successfully',
            'attendance_id': attendance.id,
            'student': {
                'id': student.id,
                'name': f"{student.first_name} {student.last_name}",
                'email': student.email
            },
            'event': {
                'id': event.id,
                'name': event.name,
                'date': event.date.isoformat() if event.date else None
            },
            'checked_in_at': attendance.checked_in_at.isoformat(),
            'source': source
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error recording attendance: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Failed to record attendance', 'details': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([AllowAny])
def onetap_webhook_status(request):
    """
    Health check endpoint for OneTap webhook monitoring.
    """
    return Response({
        'status': 'healthy',
        'message': 'OneTap webhook is operational',
        'supported_actions': ['create_student', 'create_event', 'record_attendance'],
        'endpoints': {
            'onetap_webhook': '/api/webhook/onetap/',
            'status': '/api/webhook/onetap/status/'
        }
    })









