#!/bin/bash

# Script to get the current Cloudflare tunnel URL
# The tunnel URL changes each time the service restarts

echo "Getting Cloudflare tunnel URL..."
TUNNEL_URL=$(sudo journalctl -u cloudflare-tunnel.service -n 100 --no-pager | grep -o 'https://[^ ]*\.trycloudflare\.com' | tail -1)

if [ -z "$TUNNEL_URL" ]; then
    echo "⚠️  Could not find tunnel URL. Is the service running?"
    echo "Check with: sudo systemctl status cloudflare-tunnel.service"
    exit 1
fi

echo ""
echo "Current Cloudflare Tunnel URL: $TUNNEL_URL"
echo ""
echo "To update the frontend API URL, edit:"
echo "  /home/ubuntu/hustle_asc/frontend/src/config/api.js"
echo ""
echo "And change the API_URL to: $TUNNEL_URL"
echo ""
echo "Then update the .env file:"
echo "  cd /home/ubuntu/hustle_asc/frontend"
echo "  echo 'VITE_API_URL=$TUNNEL_URL' > .env"
echo ""
echo "Then rebuild the frontend:"
echo "  cd /home/ubuntu/hustle_asc/frontend && npm run build"
echo ""
echo "To update backend CORS, edit /etc/systemd/system/hustle-backend.service:"
echo "  Environment=\"CORS_ALLOWED_ORIGINS=https://hustle-dashboard.vercel.app,$TUNNEL_URL\""
echo "  Environment=\"CSRF_TRUSTED_ORIGINS=https://hustle-dashboard.vercel.app,$TUNNEL_URL\""
echo ""
echo "Then restart:"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl restart hustle-backend.service"

