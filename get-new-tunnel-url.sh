#!/bin/bash

echo "=== Getting New Cloudflare Tunnel URL ==="
echo ""

# Check if tunnel is running
if ! systemctl is-active --quiet cloudflare-tunnel.service; then
    echo "❌ Tunnel service is not running"
    echo "   Start it with: sudo systemctl start cloudflare-tunnel.service"
    exit 1
fi

echo "✅ Tunnel service is running"
echo ""
echo "Waiting for tunnel to establish connection..."
echo "(This may take 30-60 seconds)"
echo ""

# Wait and check for URL
for i in {1..12}; do
    sleep 5
    URL=$(sudo journalctl -u cloudflare-tunnel.service -n 200 --no-pager | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)
    
    if [ ! -z "$URL" ]; then
        # Test if URL is actually working
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/api/events/" 2>/dev/null)
        
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
            echo ""
            echo "✅ Tunnel is connected!"
            echo ""
            echo "New Tunnel URL: $URL"
            echo ""
            echo "=== Next Steps ==="
            echo "1. Update Vercel environment variable:"
            echo "   VITE_API_URL=$URL"
            echo ""
            echo "2. Update frontend/.env:"
            echo "   VITE_API_URL=$URL"
            echo ""
            echo "3. Update backend CORS settings (run this command):"
            echo "   sudo sed -i 's|https://[^,]*\.trycloudflare\.com|$URL|g' /etc/systemd/system/hustle-backend.service"
            echo "   sudo systemctl daemon-reload"
            echo "   sudo systemctl restart hustle-backend.service"
            exit 0
        fi
    fi
    
    echo -n "."
done

echo ""
echo ""
echo "⚠️  Tunnel URL found but connection not established yet"
URL=$(sudo journalctl -u cloudflare-tunnel.service -n 200 --no-pager | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)

if [ ! -z "$URL" ]; then
    echo "Found URL: $URL"
    echo ""
    echo "Check tunnel status:"
    echo "  sudo journalctl -u cloudflare-tunnel.service -f"
    echo ""
    echo "If you see connection errors, verify UDP port 7844 is open in AWS Security Group"
else
    echo "❌ No tunnel URL found"
    echo ""
    echo "Check tunnel logs:"
    echo "  sudo journalctl -u cloudflare-tunnel.service -n 50"
fi



