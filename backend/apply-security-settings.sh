#!/bin/bash

# Script to apply security settings to the backend
# Run this after deploying to Vercel to update CORS and CSRF settings

echo "🔒 Backend Security Configuration"
echo "================================"
echo ""

# Check if running as root for systemd operations
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Some operations require sudo. You may need to run parts of this script with sudo."
    echo ""
fi

# Generate a new secret key if needed
echo "1. Generating a new SECRET_KEY..."
SECRET_KEY=$(python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())" 2>/dev/null)
if [ -z "$SECRET_KEY" ]; then
    echo "   ⚠️  Could not generate secret key. Please generate one manually."
    echo "   Run: python3 -c \"from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())\""
else
    echo "   ✅ Generated SECRET_KEY: ${SECRET_KEY:0:20}..."
    echo ""
    echo "   📝 Add this to your systemd service file:"
    echo "   Environment=\"SECRET_KEY=$SECRET_KEY\""
    echo ""
fi

# Get Vercel URL
echo "2. Vercel Frontend URL"
read -p "   Enter your Vercel frontend URL (e.g., https://your-app.vercel.app): " VERCEL_URL

if [ -z "$VERCEL_URL" ]; then
    echo "   ⚠️  No Vercel URL provided. You'll need to set this manually."
else
    echo ""
    echo "   📝 Add these to your systemd service file:"
    echo "   Environment=\"CORS_ALLOWED_ORIGINS=$VERCEL_URL,${VERCEL_URL//.vercel.app/-*.vercel.app}\""
    echo "   Environment=\"CSRF_TRUSTED_ORIGINS=$VERCEL_URL\""
    echo ""
fi

# Get EC2 hostname
echo "3. EC2 Hostname"
read -p "   Enter your EC2 public hostname or IP (default: 52.8.4.183): " EC2_HOST
EC2_HOST=${EC2_HOST:-52.8.4.183}
echo "   ✅ Using: $EC2_HOST"
echo ""

# Show what needs to be updated
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Update /etc/systemd/system/hustle-backend.service with:"
echo ""
echo "   [Service]"
echo "   Environment=\"SECRET_KEY=$SECRET_KEY\""
echo "   Environment=\"DEBUG=False\""
echo "   Environment=\"ALLOWED_HOSTS=$EC2_HOST\""
if [ ! -z "$VERCEL_URL" ]; then
    echo "   Environment=\"CORS_ALLOWED_ORIGINS=$VERCEL_URL,${VERCEL_URL//.vercel.app/-*.vercel.app}\""
    echo "   Environment=\"CSRF_TRUSTED_ORIGINS=$VERCEL_URL\""
fi
echo ""
echo "2. Reload and restart the service:"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl restart hustle-backend.service"
echo ""
echo "3. Check the service status:"
echo "   sudo systemctl status hustle-backend.service"
echo ""
echo "4. Verify CORS headers:"
if [ ! -z "$VERCEL_URL" ]; then
    echo "   curl -I -H \"Origin: $VERCEL_URL\" http://$EC2_HOST:8000/api/events/ | grep -i access-control"
fi
echo ""

