#!/bin/bash

# Script to update the cloudflare-tunnel.service file
# This copies the local service file to the systemd directory with sudo

echo "Updating cloudflare-tunnel.service..."
echo ""

# Check if the local service file exists
if [ ! -f "/home/ubuntu/hustle_asc/cloudflare-tunnel.service" ]; then
    echo "❌ Error: cloudflare-tunnel.service not found in /home/ubuntu/hustle_asc/"
    exit 1
fi

# Copy the file with sudo
sudo cp /home/ubuntu/hustle_asc/cloudflare-tunnel.service /etc/systemd/system/cloudflare-tunnel.service

if [ $? -eq 0 ]; then
    echo "✅ Service file updated successfully"
    echo ""
    echo "Next steps:"
    echo "1. Reload systemd: sudo systemctl daemon-reload"
    echo "2. Restart service: sudo systemctl restart cloudflare-tunnel.service"
    echo "3. Check status: sudo systemctl status cloudflare-tunnel.service"
else
    echo "❌ Error: Failed to update service file"
    exit 1
fi

