# Cloudflare Tunnel Setup

Your backend is now accessible via HTTPS through a Cloudflare tunnel, which solves the mixed content error.

## Current Configuration

- **Tunnel URL**: `https://toolbox-breathing-height-captured.trycloudflare.com`
- **Service**: Running as systemd service (`cloudflare-tunnel.service`)
- **Status**: Active and enabled (starts on boot)

## Important Notes

⚠️ **The tunnel URL changes each time the service restarts!**

If the tunnel restarts, you'll need to:
1. Get the new URL: `./get-tunnel-url.sh`
2. Update the frontend API URL
3. Update backend CORS settings
4. Rebuild the frontend

## Files Updated

1. **Frontend API URL**: 
   - `/home/ubuntu/hustle_asc/frontend/src/config/api.js`
   - `/home/ubuntu/hustle_asc/frontend/.env`

2. **Backend CORS**: 
   - `/etc/systemd/system/hustle-backend.service`

## Managing the Tunnel

### Check Status
```bash
sudo systemctl status cloudflare-tunnel.service
```

### Restart Tunnel
```bash
sudo systemctl restart cloudflare-tunnel.service
```

### Get Current URL
```bash
./get-tunnel-url.sh
```

### View Logs
```bash
sudo journalctl -u cloudflare-tunnel.service -f
```

## Updating After Tunnel Restart

If the tunnel URL changes:

1. **Get new URL**:
   ```bash
   cd /home/ubuntu/hustle_asc
   ./get-tunnel-url.sh
   ```

2. **Update frontend**:
   ```bash
   cd frontend
   echo "VITE_API_URL=<NEW_URL>" > .env
   # Update src/config/api.js with new URL
   npm run build
   ```

3. **Update backend CORS**:
   ```bash
   sudo nano /etc/systemd/system/hustle-backend.service
   # Update CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS
   sudo systemctl daemon-reload
   sudo systemctl restart hustle-backend.service
   ```

## Testing

Test the tunnel:
```bash
curl https://toolbox-breathing-height-captured.trycloudflare.com/api/events/
```

Test CORS:
```bash
curl -I -H "Origin: https://hustle-dashboard.vercel.app" \
  https://toolbox-breathing-height-captured.trycloudflare.com/api/events/
```

## Troubleshooting

### Tunnel not working
- Check service status: `sudo systemctl status cloudflare-tunnel.service`
- Check logs: `sudo journalctl -u cloudflare-tunnel.service -n 50`
- Verify backend is running: `curl http://localhost:8000/api/events/`

### CORS errors
- Verify tunnel URL is in CORS_ALLOWED_ORIGINS
- Check backend logs: `sudo journalctl -u hustle-backend.service -n 50`
- Restart backend: `sudo systemctl restart hustle-backend.service`

### Mixed content errors
- Ensure frontend is using HTTPS URL (not HTTP)
- Check Vercel environment variable `VITE_API_URL` is set correctly
- Rebuild frontend after updating API URL

