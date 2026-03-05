#!/usr/bin/env bash
# Restart the backend (and optionally frontend) on the server.
# Run this on the server after editing code so the services pick up changes.
# From another machine: ssh ubuntu@hustledashboard.com 'cd /home/ubuntu/hustle_asc && ./restart.sh'

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Restarting backend (hustle-backend)..."
sudo systemctl restart hustle-backend
echo "Backend restarted."
echo ""

# Restart frontend service if present (picks up existing build; run build-frontend.sh if you changed frontend)
if systemctl list-unit-files --type=service 2>/dev/null | grep -q hustle-frontend; then
  echo "Restarting frontend (hustle-frontend)..."
  sudo systemctl restart hustle-frontend
  echo "Frontend restarted."
else
  echo "No hustle-frontend service; skipping. Run ./build-frontend.sh after frontend changes."
fi
echo ""
echo "Done. Backend is live at https://hustledashboard.com"
