#!/bin/bash

# Script to set up HTTPS for the Django backend using Nginx and Let's Encrypt

set -e

echo "🔒 Setting up HTTPS for Backend"
echo "================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges. Please run with sudo."
    exit 1
fi

# Get domain/IP
read -p "Enter your domain name (or press Enter to use IP: 52.8.4.183): " DOMAIN
DOMAIN=${DOMAIN:-52.8.4.183}

echo ""
echo "📋 Configuration:"
echo "   Domain/IP: $DOMAIN"
echo "   Backend: http://localhost:8000"
echo ""

# Create Nginx configuration
echo "1. Creating Nginx configuration..."
NGINX_CONFIG="/etc/nginx/sites-available/hustle-backend"

sudo tee $NGINX_CONFIG > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Redirect HTTP to HTTPS (will be enabled after SSL setup)
    # return 301 https://\$server_name\$request_uri;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

echo "   ✅ Created $NGINX_CONFIG"

# Enable the site
echo ""
echo "2. Enabling Nginx site..."
sudo ln -sf /etc/nginx/sites-available/hustle-backend /etc/nginx/sites-enabled/
sudo nginx -t && echo "   ✅ Nginx configuration is valid" || (echo "   ❌ Nginx configuration error"; exit 1)

# Restart Nginx
echo ""
echo "3. Restarting Nginx..."
sudo systemctl restart nginx
echo "   ✅ Nginx restarted"

# Check if domain is a real domain (not just IP)
if [[ $DOMAIN =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo ""
    echo "⚠️  You're using an IP address ($DOMAIN)."
    echo "   Let's Encrypt requires a domain name for SSL certificates."
    echo ""
    echo "   Options:"
    echo "   1. Get a domain name and point it to your IP"
    echo "   2. Use a self-signed certificate (not recommended for production)"
    echo ""
    echo "   For now, Nginx is configured but HTTPS is not set up."
    echo "   You can still use HTTP, but your frontend will show mixed content errors."
    exit 0
fi

# Get SSL certificate
echo ""
echo "4. Getting SSL certificate from Let's Encrypt..."
read -p "   Enter your email for Let's Encrypt: " EMAIL

sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL || {
    echo "   ⚠️  Could not get SSL certificate. Make sure:"
    echo "      - Domain $DOMAIN points to this server's IP"
    echo "      - Port 80 is open in your security group"
    echo "      - DNS has propagated"
    exit 1
}

echo "   ✅ SSL certificate obtained"

# Update Nginx config to redirect HTTP to HTTPS
echo ""
echo "5. Updating Nginx to redirect HTTP to HTTPS..."
sudo sed -i 's/# return 301/return 301/' $NGINX_CONFIG
sudo nginx -t && sudo systemctl reload nginx
echo "   ✅ HTTP to HTTPS redirect enabled"

# Update Django settings
echo ""
echo "6. Updating Django settings for HTTPS..."
DJANGO_SETTINGS="/home/ubuntu/hustle_asc/backend/backend/settings.py"

# Uncomment HTTPS settings if they exist
sudo sed -i 's/# SECURE_SSL_REDIRECT = True/SECURE_SSL_REDIRECT = True/' $DJANGO_SETTINGS
sudo sed -i 's/# SESSION_COOKIE_SECURE = True/SESSION_COOKIE_SECURE = True/' $DJANGO_SETTINGS
sudo sed -i 's/# CSRF_COOKIE_SECURE = True/CSRF_COOKIE_SECURE = True/' $DJANGO_SETTINGS

echo "   ✅ Django HTTPS settings enabled"

# Restart backend
echo ""
echo "7. Restarting backend service..."
sudo systemctl restart hustle-backend.service
echo "   ✅ Backend restarted"

echo ""
echo "✅ HTTPS Setup Complete!"
echo "========================"
echo ""
echo "Your backend is now available at: https://$DOMAIN"
echo ""
echo "📝 Next steps:"
echo "1. Update your Vercel frontend environment variable:"
echo "   VITE_API_URL=https://$DOMAIN"
echo ""
echo "2. Update backend CORS settings if needed"
echo ""
echo "3. Test the connection:"
echo "   curl -I https://$DOMAIN/api/events/"
echo ""

