#!/usr/bin/env bash
# Restart backend and frontend: kill processes on their ports, then start both.
# Backend: port 8000. Frontend: port 3000 (Vite).

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=8000
FRONTEND_PORT=3000

kill_port() {
  local port=$1
  local name=$2
  if command -v lsof &>/dev/null; then
    local pid
    pid=$(lsof -ti ":$port" 2>/dev/null) || true
    if [ -n "$pid" ]; then
      echo "Killing $name (port $port, PID $pid)..."
      kill -9 $pid 2>/dev/null || true
      sleep 1
    else
      echo "No process on port $port ($name)."
    fi
  elif command -v fuser &>/dev/null; then
    if fuser "$port/tcp" &>/dev/null; then
      echo "Killing $name (port $port)..."
      fuser -k "$port/tcp" 2>/dev/null || true
      sleep 1
    else
      echo "No process on port $port ($name)."
    fi
  else
    echo "Warning: neither lsof nor fuser found; skipping kill for port $port"
  fi
}

echo "Stopping backend and frontend..."
kill_port $BACKEND_PORT "backend"
kill_port $FRONTEND_PORT "frontend"
echo ""

# Start backend in background (from project root, backend has manage.py)
echo "Starting backend on port $BACKEND_PORT..."
cd "$ROOT/backend"
python manage.py runserver "$BACKEND_PORT" &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd "$ROOT"
sleep 2

# Start frontend in foreground so you see logs and Ctrl+C stops it
echo "Starting frontend on port $FRONTEND_PORT..."
cd "$ROOT/frontend"
exec npm run dev
