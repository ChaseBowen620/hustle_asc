# Direct API Setup (No Cloudflare Tunnel)

## Changes Made

1. ✅ **Stopped and disabled Cloudflare tunnel service**
   - The `cloudflare-tunnel.service` has been stopped and disabled
   - It will not start on boot

2. ✅ **Updated backend service configuration**
   - Removed all Cloudflare tunnel URLs from CORS and CSRF settings
   - Backend now allows: `https://hustle-dashboard.vercel.app`
   - ALLOWED_HOSTS set to: `52.8.4.183`

3. ✅ **Updated frontend API configuration**
   - Frontend now uses: `http://52.8.4.183:8000` (your EC2 public IP)
   - This is set in `/home/ubuntu/hustle_asc/frontend/src/config/api.js`

## Current Backend URL

**Direct API URL:** `http://52.8.4.183:8000`

Your frontend should now connect directly to this URL.

## Important: Security Group Configuration

You need to ensure your AWS Security Group allows inbound traffic on port 8000:

### Option 1: Allow Port 8000 Directly (Current Setup)

1. Go to **AWS Console** → **EC2** → **Security Groups**
2. Select your instance's security group
3. Click **Edit inbound rules**
4. **Add a rule**:
   - **Type**: Custom TCP
   - **Protocol**: TCP
   - **Port Range**: 8000
   - **Source**: 0.0.0.0/0 (or restrict to your Vercel IPs if known)
5. **Save rules**

### Option 2: Use Nginx on Port 80 (Recommended)

Since nginx is already active, you can configure it to proxy to the backend:

1. Update nginx config to listen on port 80 and proxy `/api/` to `http://localhost:8000`
2. Ensure security group allows inbound on port 80 (HTTP) or 443 (HTTPS)
3. Update frontend to use: `http://52.8.4.183/api/` (no port number)

The nginx config at `/home/ubuntu/hustle_asc/nginx-hustle.conf` already has this setup, but you may need to:
- Copy it to `/etc/nginx/sites-available/` and enable it
- Or update your existing nginx config

## Testing

Test the backend from your local machine:
```bash
curl http://52.8.4.183:8000/api/
```

If you get a response (even a 400 or 404), the backend is accessible.

## Frontend Setup

The frontend API configuration is set to use: `http://52.8.4.183:8000`

- The default in `api.js` is already set to `http://52.8.4.183:8000`
- If using nginx proxy, you can also use `http://52.8.4.183/api/` (port 80)
- The backend CORS is configured to allow `http://52.8.4.183` and `http://52.8.4.183:5173`

## CORS Configuration

The backend is configured to allow requests from:
- `http://52.8.4.183` (via nginx on port 80)
- `http://52.8.4.183:5173` (direct Vite dev server)

If you need to add more origins, edit `/etc/systemd/system/hustle-backend.service`:
```bash
sudo nano /etc/systemd/system/hustle-backend.service
```

Update the `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` environment variables, then:
```bash
sudo systemctl daemon-reload
sudo systemctl restart hustle-backend.service
```

## Troubleshooting

### Backend not accessible from internet
- Check AWS Security Group inbound rules for port 8000
- Verify the backend is running: `sudo systemctl status hustle-backend.service`
- Test locally: `curl http://localhost:8000/api/`

### CORS errors in browser
- Verify the frontend origin matches `CORS_ALLOWED_ORIGINS` in the backend service
- Check browser console for specific CORS error messages
- Ensure credentials are handled correctly if using authentication

### Connection refused
- Security group may be blocking port 8000
- Backend may not be running
- Check firewall rules: `sudo ufw status`

