#!/bin/bash

# Diagnostic script to check SSL certificate requirements

echo "=========================================="
echo "SSL Certificate Requirements Checker"
echo "=========================================="
echo ""

if [ -z "$1" ]; then
    echo "Usage: ./test-ssl-requirements.sh <your-domain.com>"
    echo ""
    echo "Example: ./test-ssl-requirements.sh example.com"
    exit 1
fi

DOMAIN=$1

echo "Checking requirements for: $DOMAIN"
echo ""

# Get public IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null)
echo "✓ Your server's public IP: $PUBLIC_IP"
echo ""

# Check DNS
echo "Checking DNS configuration..."
DNS_IP=$(dig +short $DOMAIN 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)

if [ -z "$DNS_IP" ]; then
    echo "✗ DNS lookup failed for $DOMAIN"
    echo "  Make sure your domain has an A record pointing to your server"
else
    echo "✓ DNS resolves to: $DNS_IP"
    if [ "$DNS_IP" = "$PUBLIC_IP" ]; then
        echo "✓ DNS correctly points to your server!"
    else
        echo "✗ DNS points to $DNS_IP, but your server IP is $PUBLIC_IP"
        echo "  Update your DNS A record to point to $PUBLIC_IP"
    fi
fi
echo ""

# Check if domain is in nginx config
echo "Checking nginx configuration..."
if sudo grep -q "$DOMAIN" /etc/nginx/sites-enabled/* 2>/dev/null; then
    echo "✓ Domain found in nginx configuration"
else
    echo "✗ Domain NOT found in nginx configuration"
    echo "  You need to add $DOMAIN to the server_name directive"
fi
echo ""

# Test local nginx
echo "Testing local nginx on port 80..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200\|301\|302"; then
    echo "✓ Nginx is responding locally"
else
    echo "✗ Nginx is not responding locally"
fi
echo ""

# Test external accessibility
echo "Testing external accessibility..."
echo "  (This will timeout if port 80 is not open in AWS Security Group)"
EXTERNAL_TEST=$(timeout 5 curl -s -o /dev/null -w "%{http_code}" http://$PUBLIC_IP 2>&1 || echo "timeout")

if [ "$EXTERNAL_TEST" = "timeout" ] || [ -z "$EXTERNAL_TEST" ]; then
    echo "✗ Port 80 is NOT accessible from the internet"
    echo ""
    echo "  ⚠️  THIS IS LIKELY YOUR PROBLEM!"
    echo ""
    echo "  To fix:"
    echo "  1. Go to AWS Console → EC2 → Security Groups"
    echo "  2. Find your instance's security group"
    echo "  3. Add Inbound Rule:"
    echo "     - Type: HTTP"
    echo "     - Port: 80"
    echo "     - Source: 0.0.0.0/0"
    echo "  4. Also add HTTPS (port 443) for after certificate installation"
else
    echo "✓ Port 80 is accessible from the internet (HTTP $EXTERNAL_TEST)"
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "Before running certbot, ensure:"
echo "  1. DNS A record points to $PUBLIC_IP"
echo "  2. Port 80 is open in AWS Security Group"
echo "  3. Domain is configured in nginx"
echo ""
echo "Then run:"
echo "  sudo certbot --nginx -d $DOMAIN --email your-email@example.com --redirect"
echo ""
