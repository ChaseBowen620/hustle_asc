# Cloudflare Tunnel Troubleshooting

## Current Issue: Cannot Connect to Cloudflare API

The tunnel is failing with: `context deadline exceeded (Client.Timeout exceeded while awaiting headers)`

This means your server **cannot reach Cloudflare's API** at `api.trycloudflare.com`.

## Most Likely Cause: AWS Security Group Outbound Rules

**Your AWS Security Group outbound rules are blocking HTTPS connections!**

### Fix: Update Security Group Outbound Rules

1. Go to **AWS Console** → **EC2** → **Security Groups**
2. Select your instance's security group
3. Click **Edit outbound rules**
4. **Add a rule**:
   - **Type**: HTTPS
   - **Protocol**: TCP
   - **Port Range**: 443
   - **Destination**: 0.0.0.0/0
5. **Save rules**

### Alternative: Allow All Outbound Traffic

If you want to allow all outbound (recommended):
- **Type**: All traffic
- **Protocol**: All
- **Port Range**: All
- **Destination**: 0.0.0.0/0

## Why This Is Needed

The Cloudflare tunnel needs to:
- Make HTTPS (443) connections to `api.trycloudflare.com` to establish the tunnel
- Maintain persistent connections to Cloudflare's servers
- Send/receive encrypted tunnel traffic

Without outbound HTTPS access, the tunnel cannot function.

## After Fixing Security Group

1. Wait 30 seconds for changes to propagate
2. Restart the tunnel:
   ```bash
   sudo systemctl restart cloudflare-tunnel.service
   ```
3. Check status:
   ```bash
   sudo systemctl status cloudflare-tunnel.service
   ```
4. Get the new tunnel URL:
   ```bash
   ./get-tunnel-url.sh
   ```
5. Update Vercel environment variable with the new URL

## Test Outbound Connectivity

Test if outbound HTTPS works:
```bash
curl -s -m 5 https://www.google.com
curl -s -m 5 https://api.trycloudflare.com
```

If these fail, your outbound rules are blocking HTTPS.

