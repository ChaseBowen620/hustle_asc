from django.core.management.base import BaseCommand
from api.models import Student

class Command(BaseCommand):
    help = 'Populates the username field for existing students from their user account'

    def handle(self, *args, **options):
        students = Student.objects.filter(username__isnull=True).exclude(user__isnull=True)
        
        updated_count = 0
        for student in students:
            if student.user and student.user.username:
                student.username = student.user.username
                student.save(update_fields=['username'])
                updated_count += 1
                self.stdout.write(f'Updated {student.first_name} {student.last_name}: {student.username}')
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully updated {updated_count} student usernames')
        )
