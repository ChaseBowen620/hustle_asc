# SSL Certificate Troubleshooting Guide

## Common Timeout Issues

### 1. AWS Security Group Configuration (MOST COMMON)

The timeout is usually because **port 80 is not open in your AWS Security Group**.

**To fix:**
1. Go to AWS Console → EC2 → Security Groups
2. Find the security group attached to your instance
3. Add an **Inbound Rule**:
   - Type: HTTP
   - Protocol: TCP
   - Port: 80
   - Source: 0.0.0.0/0 (or your IP for testing)
4. Also ensure port 443 (HTTPS) is open for after certificate installation

**Check current security group:**
```bash
# Get your instance ID
curl -s http://169.254.169.254/latest/meta-data/instance-id

# Then check in AWS Console which security group is attached
```

### 2. DNS Configuration

Your domain must point to your server's public IP address.

**To verify:**
```bash
# Get your public IP
curl -s ifconfig.me

# Check if your domain points to it
dig +short your-domain.com
# or
nslookup your-domain.com
```

**The A record should match your server's public IP.**

### 3. Nginx Server Block

Your domain must be configured in nginx before running certbot.

**Check current config:**
```bash
sudo cat /etc/nginx/sites-enabled/hustle-asc
```

The `server_name` directive should include your domain.

### 4. Test Port 80 Accessibility

From another machine or using an online tool:
```bash
# Test from external location
curl -I http://your-domain.com
# or
curl -I http://YOUR_PUBLIC_IP
```

If this times out, it's definitely a firewall/security group issue.

## Step-by-Step Fix

1. **Open port 80 in AWS Security Group** (most important!)
2. **Verify DNS points to your server**
3. **Update nginx config with your domain** (if needed)
4. **Test HTTP access from outside**
5. **Run certbot again**

## Alternative: Standalone Mode (if nginx plugin fails)

If the nginx plugin times out, you can use standalone mode:

```bash
# Stop nginx temporarily
sudo systemctl stop nginx

# Run certbot in standalone mode
sudo certbot certonly --standalone -d your-domain.com --email your-email@example.com

# Start nginx again
sudo systemctl start nginx

# Then manually configure nginx to use the certificate
```
