# AWS Security Group: Inbound vs Outbound

## You Need BOTH Inbound and Outbound Rules

### Inbound Rules (What can connect TO your server)

| Port | Purpose | Source | Status |
|------|---------|--------|--------|
| 443 (HTTPS) | Allow external clients to connect to your server | 0.0.0.0/0 | ✅ You have this |
| 22 (SSH) | Allow you to SSH into the server | Your IP only | ✅ You should have this |

**Inbound 443** allows:
- Your Vercel frontend to make HTTPS requests to your backend
- Users to access your application
- External services to connect to your server

### Outbound Rules (What your server can connect TO)

| Port | Purpose | Destination | Status |
|------|---------|-------------|--------|
| 443 (HTTPS) | Allow server to make HTTPS connections | 0.0.0.0/0 | ❌ **You need this!** |
| All traffic | Allow all outbound (recommended) | 0.0.0.0/0 | Alternative option |

**Outbound 443** allows:
- Your server to install packages (`apt update`, `npm install`)
- Your server to make API calls to external services
- Certificate renewal (Let's Encrypt)
- DNS resolution over HTTPS

## Why Both Are Needed

```
Inbound 443:  Internet → Your Server (receiving connections)
Outbound 443: Your Server → Internet (making connections)
```

### Example Flow:

1. **Inbound 443**: Vercel frontend or users connect to your backend over HTTPS
2. **Outbound 443**: Your server reaches out to package registries, Let's Encrypt, and other external services

## Quick Fix

**Add to Outbound Rules:**
- Type: HTTPS
- Protocol: TCP  
- Port: 443
- Destination: 0.0.0.0/0

**OR** (Recommended for simplicity):
- Type: All traffic
- Protocol: All
- Port: All
- Destination: 0.0.0.0/0

## Summary

- ✅ **Inbound 443**: You have this (keep it!)
- ❌ **Outbound 443**: You need to add this (for package installs, Let's Encrypt, and external APIs)
- ✅ **Inbound 22**: You should have this (for SSH)
- ✅ **Outbound All**: Recommended (allows server to function normally)

