# Cloudflare Tunnel setup for hustledashboard.com

This connects your local (or server) frontend and backend to **https://hustledashboard.com** using a Cloudflare Tunnel—no port forwarding or public IP needed.

## What gets routed

| URL | Service | Local port |
|-----|---------|------------|
| `https://hustledashboard.com/` | Frontend (Vite) | 3000 |
| `https://hustledashboard.com/api/*` | Django API | 8000 |
| `https://hustledashboard.com/admin/` | Django admin | 8000 |
| `https://hustledashboard.com/static/*` | Django static files | 8000 |

Your frontend already uses `https://hustledashboard.com` as the API base (see `frontend/src/config/api.js`), so no frontend changes are required.

---

## Prerequisites

- **hustledashboard.com** must be added to your [Cloudflare account](https://dash.cloudflare.com) (DNS managed by Cloudflare).
- Frontend and backend running locally (or on the same machine as `cloudflared`):
  - Frontend: `cd frontend && npm run dev` (port 3000)
  - Backend: `cd backend && python manage.py runserver 8000`

---

## 1. Install cloudflared

**Linux (deb/Ubuntu):**
```bash
# Add Cloudflare package repo and install
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

**macOS (Homebrew):**
```bash
brew install cloudflared
```

**Other:** [Official install options](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

---

## 2. Log in to Cloudflare

This opens a browser to authorize the CLI with your Cloudflare account and writes certs to `~/.cloudflared/`:

```bash
cloudflared tunnel login
```

---

## 3. Create a tunnel and get its ID

```bash
cloudflared tunnel create hustle-asc
```

Note the **tunnel ID** (UUID) from the output. List tunnels anytime with:

```bash
cloudflared tunnel list
```

Credentials are saved as `~/.cloudflared/<TUNNEL_ID>.json`.

---

## 4. Route DNS for hustledashboard.com

Point the domain to your tunnel (use your tunnel name or ID from step 3):

```bash
cloudflared tunnel route dns hustle-asc hustledashboard.com
```

This creates (or updates) a CNAME for `hustledashboard.com` to `<tunnel-id>.cfargotunnel.com`. You can confirm in [Cloudflare DNS](https://dash.cloudflare.com → your zone → DNS).

---

## 5. Edit the tunnel config

Open `cloudflare-tunnel.yml` in this repo and replace the placeholders:

1. **tunnel:** set to your tunnel ID (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).
2. **credentials-file:** set to the full path to your credentials file (e.g. `~/.cloudflared/a1b2c3d4-e5f6-7890-abcd-ef1234567890.json`). Use `$HOME` or the full path; `~` may not expand in all contexts.

Example:

```yaml
tunnel: a1b2c3d4-e5f6-7890-abcd-ef1234567890
credentials-file: /home/ubuntu/.cloudflared/a1b2c3d4-e5f6-7890-abcd-ef1234567890.json
```

Validate the config:

```bash
cloudflared tunnel ingress validate
```

Run from the repo root so the path to `cloudflare-tunnel.yml` is correct, or pass the config path:

```bash
cloudflared tunnel ingress validate --config /home/ubuntu/hustle_asc/cloudflare-tunnel.yml
```

---

## 6. Run the tunnel

With frontend (port 3000) and backend (port 8000) already running:

```bash
cd /home/ubuntu/hustle_asc
cloudflared tunnel run hustle-asc --config cloudflare-tunnel.yml
```

Or use the tunnel ID and config path:

```bash
cloudflared tunnel run --config /home/ubuntu/hustle_asc/cloudflare-tunnel.yml
```

Leave this running. Traffic to **https://hustledashboard.com** will go through Cloudflare to this machine and be split by path as in the table above.

---

## Optional: run as a service (Linux)

For a long-lived server, run `cloudflared` as a systemd service:

```bash
sudo cloudflared service install
```

Then install your config and credentials where the service expects them (see [Cloudflare docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/local-management/run-as-a-service/) for paths), or symlink your `cloudflare-tunnel.yml` and credentials into that location.

---

## Troubleshooting

- **404 on /api or /admin**  
  Ensure the ingress rules in `cloudflare-tunnel.yml` list `/api`, `/admin`, and `/static` **before** the catch-all rule that sends traffic to the frontend.

- **CORS or CSRF errors**  
  Your Django `settings.py` already includes `https://hustledashboard.com` in `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`. If you add other origins (e.g. `www.hustledashboard.com`), add them there too.

- **Tunnel won’t start**  
  Run `cloudflared tunnel ingress validate --config cloudflare-tunnel.yml` and fix any errors. Ensure `credentials-file` is an absolute path and the JSON file exists.

- **Check which rule matches a URL**  
  `cloudflared tunnel ingress rule https://hustledashboard.com/api/events/` (with your config path if needed) shows which ingress rule is used.
