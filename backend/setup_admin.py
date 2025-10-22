#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User, Group
from django.contrib.auth import get_user_model

def setup_admin():
    # Create Admin group if it doesn't exist
    admin_group, created = Group.objects.get_or_create(name='Admin')
    if created:
        print("Created 'Admin' group")
    else:
        print("'Admin' group already exists")
    
    # Get the superuser (assuming it's the first superuser)
    try:
        superuser = User.objects.filter(is_superuser=True).first()
        if superuser:
            # Add superuser to Admin group
            superuser.groups.add(admin_group)
            print(f"Added superuser '{superuser.username}' to Admin group")
        else:
            print("No superuser found")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    setup_admin()

