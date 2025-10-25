import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from .models import Student, Event, Attendance, Semester
from datetime import datetime
import re

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def onetap_webhook_handler(request):
    """
    Handle OneTap webhook payloads for participant check-ins.
    
    Expected OneTap payload format:
    {
        "event": "participant.checkin",
        "timestamp": "2025-10-13T02:05:58.956Z",
        "organizationId": "dml3yomDR5",
        "integrationId": "C2wU0Wgxjm",
        "data": {
            "participant": {
                "id": "6aK2kU2Eo4",
                "checkedIn": true,
                "checkedOut": false,
                "checkInDate": "2025-10-13T02:05:58.892Z",
                "checkInMethod": "tap",
                "createdAt": "2025-10-13T02:05:54.393Z",
                "updatedAt": "2025-10-13T02:05:58.893Z"
            },
            "profile": {
                "id": "52irSENV2G",
                "name": "Test",
                "email": "email@email.com",
                "phone": "7777777777",
                "customFields": {
                    "A-Number": "A01111111"
                }
            },
            "list": {
                "id": "i4fnMFdW7h",
                "name": "test event",
                "date": "2025-10-13T02:04:24.000Z",
                "description": ""
            }
        }
    }
    """
    try:
        # Log the incoming request
        logger.info(f"OneTap webhook received: {request.method} {request.path}")
        logger.info(f"Headers: {dict(request.headers)}")
        
        # Parse JSON payload
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON payload: {e}")
            return Response(
                {'error': 'Invalid JSON payload'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Log the full payload for debugging
        logger.info(f"OneTap payload: {json.dumps(payload, indent=2)}")
        
        # Extract data from OneTap format
        event_type = payload.get('event')
        if event_type != 'participant.checkin':
            return Response(
                {'error': f'Unsupported event type: {event_type}. Only participant.checkin is supported'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        data = payload.get('data', {})
        participant_data = data.get('participant', {})
        profile_data = data.get('profile', {})
        list_data = data.get('list', {})
        
        # Validate required fields
        if not profile_data.get('email'):
            return Response(
                {'error': 'Profile email is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not list_data.get('name'):
            return Response(
                {'error': 'Event name is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Process the check-in
        result = process_onetap_checkin(participant_data, profile_data, list_data)
        
        return Response(result, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"OneTap webhook error: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Internal server error', 'details': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def process_onetap_checkin(participant_data, profile_data, list_data):
    """
    Process a OneTap check-in by creating/updating student, event, and attendance.
    """
    try:
        # Extract profile information
        profile_name = profile_data.get('name', '').strip()
        profile_email = profile_data.get('email', '').strip()
        profile_phone = profile_data.get('phone', '')
        custom_fields = profile_data.get('customFields', {})
        a_number = custom_fields.get('A-Number', '').strip()
        
        # Parse name (assume format is "First Last" or "First Middle Last")
        name_parts = profile_name.split()
        if len(name_parts) >= 2:
            first_name = name_parts[0]
            last_name = ' '.join(name_parts[1:])  # Handle middle names
        else:
            first_name = profile_name
            last_name = ''
        
        # Extract event information
        event_name = list_data.get('name', '').strip()
        event_date_str = list_data.get('date', '')
        event_description = list_data.get('description', '')
        
        # Parse event date
        try:
            if event_date_str:
                # OneTap sends ISO format, convert to datetime
                event_date = datetime.fromisoformat(event_date_str.replace('Z', '+00:00'))
            else:
                # Use current time if no date provided
                event_date = datetime.now()
        except ValueError:
            event_date = datetime.now()
        
        # Extract check-in time
        check_in_date_str = participant_data.get('checkInDate', '')
        try:
            if check_in_date_str:
                check_in_time = datetime.fromisoformat(check_in_date_str.replace('Z', '+00:00'))
            else:
                check_in_time = datetime.now()
        except ValueError:
            check_in_time = datetime.now()
        
        # Step 1: Create or find student
        student = create_or_find_student(
            first_name, last_name, profile_email, a_number, profile_phone
        )
        
        # Step 2: Create or find event
        event = create_or_find_event(
            event_name, event_date, event_description
        )
        
        # Step 3: Create attendance record
        attendance = create_attendance_record(student, event, check_in_time)
        
        # Return success response
        return {
            'success': True,
            'message': 'Check-in processed successfully',
            'data': {
                'student': {
                    'id': student.id,
                    'name': f"{student.first_name} {student.last_name}",
                    'email': student.email,
                    'a_number': a_number
                },
                'event': {
                    'id': event.id,
                    'name': event.name,
                    'date': event.date.isoformat(),
                    'location': event.location
                },
                'attendance': {
                    'id': attendance.id,
                    'checked_in_at': attendance.checked_in_at.isoformat()
                }
            },
            'source': 'onetap_webhook'
        }
        
    except Exception as e:
        logger.error(f"Error processing OneTap check-in: {str(e)}", exc_info=True)
        raise

def create_or_find_student(first_name, last_name, email, a_number, phone):
    """Create or find a student based on OneTap profile data."""
    
    # Try to find existing student by email first
    student = None
    try:
        student = Student.objects.get(email=email)
        logger.info(f"Found existing student by email: {student.first_name} {student.last_name}")
        return student
    except Student.DoesNotExist:
        pass
    
    # Try to find by A-number if provided
    if a_number:
        try:
            student = Student.objects.get(user__username=a_number.lower())
            logger.info(f"Found existing student by A-number: {student.first_name} {student.last_name}")
            return student
        except Student.DoesNotExist:
            pass
    
    # Try to find by name
    if first_name and last_name:
        try:
            student = Student.objects.get(
                first_name__iexact=first_name,
                last_name__iexact=last_name
            )
            logger.info(f"Found existing student by name: {student.first_name} {student.last_name}")
            return student
        except Student.DoesNotExist:
            pass
    
    # Create new student
    username = a_number.lower() if a_number else email.split('@')[0]
    
    # Ensure username is unique
    original_username = username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{original_username}_{counter}"
        counter += 1
    
    # Check if user already exists (additional safety check)
    if User.objects.filter(email=email).exists():
        user = User.objects.get(email=email)
        logger.info(f"Found existing user by email: {user.username}")
    else:
        # Create user account
        user = User.objects.create_user(
            username=username,
            email=email,
            password='onetap_default_password_2024',
            first_name=first_name,
            last_name=last_name,
            is_active=True
        )
        logger.info(f"Created new user: {user.username}")
    
    # Check if student profile already exists for this user
    if Student.objects.filter(user=user).exists():
        student = Student.objects.get(user=user)
        logger.info(f"Found existing student profile for user: {student.first_name} {student.last_name}")
        return student
    
    # Create student profile
    student = Student.objects.create(
        user=user,
        first_name=first_name,
        last_name=last_name,
        email=email,
        a_number=a_number,
        is_admin=False
    )
    
    logger.info(f"Created new student: {student.first_name} {student.last_name} ({email})")
    return student

def create_or_find_event(event_name, event_date, event_description):
    """Create or find an event based on OneTap list data."""
    
    # Try to find existing event by name and date
    try:
        event = Event.objects.get(
            name=event_name,
            date__date=event_date.date()
        )
        logger.info(f"Found existing event: {event.name} on {event.date}")
        return event
    except Event.DoesNotExist:
        pass
    
    # Create new event
    
    # Get unique organizations and event types from database
    existing_organizations = list(Event.objects.values_list('organization', flat=True).distinct())
    existing_event_types = list(Event.objects.values_list('event_type', flat=True).distinct())
    
    logger.info(f"Available organizations: {existing_organizations}")
    logger.info(f"Available event types: {existing_event_types}")
    logger.info(f"Processing event name: '{event_name}'")
    
    # Extract organization from event name (case-sensitive)
    organization = 'ASC'  # Default organization
    
    for org in existing_organizations:
        if org and org in event_name:  # Case-sensitive match
            organization = org
            logger.info(f"Matched organization: {org}")
            break
    
    # Check if event name contains any of the existing event types
    event_name_lower = event_name.lower()
    event_type = 'General'  # Default value
    
    for existing_type in existing_event_types:
        if existing_type and existing_type.lower() in event_name_lower:
            event_type = existing_type
            logger.info(f"Matched event type: {existing_type}")
            break
    
    logger.info(f"Final organization: {organization}, event_type: {event_type}")
    
    # Get current semester (or create a default one)
    current_semester = Semester.objects.filter(is_current=True).first()
    if not current_semester:
        current_semester = Semester.objects.create(
            name="Current Semester",
            start_date=datetime.now().date(),
            end_date=datetime.now().date(),
            is_current=True
        )
    
    # Create event
    event = Event.objects.create(
        name=event_name,
        date=event_date,
        organization=organization,
        event_type=event_type,
        description=event_description,
        location='ASC Space'  # Default location
    )
    
    logger.info(f"Created new event: {event.name} on {event.date}")
    return event

def create_attendance_record(student, event, check_in_time):
    """Create an attendance record for the student and event."""
    
    # Check for existing attendance
    existing_attendance = Attendance.objects.filter(
        student=student,
        event=event
    ).first()
    
    if existing_attendance:
        logger.info(f"Student {student.first_name} {student.last_name} already attended {event.name}")
        return existing_attendance
    
    # Create new attendance record
    attendance = Attendance.objects.create(
        student=student,
        event=event
    )
    
    logger.info(f"Created attendance record: {student.first_name} {student.last_name} → {event.name}")
    return attendance

@api_view(['GET'])
@permission_classes([AllowAny])
def onetap_webhook_status(request):
    """
    Health check endpoint for OneTap webhook.
    """
    return Response({
        'status': 'healthy',
        'message': 'OneTap webhook handler is operational',
        'supported_events': ['participant.checkin'],
        'endpoint': '/api/webhook/onetap-handler/'
    })
