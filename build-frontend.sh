#!/usr/bin/env bash
# Build the frontend and restart the frontend service so changes are permanent.
# Run this after making frontend changes so the app (when not using Vite dev) shows the new code.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Building frontend..."
cd "$ROOT/frontend"
npm run build
echo "Frontend build complete."

# Restart the frontend service if it exists (serves dist/ on port 3000)
if systemctl list-unit-files --type=service 2>/dev/null | grep -q hustle-frontend; then
  echo "Restarting hustle-frontend service..."
  sudo systemctl restart hustle-frontend
  echo "Service restarted. Your changes are now live."
else
  echo "No hustle-frontend service found. To serve the build on port 3000, run:"
  echo "  cd $ROOT/frontend && npm run preview -- --host 0.0.0.0 --port 3000"
fi
