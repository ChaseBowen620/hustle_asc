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
def unified_webhook(request):
    """
    Unified webhook endpoint that automatically handles:
    1. Student creation/updates
    2. Event creation/updates  
    3. Attendance recording
    
    The webhook automatically detects the operation type based on payload structure:
    
    For Students:
    {
        "type": "student",
        "action": "create" | "update",
        "data": {
            "student_identifier": "a12345678",
            "email": "student@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "is_admin": false
        }
    }
    
    For Events:
    {
        "type": "event",
        "action": "create" | "update",
        "data": {
            "event_name": "Weekly Meeting",
            "event_date": "2024-01-15T10:00:00Z",
            "event_type": "Meeting",
            "points": 5,
            "description": "Weekly team meeting",
            "location": "Room 101"
        }
    }
    
    For Attendance:
    {
        "type": "attendance",
        "action": "create",
        "data": {
            "student_identifier": "a12345678",
            "event_identifier": "1",
            "check_in_time": "2024-01-15T10:30:00Z"
        }
    }
    """
    try:
        # Log the incoming request
        logger.info(f"Unified webhook received: {request.method} {request.path}")
        logger.info(f"Headers: {dict(request.headers)}")
        
        # Parse JSON payload
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return Response(
                {'error': 'Invalid JSON payload'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract type and action
        operation_type = payload.get('type')
        action = payload.get('action', 'create')
        data = payload.get('data', {})
        source = payload.get('source', 'unified_webhook')
        metadata = payload.get('metadata', {})
        
        if not operation_type:
            return Response(
                {'error': 'type field is required. Valid types: student, event, attendance'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Route to appropriate handler
        if operation_type == 'student':
            return handle_student_operation(action, data, source, metadata)
        elif operation_type == 'event':
            return handle_event_operation(action, data, source, metadata)
        elif operation_type == 'attendance':
            return handle_attendance_operation(action, data, source, metadata)
        else:
            return Response(
                {'error': f'Unknown type: {operation_type}. Valid types are: student, event, attendance'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
    except Exception as e:
        logger.error(f"Unified webhook error: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Internal server error', 'details': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def handle_student_operation(action, data, source, metadata):
    """Handle student creation and updates."""
    try:
        if action == 'create':
            return create_student(data, source, metadata)
        elif action == 'update':
            return update_student(data, source, metadata)
        else:
            return Response(
                {'error': f'Unknown action: {action}. Valid actions for students: create, update'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        logger.error(f"Error in student operation: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Failed to process student operation', 'details': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def create_student(data, source, metadata):
    """Create a new student."""
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
        password='webhook_default_password',  # Default password, should be changed
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
    
    logger.info(f"Student created via unified webhook: {student} (ID: {student.id})")
    
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

def update_student(data, source, metadata):
    """Update an existing student."""
    student_identifier = data.get('student_identifier')
    email = data.get('email')
    
    if not student_identifier and not email:
        return Response(
            {'error': 'student_identifier or email is required to identify the student'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Find student
    student = None
    if email:
        try:
            student = Student.objects.get(email=email)
        except Student.DoesNotExist:
            return Response(
                {'error': f'Student with email {email} not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    else:
        try:
            student = Student.objects.get(user__username=student_identifier.lower())
        except Student.DoesNotExist:
            return Response(
                {'error': f'Student with identifier {student_identifier} not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    # Update fields
    if 'first_name' in data:
        student.first_name = data['first_name']
        student.user.first_name = data['first_name']
    if 'last_name' in data:
        student.last_name = data['last_name']
        student.user.last_name = data['last_name']
    if 'email' in data and data['email'] != student.email:
        student.email = data['email']
        student.user.email = data['email']
    if 'is_admin' in data:
        student.is_admin = data['is_admin']
    
    student.save()
    student.user.save()
    
    logger.info(f"Student updated via unified webhook: {student} (ID: {student.id})")
    
    return Response({
        'success': True,
        'message': 'Student updated successfully',
        'student': {
            'id': student.id,
            'identifier': student.user.username,
            'name': f"{student.first_name} {student.last_name}",
            'email': student.email,
            'is_admin': student.is_admin
        },
        'source': source
    }, status=status.HTTP_200_OK)

def handle_event_operation(action, data, source, metadata):
    """Handle event creation and updates."""
    try:
        if action == 'create':
            return create_event(data, source, metadata)
        elif action == 'update':
            return update_event(data, source, metadata)
        else:
            return Response(
                {'error': f'Unknown action: {action}. Valid actions for events: create, update'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        logger.error(f"Error in event operation: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Failed to process event operation', 'details': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def create_event(data, source, metadata):
    """Create a new event."""
    # Extract required fields
    event_name = data.get('event_name')
    event_date = data.get('event_date')
    organization = 'ASC'  # Default organization
    event_type = 'General'  # Default event type
    function = 'General'  # Default function
    points = data.get('points', 0)
    description = data.get('description', '')
    location = data.get('location', '')
    
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
    
    # Create event
    event = Event.objects.create(
        name=event_name,
        date=event_date,
        organization=organization,
        event_type=event_type,
        function=function,
        points=points,
        description=description,
        location=location
    )
    
    logger.info(f"Event created via unified webhook: {event} (ID: {event.id})")
    
    return Response({
        'success': True,
        'message': 'Event created successfully',
        'event': {
            'id': event.id,
            'name': event_name,
            'date': event_date.isoformat(),
            'organization': organization,
            'event_type': event_type,
            'function': function,
            'points': points,
            'description': description,
            'location': location
        },
        'source': source
    }, status=status.HTTP_201_CREATED)

def update_event(data, source, metadata):
    """Update an existing event."""
    event_identifier = data.get('event_identifier')
    event_name = data.get('event_name')
    
    if not event_identifier and not event_name:
        return Response(
            {'error': 'event_identifier or event_name is required to identify the event'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Find event
    event = None
    if event_identifier:
        try:
            event = Event.objects.get(id=event_identifier)
        except (Event.DoesNotExist, ValueError):
            try:
                event = Event.objects.get(name=event_identifier)
            except Event.DoesNotExist:
                return Response(
                    {'error': f'Event with identifier {event_identifier} not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
    else:
        try:
            event = Event.objects.get(name=event_name)
        except Event.DoesNotExist:
            return Response(
                {'error': f'Event with name {event_name} not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    # Update fields
    if 'event_name' in data:
        event.name = data['event_name']
    if 'event_date' in data:
        try:
            if isinstance(data['event_date'], str):
                event.date = datetime.fromisoformat(data['event_date'].replace('Z', '+00:00'))
            else:
                event.date = data['event_date']
        except ValueError:
            return Response(
                {'error': 'Invalid event_date format. Use ISO format (e.g., 2024-01-15T10:00:00Z)'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    # For webhook updates, we'll keep the existing values unless explicitly provided
    # (which they won't be based on your clarification)
    if 'points' in data:
        event.points = data['points']
    if 'description' in data:
        event.description = data['description']
    if 'location' in data:
        event.location = data['location']
    
    event.save()
    
    logger.info(f"Event updated via unified webhook: {event} (ID: {event.id})")
    
    return Response({
        'success': True,
        'message': 'Event updated successfully',
        'event': {
            'id': event.id,
            'name': event.name,
            'date': event.date.isoformat(),
            'organization': event.organization,
            'event_type': event.event_type,
            'function': event.function,
            'points': event.points,
            'description': event.description,
            'location': event.location
        },
        'source': source
    }, status=status.HTTP_200_OK)

def handle_attendance_operation(action, data, source, metadata):
    """Handle attendance operations."""
    try:
        if action == 'create':
            return create_attendance(data, source, metadata)
        else:
            return Response(
                {'error': f'Unknown action: {action}. Valid actions for attendance: create'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        logger.error(f"Error in attendance operation: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Failed to process attendance operation', 'details': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def create_attendance(data, source, metadata):
    """Create a new attendance record."""
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
    logger.info(f"Attendance recorded via unified webhook: {student} at {event} (ID: {attendance.id})")
    
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

@api_view(['GET'])
@permission_classes([AllowAny])
def unified_webhook_status(request):
    """
    Health check endpoint for unified webhook monitoring.
    """
    return Response({
        'status': 'healthy',
        'message': 'Unified webhook is operational',
        'supported_types': ['student', 'event', 'attendance'],
        'supported_actions': {
            'student': ['create', 'update'],
            'event': ['create', 'update'],
            'attendance': ['create']
        },
        'endpoints': {
            'unified_webhook': '/api/webhook/unified/',
            'status': '/api/webhook/unified/status/'
        }
    })


