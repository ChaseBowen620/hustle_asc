import json
import logging
import os
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

# Dedicated debug logger for OneTap webhook requests → writes to log.txt in this directory
debug_logger = logging.getLogger('onetap_debug')
try:
    _debug_log_path = os.path.join(os.path.dirname(__file__), 'log.txt')
    # Avoid adding duplicate handlers on autoreload
    if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == _debug_log_path for h in debug_logger.handlers):
        _fh = logging.FileHandler(_debug_log_path)
        _fh.setLevel(logging.INFO)
        _fh.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
        debug_logger.addHandler(_fh)
        debug_logger.setLevel(logging.INFO)
        debug_logger.propagate = False
except Exception:
    # If file handler cannot be created, fall back silently; main logger will still capture
    pass

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
        try:
            debug_logger.info(f"REQUEST {request.method} {request.path} Headers={dict(request.headers)} Body={request.body.decode('utf-8', errors='replace')}")
        except Exception as _e:
            debug_logger.error(f"REQUEST log failure: {str(_e)}")
        
        # Parse JSON payload
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON payload: {e}")
            debug_logger.error(f"Invalid JSON payload: {str(e)} Body={request.body.decode('utf-8', errors='replace')}")
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
            debug_logger.error("Rejected request: missing profile email")
            return Response(
                {'error': 'Profile email is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not list_data.get('name'):
            debug_logger.error("Rejected request: missing event name in list data")
            return Response(
                {'error': 'Event name is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Process the check-in
        result = process_onetap_checkin(participant_data, profile_data, list_data)
        try:
            debug_logger.info(f"SUCCESS student={result.get('data',{}).get('student')} event={result.get('data',{}).get('event')} attendance={result.get('data',{}).get('attendance')}")
        except Exception as _e:
            debug_logger.error(f"SUCCESS log failure: {str(_e)}")
        
        return Response(result, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"OneTap webhook error: {str(e)}", exc_info=True)
        try:
            debug_logger.error(f"ERROR {str(e)}", exc_info=True)
        except Exception:
            pass
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
        raw_event_name = list_data.get('name', '').strip()
        event_date_str = list_data.get('date', '')
        event_description = list_data.get('description', '')
        
        # Parse event name: format is "Organization - Event Name"
        # Split on " - " (space hyphen space) to separate organization and event name
        if ' - ' in raw_event_name:
            parts = raw_event_name.split(' - ', 1)  # Split only on first occurrence
            organization = parts[0].strip()
            event_name = parts[1].strip() if len(parts) > 1 else raw_event_name
        else:
            # If no " - " found, use the full name as event name and default organization
            organization = None  # Will be set to default in create_or_find_event
            event_name = raw_event_name
        
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
            event_name, event_date, event_description, organization
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
                    'email': student.user.email,
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
    
    # Helper function to ensure student has a user
    def ensure_student_has_user(student, email_handle):
        """Ensure a student has a corresponding user. Create one if missing."""
        # Check if user exists by checking user_id or trying to access user
        user_exists = True
        try:
            # Check if user_id is None or if accessing user raises an exception
            if hasattr(student, 'user_id') and student.user_id is None:
                user_exists = False
            else:
                # Try to access the user to see if it exists
                _ = student.user  # This will raise User.DoesNotExist if missing
        except User.DoesNotExist:
            user_exists = False
        except AttributeError:
            # Fallback: check user_id directly
            user_exists = getattr(student, 'user_id', None) is not None
        
        if not user_exists:
            # Student exists but has no user - create one
            username = email_handle.lower()
            
            # Ensure username is unique
            original_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{original_username}_{counter}"
                counter += 1
            
            # Create user account with password "changeme!"
            # Use the email parameter passed to the outer function
            user = User.objects.create_user(
                username=username,
                email=email,  # Use email from outer function scope
                password='changeme!',
                first_name=student.first_name,
                last_name=student.last_name,
                is_active=True
            )
            
            # Update student to link to the new user
            student.user = user
            student.save()
            
            logger.info(f"Created missing user for student {student.first_name} {student.last_name}: username={username}, email={user.email}")
            return student
        return student
    
    # Get username from email handle (part before @)
    email_handle = email.split('@')[0] if '@' in email else email
    
    # Try to find existing student by email first (email is on the User model)
    student = None
    try:
        student = Student.objects.get(user__email=email)
        logger.info(f"Found existing student by email: {student.first_name} {student.last_name}")
        # Ensure student has a user
        student = ensure_student_has_user(student, email_handle)
        return student
    except Student.DoesNotExist:
        pass
    
    # Try to find by A-number if provided
    if a_number:
        try:
            student = Student.objects.get(user__username=a_number.lower())
            logger.info(f"Found existing student by A-number: {student.first_name} {student.last_name}")
            # Ensure student has a user
            student = ensure_student_has_user(student, email_handle)
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
            # Ensure student has a user
            student = ensure_student_has_user(student, email_handle)
            return student
        except Student.DoesNotExist:
            pass
    
    # Create new student - use email handle for username
    username = email_handle.lower()
    
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
        # Check if student profile already exists for this user
        if Student.objects.filter(user=user).exists():
            student = Student.objects.get(user=user)
            logger.info(f"Found existing student profile for user: {student.first_name} {student.last_name}")
            return student
    else:
        # Create user account with password "changeme!"
        user = User.objects.create_user(
            username=username,
            email=email,
            password='changeme!',
            first_name=first_name,
            last_name=last_name,
            is_active=True
        )
        logger.info(f"Created new user: {user.username}")
    
    # Create student profile (user is guaranteed to exist at this point)
    student = Student.objects.create(
        user=user,
        first_name=first_name,
        last_name=last_name,
        username=username
    )
    
    logger.info(f"Created new student: {student.first_name} {student.last_name} ({email})")
    return student

def create_or_find_event(event_name, event_date, event_description, organization=None):
    """Create or find an event based on OneTap list data."""
    
    # Try to find existing event by name and date
    try:
        event = Event.objects.get(
            name=event_name,
            date__date=event_date.date()
        )
        logger.info(f"Found existing event: {event.name} on {event.date}")
        # Update organization if provided and different
        if organization and event.organization != organization:
            event.organization = organization
            event.event_type = organization  # Map event type to organization as well
            event.save()
            logger.info(f"Updated event organization to: {organization}")
        return event
    except Event.DoesNotExist:
        pass
    
    # Create new event
    
    # Use provided organization or default to 'ASC'
    if not organization:
        organization = 'ASC'  # Default organization
    
    # Map event type to organization (as per user request)
    event_type = organization
    
    logger.info(f"Processing event name: '{event_name}'")
    logger.info(f"Organization: {organization}, event_type: {event_type}")
    
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
