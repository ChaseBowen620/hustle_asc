"""
Scan the database for likely duplicate student accounts.

Detects:
- Same A-number (username) on multiple accounts
- Same email on multiple accounts
- Same first+last name (different email/A-number) — likely same person, two accounts
- Similar names (optional fuzzy) for review

Report-only; does not merge or delete.
"""
from collections import defaultdict
from django.core.management.base import BaseCommand
from api.models import Student


def norm(s):
    return (s or '').strip().lower()


def norm_name(first, last):
    return (norm(first), norm(last))


class Command(BaseCommand):
    help = 'Find likely duplicate student accounts (report only, no merge)'

    def add_arguments(self, parser):
        parser.add_argument('--show-attendance', action='store_true', help='Show attendance count per student')

    def handle(self, *args, **options):
        show_attendance = options['show_attendance']
        students = list(
            Student.objects.select_related('user').all().order_by('last_name', 'first_name')
        )
        if show_attendance:
            for s in students:
                s._att_count = s.attendances.count()

        # Key -> list of student ids (or students)
        by_a_number = defaultdict(list)   # username (A-number)
        by_email = defaultdict(list)
        by_name = defaultdict(list)      # (first, last) normalized

        for s in students:
            a = (s.user.username or s.username or '').strip().lower()
            if a:
                by_a_number[a].append(s)
            e = norm(s.user.email)
            if e and not e.endswith('@placeholder'):
                by_email[e].append(s)
            fn, ln = norm(s.first_name), norm(s.last_name)
            if fn or ln:
                by_name[(fn, ln)].append(s)

        # Report
        self.stdout.write(self.style.SUCCESS('=== LIKELY DUPLICATES ===\n'))

        # 1. Same A-number, multiple accounts (definite duplicate)
        self.stdout.write(self.style.WARNING('1. Same A-number (username) — multiple accounts (definite duplicate):'))
        a_dup = {k: v for k, v in by_a_number.items() if len(v) > 1}
        if not a_dup:
            self.stdout.write('   None found.\n')
        else:
            for a_num, grp in sorted(a_dup.items()):
                self.stdout.write(f'   A-number: {a_num}')
                for s in grp:
                    line = f'      id={s.id}  {s.first_name} {s.last_name}  email={s.user.email or "(none)"}'
                    if show_attendance:
                        line += f'  attendances={getattr(s, "_att_count", "?")}'
                    self.stdout.write(line)
                self.stdout.write('')

        # 2. Same email, multiple accounts
        self.stdout.write(self.style.WARNING('2. Same email — multiple accounts:'))
        e_dup = {k: v for k, v in by_email.items() if len(v) > 1}
        if not e_dup:
            self.stdout.write('   None found.\n')
        else:
            for email, grp in sorted(e_dup.items()):
                self.stdout.write(f'   Email: {email}')
                for s in grp:
                    line = f'      id={s.id}  {s.first_name} {s.last_name}  A-number={s.user.username or s.username or "(none)"}'
                    if show_attendance:
                        line += f'  attendances={getattr(s, "_att_count", "?")}'
                    self.stdout.write(line)
                self.stdout.write('')

        # 3. Same first+last name, different accounts (likely same person, two signups)
        self.stdout.write(self.style.WARNING('3. Same first + last name — different accounts (possible duplicate):'))
        name_dup = {k: v for k, v in by_name.items() if len(v) > 1}
        if not name_dup:
            self.stdout.write('   None found.\n')
        else:
            for (fn, ln), grp in sorted(name_dup.items(), key=lambda x: (x[0][1], x[0][0])):
                # Skip if already listed under same A-number (avoid redundant report)
                a_nums = [(s.user.username or s.username or '').strip().lower() for s in grp]
                if len(set(a_nums)) == 1 and a_nums[0] and len(grp) > 1:
                    continue  # already in section 1
                self.stdout.write(f'   Name: {grp[0].first_name} {grp[0].last_name}')
                for s in grp:
                    line = f'      id={s.id}  email={s.user.email or "(none)"}  A-number={s.user.username or s.username or "(none)"}'
                    if show_attendance:
                        line += f'  attendances={getattr(s, "_att_count", "?")}'
                    self.stdout.write(line)
                self.stdout.write('')

        # Summary
        total_dup_groups = len(a_dup) + len(e_dup) + len([k for k, v in name_dup.items()
            if not (len(set((s.user.username or s.username or '').strip().lower() for s in v)) == 1 and (v[0].user.username or v[0].username or '').strip() and len(v) > 1)])
        self.stdout.write(self.style.SUCCESS(f'\nTotal duplicate groups reported above. No changes made (report only).'))
