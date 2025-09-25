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
from .models import Student, Event, Attendance
import hashlib
import hmac
from django.conf import settings

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def attendance_webhook(request):
    """
    Webhook endpoint to receive attendance data from external apps.
    
    Expected payload format:
    {
        "student_identifier": "a12345678" or "email@example.com",
        "event_identifier": "event_id" or "event_name",
        "check_in_time": "2024-01-15T10:30:00Z",  # Optional, defaults to now
        "source": "external_app_name",  # Optional, for tracking
        "metadata": {}  # Optional, additional data
    }
    """
    try:
        # Log the incoming request
        logger.info(f"Webhook received: {request.method} {request.path}")
        logger.info(f"Headers: {dict(request.headers)}")
        
        # Parse JSON payload
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return Response(
                {'error': 'Invalid JSON payload'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract required fields
        student_identifier = payload.get('student_identifier')
        event_identifier = payload.get('event_identifier')
        check_in_time = payload.get('check_in_time')
        source = payload.get('source', 'webhook')
        metadata = payload.get('metadata', {})
        
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
        logger.info(f"Attendance created: {student} at {event} via {source}")
        
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
        logger.error(f"Webhook error: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Internal server error', 'details': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def webhook_status(request):
    """
    Health check endpoint for webhook monitoring.
    """
    return Response({
        'status': 'healthy',
        'message': 'Attendance webhook is operational',
        'endpoints': {
            'attendance_webhook': '/api/webhook/attendance/',
            'status': '/api/webhook/status/'
        }
    })


# Optional: Webhook with signature verification for security
@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def secure_attendance_webhook(request):
    """
    Secure webhook endpoint with HMAC signature verification.
    Requires WEBHOOK_SECRET to be set in settings.
    """
    try:
        # Get signature from headers
        signature = request.headers.get('X-Webhook-Signature')
        if not signature:
            return Response(
                {'error': 'Missing X-Webhook-Signature header'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Verify signature
        webhook_secret = getattr(settings, 'WEBHOOK_SECRET', None)
        if not webhook_secret:
            logger.warning("WEBHOOK_SECRET not configured, skipping signature verification")
        else:
            expected_signature = hmac.new(
                webhook_secret.encode('utf-8'),
                request.body,
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                return Response(
                    {'error': 'Invalid signature'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
        
        # Process the webhook (same logic as regular webhook)
        # Parse JSON payload
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return Response(
                {'error': 'Invalid JSON payload'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract required fields
        student_identifier = payload.get('student_identifier')
        event_identifier = payload.get('event_identifier')
        check_in_time = payload.get('check_in_time')
        source = payload.get('source', 'webhook')
        metadata = payload.get('metadata', {})
        
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
        logger.info(f"Secure attendance created: {student} at {event} via {source}")
        
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
        logger.error(f"Secure webhook error: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Internal server error'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
