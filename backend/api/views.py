from django.shortcuts import render
from django.http import HttpResponse


def robots_txt(request):
    """Serve robots.txt that disallows all crawlers; site contains personal information."""
    lines = [
        "# This site contains personal information. Crawling and indexing are not permitted.",
        "User-agent: *",
        "Disallow: /",
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain")

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from .models import Student, Event, Attendance
from .serializers import (
    StudentSerializer, 
    EventSerializer, 
    AttendanceSerializer,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from django.conf import settings
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET
from api.permissions import AllowAnyWithCSRFForUnsafe
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from zoneinfo import ZoneInfo
import os
import re

User = get_user_model()


def _request_from_app_origin(request):
    """
    Require request to come from a trusted app origin (blocks direct curl/script access).
    Uses CSRF_TRUSTED_ORIGINS; requests without a matching Origin or Referer get 403.
    """
    origin = request.META.get("HTTP_ORIGIN", "").strip()
    referer = request.META.get("HTTP_REFERER", "").strip()
    allowed = getattr(settings, "CSRF_TRUSTED_ORIGINS", [])
    if not allowed:
        return True  # no restriction if not configured
    for base in allowed:
        if origin and origin.rstrip("/") == base.rstrip("/"):
            return True
        if referer and referer.startswith(base):
            return True
    # Allow same-origin (no Origin set) when Referer is from allowed origin
    if not origin and referer:
        for base in allowed:
            if referer.startswith(base):
                return True
    return False


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def auth_login(request):
    """
    Issue JWT tokens for dashboard login. Credentials are validated against
    DASHBOARD_USERNAME and DASHBOARD_PASSWORD (set same as frontend VITE_LOGIN_* in backend .env).
    """
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    env_user = (os.environ.get('DASHBOARD_USERNAME') or '').strip()
    env_pass = os.environ.get('DASHBOARD_PASSWORD') or ''
    if not username or not env_user or username != env_user or password != env_pass:
        return Response(
            {'error': 'Invalid username or password.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    user, created = User.objects.get_or_create(
        username=env_user,
        defaults={'is_staff': False, 'is_active': True},
    )
    if created:
        user.set_unusable_password()
        user.save()
    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })


# ----- Public scan endpoints (QR code check-in; no login required) -----

@require_GET
@ensure_csrf_cookie
def public_scan_csrf_cookie(request):
    """Set the CSRF cookie so the frontend can send X-CSRFToken on POST. Call once when loading the scan page."""
    return HttpResponse("ok", content_type="text/plain")


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def public_scan_events(request):
    """Return today's events (America/Denver) for the /scan page. Optional ?organization=Name filter."""
    today_denver = datetime.now(ZoneInfo("America/Denver")).date()
    qs = Event.objects.filter(date__date=today_denver).order_by('date')
    org = (request.GET.get('organization') or '').strip()
    if org:
        qs = qs.filter(
            Q(organization__icontains=org) |
            Q(event_organizations__organization__name__icontains=org)
        ).distinct()
    serializer = EventSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def public_scan_student_lookup(request):
    """Look up a single student by A-number. For scan page only; does not expose full student list."""
    a_number = (request.GET.get('a_number') or '').strip().lower()
    if not re.match(r'^a\d{8}$', a_number):
        return Response({'found': False, 'error': 'Invalid A-number format'}, status=status.HTTP_400_BAD_REQUEST)
    student = Student.objects.filter(a_number=a_number).first()
    if not student:
        return Response({'found': False})
    return Response({
        'found': True,
        'student': {
            'id': student.id,
            'first_name': student.first_name,
            'last_name': student.last_name,
            'a_number': student.a_number or '',
        },
    })


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAnyWithCSRFForUnsafe])
@throttle_classes([AnonRateThrottle])
def public_scan_checkin(request):
    """Create a single attendance record. For scan page only; requires CSRF + rate limit."""
    student_id = request.data.get('student')
    event_id = request.data.get('event')
    if not student_id or not event_id:
        return Response(
            {'error': 'Both student and event are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        student = Student.objects.get(id=student_id)
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
    try:
        event = Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
    if Attendance.objects.filter(student_id=student_id, event_id=event_id).exists():
        return Response(
            {'error': 'Student already checked in'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    attendance = Attendance.objects.create(student_id=student_id, event_id=event_id)
    get_or_create_next_occurrence(event)
    return Response(AttendanceSerializer(attendance).data, status=status.HTTP_201_CREATED)


from django.db.models import Count, Sum
from django.db import models
from django.db.models import Q
from datetime import datetime
from dateutil.relativedelta import relativedelta
import calendar

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all().order_by('first_name', 'last_name')
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        print(f"Students API - Returning {len(serializer.data)} records")
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user = getattr(instance, 'user', None)
        instance.delete()
        if user:
            user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class EventListPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = EventListPagination

    def get_queryset(self):
        """Order by most recent first; annotate attendance count."""
        return Event.objects.all().annotate(attendance_count=Count('attendances')).order_by('-date')

    @action(detail=True, methods=['get'], url_path='attendance/export')
    def export_attendance_csv(self, request, pk=None):
        """Return event attendance as a CSV file download. No list needed on frontend."""
        import csv
        from io import StringIO

        event = self.get_object()
        attendances = (
            Attendance.objects.filter(event=event)
            .select_related('student')
            .order_by('student__last_name', 'student__first_name')
        )

        buffer = StringIO()
        writer = csv.writer(buffer)

        # Header row: event name, date (same format as frontend used)
        event_date = event.date.strftime('%m/%d/%y') if hasattr(event.date, 'strftime') else str(event.date)
        writer.writerow([event.name, event_date])
        writer.writerow(['First Name', 'Last Name', 'A-Number'])

        for att in attendances:
            student = att.student
            a_number = getattr(student, 'a_number', '') or 'N/A'
            writer.writerow([student.first_name, student.last_name, a_number])

        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='text/csv; charset=utf-8')
        safe_name = re.sub(r'[/\\?%*:|"<>]', '-', event.name)
        safe_date = event.date.strftime('%m-%d-%y') if hasattr(event.date, 'strftime') else 'export'
        response['Content-Disposition'] = f'attachment; filename="{safe_name}_Attendance_{safe_date}.csv"'
        return response

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

    def create(self, request, *args, **kwargs):
        """Override create to handle recurring events."""
        try:
            # Create the main event (first occurrence only for recurring; next occurrences created when students check in)
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            event = serializer.save()
            
            # Recurring: do not pre-create all instances; next occurrence is created on first check-in
            # (see get_or_create_next_occurrence in AttendanceViewSet.create)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

def _compute_next_occurrence_date(template, from_date):
    """Compute the next occurrence date from from_date using template's recurrence_type."""
    from datetime import timedelta
    import calendar
    if template.recurrence_type == 'daily':
        return from_date + timedelta(days=1)
    if template.recurrence_type == 'weekly':
        return from_date + timedelta(weeks=1)
    if template.recurrence_type == 'biweekly':
        return from_date + timedelta(weeks=2)
    if template.recurrence_type == 'monthly':
        if from_date.month == 12:
            next_year, next_month = from_date.year + 1, 1
        else:
            next_year, next_month = from_date.year, from_date.month + 1
        _, last_day = calendar.monthrange(next_year, next_month)
        day = min(from_date.day, last_day)
        return from_date.replace(year=next_year, month=next_month, day=day)
    return None


def _recurrence_stop_may1(from_date):
    """Return the next May 1 used as recurrence end: if from_date is before May 1, use that year; else next year."""
    from datetime import datetime
    if from_date.month < 5:
        return datetime(from_date.year, 5, 1)
    return datetime(from_date.year + 1, 5, 1)


def get_or_create_next_occurrence(event):
    """
    If event is recurring, ensure the next occurrence exists (create it if not).
    Recurring series stop at the start of May (05/01) each academic year; no per-event end date or parent link.
    Returns the next occurrence event or None.
    """
    from .models import EventOrganization
    if not event.is_recurring or event.recurrence_type in (None, '', 'none'):
        return None
    next_date = _compute_next_occurrence_date(event, event.date)
    if next_date is None:
        return None
    may1 = _recurrence_stop_may1(event.date)
    if next_date >= may1:
        return None
    existing = Event.objects.filter(name=event.name, organization=event.organization, date=next_date).first()
    if existing:
        return existing
    new_event = Event.objects.create(
        name=event.name,
        organization=event.organization,
        date=next_date,
        is_recurring=False,
        recurrence_type='none',
    )
    for eo in EventOrganization.objects.filter(event=event):
        EventOrganization.objects.get_or_create(event=new_event, organization=eo.organization)
    return new_event


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related('student', 'event').all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter attendance by organization based on admin role; optional filter by event id (?event=)."""
        from .models import EventOrganization, Organization

        queryset = Attendance.objects.select_related('student', 'event').all()

        # Optional: filter by event id (e.g. ?event=123 for attendees of one event)
        event_id = self.request.query_params.get('event')
        if event_id:
            try:
                queryset = queryset.filter(event_id=int(event_id))
            except ValueError:
                pass

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
            
            # No server-side date restriction: allow check-in for any event (e.g. late logging).
            # Date filtering is display-only on /scan and /checkin (today's events shown by default).

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
            
            # Recurring events: create the next occurrence when someone checks in (so it shows in the list)
            get_or_create_next_occurrence(event)
            
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

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAnyWithCSRFForUnsafe])
@throttle_classes([AnonRateThrottle])
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
        
        # Check if student with this A-number already exists
        if Student.objects.filter(a_number=a_number).exists():
            return Response({
                'error': 'A student with this A-number already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        student = Student.objects.create(
            a_number=a_number,
            first_name=request.data.get('first_name', ''),
            last_name=request.data.get('last_name', '')
        )
        return Response({
            'message': 'Student account created successfully',
            'a_number': a_number,
            'student_id': student.id
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def check_a_number(request):
    """Check if an A-number is already in the system. Query param: a_number (e.g. a01234567)."""
    a_number = (request.query_params.get('a_number') or '').lower().strip()
    if not a_number:
        return Response({'error': 'a_number query parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
    if not re.match(r'^a\d{8}$', a_number):
        return Response({'error': 'Invalid A-number format'}, status=status.HTTP_400_BAD_REQUEST)
    exists = Student.objects.filter(a_number=a_number).exists()
    return Response({'exists': exists})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def total_students(request):
    organization_filter = request.GET.get('organization', None)
    if organization_filter:
        from .models import EventOrganization
        count = Student.objects.filter(
            Q(attendances__event__organization=organization_filter) |
            Q(attendances__event__event_organizations__organization__name=organization_filter)
        ).distinct().count()
    else:
        count = Student.objects.count()
    return Response({'count': count})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def participating_students(request):
    filter_type = request.GET.get('filter', 'semester')
    organization_filter = request.GET.get('organization', None)
    from .models import EventOrganization
    query = Student.objects
    if organization_filter:
        query = query.filter(
            Q(attendances__event__organization=organization_filter) |
            Q(attendances__event__event_organizations__organization__name=organization_filter)
        )
    # Get current date
    now = timezone.now()
    
    if filter_type == 'semester':
        # Filter by current semester date range
        current_month = now.month
        current_year = now.year
        
        if current_month >= 8:  # Fall semester (Aug-Dec)
            semester_start = datetime(current_year, 8, 1)
            semester_end = datetime(current_year + 1, 1, 1)
        else:  # Spring semester (Jan-July)
            semester_start = datetime(current_year, 1, 1)
            semester_end = datetime(current_year, 8, 1)
        
        count = query.filter(
            attendances__event__date__gte=semester_start,
            attendances__event__date__lt=semester_end
        ).distinct().count()
    
    elif filter_type == 'year':
        year = now.year if now.month >= 8 else now.year - 1
        academic_year_start = datetime(year, 8, 1)
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
    organization_filter = request.GET.get('organization', None)
    from .models import EventOrganization
    students = Student.objects.all()
    if organization_filter:
        students = students.filter(
            Q(attendances__event__organization=organization_filter) |
            Q(attendances__event__event_organizations__organization__name=organization_filter)
        ).distinct()
    now = timezone.now()
    if filter_type == 'semester':
        current_month = now.month
        current_year = now.year
        if current_month >= 8:
            semester_start = datetime(current_year, 8, 1)
            semester_end = datetime(current_year + 1, 1, 1)
        else:
            semester_start = datetime(current_year, 1, 1)
            semester_end = datetime(current_year, 8, 1)
        if organization_filter:
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
        else:
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
        year = now.year if now.month >= 8 else now.year - 1
        academic_year_start = datetime(year, 8, 1)
        if organization_filter:
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
        else:
            students = students.annotate(
                filtered_points=Count(
                    'attendances',
                    filter=models.Q(attendances__event__date__gte=academic_year_start)
                )
            )
    else:  # 'all'
        if organization_filter:
            students = students.annotate(
                filtered_points=Count(
                    'attendances',
                    filter=models.Q(
                        Q(attendances__event__organization=organization_filter) |
                        Q(attendances__event__event_organizations__organization__name=organization_filter)
                    )
                )
            )
        else:
            students = students.annotate(filtered_points=Count('attendances'))
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
def no_attendance_in_period(request):
    """Return students with zero attendances where event.date is in [start, end]. Query: start=YYYY-MM-DD&end=YYYY-MM-DD or academic_year=YYYY (past year Aug 1–April 30)."""
    start_param = request.GET.get('start')
    end_param = request.GET.get('end')
    academic_year = request.GET.get('academic_year')
    if academic_year:
        try:
            y = int(academic_year)
            start_param = f'{y - 1}-08-01'
            end_param = f'{y}-04-30'
        except ValueError:
            return Response({'error': 'academic_year must be a year (e.g. 2024)'}, status=status.HTTP_400_BAD_REQUEST)
    if not start_param or not end_param:
        return Response({'error': 'start and end (YYYY-MM-DD) or academic_year required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        start = datetime.strptime(start_param, '%Y-%m-%d')
        end = datetime.strptime(end_param + ' 23:59:59', '%Y-%m-%d %H:%M:%S')
    except ValueError:
        return Response({'error': 'start and end must be YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
    student_ids_with_attendance = Attendance.objects.filter(
        event__date__range=(start, end)
    ).values_list('student_id', flat=True).distinct()
    students = Student.objects.exclude(id__in=student_ids_with_attendance).order_by('first_name', 'last_name')
    serializer = StudentSerializer(students, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def events_before(request):
    """Return events with date < before. Query: before=YYYY-MM-DD."""
    before_param = request.GET.get('before')
    if not before_param:
        return Response({'error': 'before=YYYY-MM-DD required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        before = datetime.strptime(before_param, '%Y-%m-%d')
    except ValueError:
        return Response({'error': 'before must be YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)
    events = Event.objects.filter(date__lt=before).order_by('-date')
    serializer = EventSerializer(events, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_duplicates(request):
    """GET: return list of duplicate student groups (same A-number or same name) for Settings UI. Never 500s; returns empty list on error."""
    try:
        from api.duplicate_students import get_duplicate_groups
        groups = get_duplicate_groups()
        return Response({'groups': groups or []})
    except Exception:
        return Response({'groups': []})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def student_merge_duplicates(request):
    """POST: run merge of duplicate students. Returns { groups_processed, accounts_merged }."""
    from api.duplicate_students import run_merge
    log = []
    try:
        stats = run_merge(dry_run=False, log=log)
        return Response({
            'groups_processed': stats['groups_processed'],
            'accounts_merged': stats['accounts_merged'],
            'log': log,
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _get_or_create_student_by_a_number(first_name, last_name, a_number):
    """Return (student, created). If a student exists with this A-number, return that student; else create one."""
    a_number = (a_number or '').lower().strip()
    if not a_number:
        return None, False
    student = Student.objects.filter(a_number=a_number).first()
    if student:
        return student, False
    student = Student.objects.create(
        a_number=a_number,
        first_name=first_name or '',
        last_name=last_name or '',
    )
    return student, True


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_students(request):
    """Search for students by name, email, or A-number."""
    query = request.GET.get('q', '').strip()
    
    if not query or len(query) < 2:
        return Response([])
    
    # Search by name or A-number
    students = Student.objects.filter(
        Q(first_name__icontains=query) |
        Q(last_name__icontains=query) |
        Q(a_number__icontains=query)
    )[:20]  # Limit to 20 results
    
    students_data = [
        {
            'id': student.id,
            'first_name': student.first_name,
            'last_name': student.last_name,
            'a_number': student.a_number or '',
            'username': student.a_number or '',
            'is_admin': False,
            'admin_role': None
        }
        for student in students
    ]
    return Response(students_data)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def list_organizations(request):
    """List all organizations or create a new one. No permission check."""
    from .models import Organization

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

def update_events_organization_name(old_name, new_name):
    """
    When an organization is renamed, update all events that reference the old name.
    Event.organization is a CharField storing the name.
    EventOrganization uses FK to Organization, so those stay correct after Organization.name is saved.
    """
    if not old_name or not new_name or old_name == new_name:
        return 0
    return Event.objects.filter(organization=old_name).update(organization=new_name)


@api_view(['PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_organization(request, organization_id):
    """Update or delete an organization. No permission check."""
    from .models import Organization

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
        
        old_name = organization.name
        organization.name = name
        organization.save()
        # Cascade the name change to all events that use this organization (primary name)
        update_events_organization_name(old_name, name)
        
        return Response({
            'id': organization.id,
            'name': organization.name,
            'created_at': organization.created_at,
            'updated_at': organization.updated_at
        })
    
    elif request.method == 'DELETE':
        organization.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_overview(request):
    attendance_query = Attendance.objects.all()
    attendance_data = attendance_query.annotate(
        date=models.functions.TruncMonth('checked_in_at')
    ).values('date', 'event__organization').annotate(
        count=Count('id')
    ).order_by('date')

    # Transform data for frontend (use organization as grouping key)
    transformed_data = []
    for entry in attendance_data:
        transformed_data.append({
            'date': entry['date'],
            'event_type': entry['event__organization'],
            'attendance_counts': entry['count']
        })

    return Response(transformed_data)