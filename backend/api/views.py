from django.shortcuts import render

from rest_framework import viewsets
from rest_framework.decorators import action
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
    queryset = Attendance.objects.select_related('student').all()
    serializer_class = AttendanceSerializer

    def create(self, request, *args, **kwargs):
        try:
            # Debug logging
            print("Attendance creation request data:", request.data)
            
            student_id = request.data.get('student')
            event_id = request.data.get('event')
            
            print(f"Attempting to create attendance for student {student_id} at event {event_id}")
            
            # Validate input data
            if not student_id or not event_id:
                return Response(
                    {'error': 'Both student and event are required'}, 
                    status=400
                )
            
            # Check if student exists
            try:
                student = Student.objects.get(id=student_id)
            except Student.DoesNotExist:
                return Response(
                    {'error': f'Student with id {student_id} does not exist'}, 
                    status=404
                )
            
            # Check if event exists
            try:
                event = Event.objects.get(id=event_id)
            except Event.DoesNotExist:
                return Response(
                    {'error': f'Event with id {event_id} does not exist'}, 
                    status=404
                )
            
            # Check for existing attendance
            if Attendance.objects.filter(student_id=student_id, event_id=event_id).exists():
                return Response(
                    {'error': 'Student already checked in'}, 
                    status=400
                )
                
            # Create the attendance record
            attendance = Attendance.objects.create(
                student_id=student_id,
                event_id=event_id
            )
            
            # Return the serialized data
            return Response(
                AttendanceSerializer(attendance).data,
                status=201
            )
            
        except Exception as e:
            print(f"Error creating attendance: {str(e)}")
            return Response(
                {'error': f'Server error: {str(e)}'}, 
                status=500
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