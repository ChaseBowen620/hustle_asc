#!/bin/bash

# Hustle App Deployment Script for EC2
echo "🚀 Starting Hustle App Deployment..."

# Set environment variables for production
export DEBUG=False
export SECRET_KEY="your-production-secret-key-here-change-this"
export ALLOWED_HOSTS="your-ec2-public-ip,your-domain.com,localhost"
export CORS_ALLOWED_ORIGINS="http://your-ec2-public-ip:5173,https://your-domain.com"

# Navigate to backend directory
cd /home/ubuntu/hustle_asc/backend

# Activate virtual environment
source /home/ubuntu/.venv/bin/activate

# Install/update dependencies
echo "📦 Installing Python dependencies..."
uv pip install -r requirements.txt

# Collect static files
echo "📁 Collecting static files..."
python manage.py collectstatic --noinput

# Run database migrations
echo "🗄️ Running database migrations..."
python manage.py migrate

# Create superuser if it doesn't exist
echo "👤 Setting up admin user..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Admin user created')
else:
    print('Admin user already exists')
"

echo "✅ Backend setup complete!"

# Navigate to frontend directory
cd /home/ubuntu/hustle_asc/frontend

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Build frontend for production
echo "🏗️ Building frontend..."
npm run build

echo "✅ Frontend build complete!"
echo "🎉 Deployment finished! Your app is ready to run."
