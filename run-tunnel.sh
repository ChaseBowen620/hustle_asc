#!/usr/bin/env bash
# Run Cloudflare Tunnel for hustledashboard.com (frontend + backend).
# Usage: ./run-tunnel.sh
# Ensure you've completed CLOUDFLARE_TUNNEL_SETUP.md and edited cloudflare-tunnel.yml first.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${SCRIPT_DIR}/cloudflare-tunnel.yml"

if [[ ! -f "$CONFIG" ]]; then
  echo "Config not found: $CONFIG"
  exit 1
fi

if grep -q 'REPLACE_WITH' "$CONFIG"; then
  echo "Please edit cloudflare-tunnel.yml and set your tunnel ID and credentials-file path."
  echo "See CLOUDFLARE_TUNNEL_SETUP.md for steps."
  exit 1
fi

echo "Validating ingress rules..."
cloudflared tunnel ingress validate --config "$CONFIG"

echo "Starting tunnel (frontend :3000, backend :8000)..."
exec cloudflared tunnel run --config "$CONFIG"
