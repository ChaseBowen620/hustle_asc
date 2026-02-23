"""
Shared logic for finding and merging duplicate student accounts.
Used by the merge_duplicate_students management command and the /api/students/duplicates/ API.
"""
import re
from collections import defaultdict
from django.contrib.auth.models import User
from api.models import Student, Attendance

A_NUMBER_PATTERN = re.compile(r'^a\d{8}$')


def norm(s):
    return (s or '').strip().lower()


def norm_a_number(username):
    u = (username or '').strip().lower()
    if not u:
        return ''
    if u.startswith('a') and len(u) == 9 and u[1:].isdigit():
        return u
    if len(u) == 8 and u.isdigit():
        return 'a' + u
    return u


def has_a_number_username(student):
    u = norm(student.user.username or student.username or '')
    return bool(A_NUMBER_PATTERN.match(u))


def has_a_number_email(student):
    e = norm(student.user.email or '')
    if not e or '@' not in e:
        return False
    local = e.split('@')[0]
    domain = e.split('@')[1]
    if domain not in ('usu.edu', 'aggies.usu.edu'):
        return False
    return bool(re.match(r'^a?\d{8}$', local))


def has_a_number_or_a_number_email(student):
    return has_a_number_username(student) or has_a_number_email(student)


def attendance_count(student):
    return student.attendances.count()


def pick_canonical(students, prefer_a_number=True):
    students = list(students)
    if not students:
        return None
    if len(students) == 1:
        return students[0]
    counts = {s.id: attendance_count(s) for s in students}
    if prefer_a_number:
        with_an = [s for s in students if has_a_number_or_a_number_email(s)]
        candidates = with_an if with_an else students
    else:
        candidates = students
    return max(candidates, key=lambda s: (counts[s.id], -s.id))


def _student_to_dict(s):
    user = getattr(s, 'user', None)
    return {
        'id': s.id,
        'first_name': s.first_name or '',
        'last_name': s.last_name or '',
        'email': (user.email if user else '') or '',
        'username': (user.username if user else '') or (getattr(s, 'username', '') or ''),
        'attendance_count': attendance_count(s),
    }


def get_duplicate_groups():
    """
    Return duplicate groups for API: list of
    { type: 'same_a_number'|'same_name', key: str, students: [ {id, first_name, last_name, email, username, attendance_count}, ... ] }
    Returns empty list on any error so the UI can show "no duplicates" instead of failing.
    """
    try:
        students = list(Student.objects.select_related('user').all())
    except Exception:
        return []
    by_a_number = defaultdict(list)
    by_name = defaultdict(list)
    for s in students:
        if getattr(s, 'user', None) is None:
            continue
        a = norm_a_number(s.user.username or getattr(s, 'username', ''))
        if a:
            by_a_number[a].append(s)
        fn, ln = norm(s.first_name), norm(s.last_name)
        if fn or ln:
            by_name[(fn, ln)].append(s)

    groups = []
    in_a_number_group = set()
    for a_num, grp in sorted(by_a_number.items()):
        if len(grp) >= 2:
            canonical = pick_canonical(grp, prefer_a_number=True)
            groups.append({
                'type': 'same_a_number',
                'key': a_num,
                'canonical_id': canonical.id,
                'students': [_student_to_dict(s) for s in grp],
            })
            for s in grp:
                in_a_number_group.add(s.id)

    students_left = [s for s in students if s.id not in in_a_number_group]
    by_name2 = defaultdict(list)
    for s in students_left:
        fn, ln = norm(s.first_name), norm(s.last_name)
        if fn or ln:
            by_name2[(fn, ln)].append(s)

    for (fn, ln), grp in sorted(by_name2.items(), key=lambda x: (x[0][1], x[0][0])):
        if len(grp) < 2:
            continue
        a_nums = [norm_a_number(s.user.username or s.username) for s in grp]
        if len(set(a_nums)) == 1 and a_nums[0]:
            continue
        canonical = pick_canonical(grp, prefer_a_number=True)
        groups.append({
            'type': 'same_name',
            'key': f'{grp[0].first_name} {grp[0].last_name}',
            'canonical_id': canonical.id,
            'students': [_student_to_dict(s) for s in grp],
        })

    return groups


def run_merge(dry_run=False, log=None):
    """
    Run the merge. log: optional list to append progress messages.
    Returns { groups_processed: int, accounts_merged: int }.
    """
    from django.db import transaction

    def write(msg):
        if log is not None:
            log.append(msg)

    students = list(Student.objects.select_related('user').all())
    by_a_number = defaultdict(list)
    by_name = defaultdict(list)
    for s in students:
        a = norm_a_number(s.user.username or s.username)
        if a:
            by_a_number[a].append(s)
        fn, ln = norm(s.first_name), norm(s.last_name)
        if fn or ln:
            by_name[(fn, ln)].append(s)

    merged_ids = set()
    stats = {'groups_processed': 0, 'accounts_merged': 0}

    for a_num, grp in sorted(by_a_number.items()):
        if len(grp) < 2:
            continue
        grp = [s for s in grp if s.id not in merged_ids]
        if len(grp) < 2:
            continue
        canonical = pick_canonical(grp, prefer_a_number=True)
        others = [s for s in grp if s.id != canonical.id]
        for s in others:
            _merge_into(s, canonical, dry_run, write)
            merged_ids.add(s.id)
            stats['accounts_merged'] += 1
        stats['groups_processed'] += 1

    students_left = [s for s in students if s.id not in merged_ids]
    by_name2 = defaultdict(list)
    for s in students_left:
        fn, ln = norm(s.first_name), norm(s.last_name)
        if fn or ln:
            by_name2[(fn, ln)].append(s)

    for (fn, ln), grp in sorted(by_name2.items(), key=lambda x: (x[0][1], x[0][0])):
        if len(grp) < 2:
            continue
        a_nums = [norm_a_number(s.user.username or s.username) for s in grp]
        if len(set(a_nums)) == 1 and a_nums[0]:
            continue
        grp = [s for s in grp if s.id not in merged_ids]
        if len(grp) < 2:
            continue
        canonical = pick_canonical(grp, prefer_a_number=True)
        others = [s for s in grp if s.id != canonical.id]
        for s in others:
            _merge_into(s, canonical, dry_run, write)
            merged_ids.add(s.id)
            stats['accounts_merged'] += 1
        stats['groups_processed'] += 1

    return stats


def _merge_into(duplicate_student, canonical_student, dry_run, write):
    from django.db import transaction
    moved = 0
    deleted_dup = 0
    canonical_event_ids = set(
        canonical_student.attendances.values_list('event_id', flat=True)
    )
    if dry_run:
        for att in duplicate_student.attendances.all():
            if att.event_id in canonical_event_ids:
                deleted_dup += 1
            else:
                moved += 1
        write(f'Moved {moved} attendances, drop {deleted_dup} duplicate-by-event')
        return
    with transaction.atomic():
        for att in duplicate_student.attendances.select_related('event').all():
            if att.event_id in canonical_event_ids:
                att.delete()
                deleted_dup += 1
            else:
                att.student_id = canonical_student.id
                att.save()
                canonical_event_ids.add(att.event_id)
                moved += 1
        canonical_student.update_attendance_cache()
        user_id = duplicate_student.user_id
        duplicate_student.delete()
        User.objects.filter(id=user_id).delete()
    write(f'Moved {moved} attendances, removed {deleted_dup} duplicate(s)')
