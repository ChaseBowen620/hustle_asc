import json
import logging
import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import Student, Event, Attendance, Organization, EventOrganization
from datetime import datetime
import re

def _naive_dt(iso_str_or_none):
    """Parse ISO datetime string to naive datetime (for SQLite when USE_TZ=False)."""
    if not iso_str_or_none:
        return None
    s = iso_str_or_none.replace('Z', '+00:00')
    try:
        dt = datetime.fromisoformat(s)
        if hasattr(dt, 'tzinfo') and dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        return dt
    except (ValueError, TypeError):
        return None

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
        
        # Load organizations sorted by name length descending (longer names match first)
        org_list = list(Organization.objects.all().order_by('-name'))
        org_list.sort(key=lambda o: len(o.name), reverse=True)
        
        # Parse event name by containment: match org names contained in raw_event_name
        raw_lower = raw_event_name.lower()
        matched_names = []
        for org in org_list:
            if org.name.lower() in raw_lower:
                matched_names.append(org.name)
        
        if matched_names:
            primary_org_name = matched_names[0]
            secondary_org_names = [n for n in matched_names[1:] if n != primary_org_name]
        else:
            Organization.objects.get_or_create(name='Other')
            primary_org_name = 'Other'
            secondary_org_names = []
        
        event_name = raw_event_name
        
        # Parse event date (naive datetime for SQLite when USE_TZ=False)
        event_date = _naive_dt(event_date_str) if event_date_str else None
        if event_date is None:
            event_date = datetime.now()
        
        # Extract check-in time (naive datetime)
        check_in_date_str = participant_data.get('checkInDate', '')
        check_in_time = _naive_dt(check_in_date_str) if check_in_date_str else None
        if check_in_time is None:
            check_in_time = datetime.now()
        
        # Step 1: Create or find student
        student = create_or_find_student(
            first_name, last_name, profile_email, a_number, profile_phone
        )
        
        # Step 2: Create or find event
        event = create_or_find_event(
            event_name, event_date, event_description,
            primary_org_name=primary_org_name,
            secondary_org_names=secondary_org_names
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
                    'a_number': getattr(student, 'a_number', '') or a_number
                },
                'event': {
                    'id': event.id,
                    'name': event.name,
                    'date': event.date.isoformat(),
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
    """Create or find a student based on OneTap profile data. Uses Student model only (a_number, no email)."""
    a_number = (a_number or '').strip().lower() if a_number else ''
    email_handle = (email or '').split('@')[0].lower() if email and '@' in email else 'student'

    # Find by A-number
    if a_number:
        student = Student.objects.filter(a_number=a_number).first()
        if student:
            logger.info(f"Found existing student by A-number: {student.first_name} {student.last_name}")
            return student

    # Find by name
    if first_name and last_name:
        student = Student.objects.filter(
            first_name__iexact=first_name,
            last_name__iexact=last_name
        ).first()
        if student:
            logger.info(f"Found existing student by name: {student.first_name} {student.last_name}")
            if a_number and not student.a_number:
                student.a_number = a_number
                student.save(update_fields=['a_number'])
            return student

    # Create new student
    anum = a_number if a_number else email_handle
    base_anum = anum
    counter = 1
    while Student.objects.filter(a_number=anum).exists():
        anum = f"{base_anum}_{counter}"
        counter += 1

    student = Student.objects.create(
        first_name=first_name or '',
        last_name=last_name or '',
        a_number=anum
    )
    logger.info(f"Created new student: {student.first_name} {student.last_name} (A-number: {anum})")
    return student

def create_or_find_event(event_name, event_date, event_description, primary_org_name=None, secondary_org_names=None):
    """Create or find an event based on OneTap list data. primary_org_name and secondary_org_names are organization names."""
    # Ensure naive datetime for SQLite when USE_TZ=False (defensive: in case caller passes aware dt)
    if event_date is not None and hasattr(event_date, 'tzinfo') and event_date.tzinfo is not None:
        event_date = event_date.replace(tzinfo=None)
    if not primary_org_name:
        Organization.objects.get_or_create(name='Other')
        primary_org_name = 'Other'
    if secondary_org_names is None:
        secondary_org_names = []
    
    # Try to find existing event by name and date
    try:
        event = Event.objects.get(
            name=event_name,
            date__date=event_date.date()
        )
        logger.info(f"Found existing event: {event.name} on {event.date}")
        if event.organization != primary_org_name:
            event.organization = primary_org_name
            event.save()
            logger.info(f"Updated event organization to: {primary_org_name}")
        # Replace secondaries
        EventOrganization.objects.filter(event=event).delete()
        for name in secondary_org_names:
            if name == primary_org_name:
                continue
            try:
                org = Organization.objects.get(name=name)
                EventOrganization.objects.get_or_create(event=event, organization=org)
            except Organization.DoesNotExist:
                logger.warning(f"Organization name '{name}' not found, skipping secondary")
        return event
    except Event.DoesNotExist:
        pass
    
    logger.info(f"Processing event name: '{event_name}'")
    logger.info(f"Primary organization: {primary_org_name}, secondaries: {secondary_org_names}")
    
    event = Event.objects.create(
        name=event_name,
        date=event_date,
        organization=primary_org_name,
    )
    
    for name in secondary_org_names:
        if name == primary_org_name:
            continue
        try:
            org = Organization.objects.get(name=name)
            EventOrganization.objects.get_or_create(event=event, organization=org)
        except Organization.DoesNotExist:
            logger.warning(f"Organization name '{name}' not found, skipping secondary")
    
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
