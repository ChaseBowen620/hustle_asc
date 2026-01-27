#!/bin/bash

# SSL Certificate Setup Script for Nginx with Certbot
# This script helps you obtain SSL certificates using certbot

set -e

echo "=========================================="
echo "SSL Certificate Setup with Certbot"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run this script with sudo"
    exit 1
fi

# Check if domain is provided
if [ -z "$1" ]; then
    echo "Usage: sudo ./setup-ssl.sh <your-domain.com>"
    echo ""
    echo "Example: sudo ./setup-ssl.sh example.com"
    echo ""
    echo "Before running this script, make sure:"
    echo "1. Your domain name points to this server's IP address"
    echo "2. Port 80 is open and accessible from the internet"
    echo "3. Your nginx configuration has a server block for this domain"
    exit 1
fi

DOMAIN=$1
EMAIL=${2:-"admin@${DOMAIN}"}

echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""
read -p "Continue with SSL certificate setup? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Obtaining SSL certificate for $DOMAIN..."
echo ""

# Run certbot with nginx plugin
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect

echo ""
echo "=========================================="
echo "SSL Certificate Setup Complete!"
echo "=========================================="
echo ""
echo "Your SSL certificate has been installed and nginx has been configured."
echo ""
echo "To verify, check:"
echo "  - Certificate: sudo certbot certificates"
echo "  - Nginx config: sudo cat /etc/nginx/sites-enabled/*"
echo ""
echo "To test renewal: sudo certbot renew --dry-run"
echo ""
