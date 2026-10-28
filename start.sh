#!/bin/bash
# ─────────────────────────────────────────────
# DEPwD Dashboard — Start Both Servers
# Run this from the root /Physical folder:
#   bash start.sh
# ─────────────────────────────────────────────

echo "🚀 Starting DEPwD Dashboard..."

# Kill any old instances
echo "Clearing ports 5001 and 5173..."
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
sleep 1

# Start backend in background
echo "Starting backend (port 5001)..."
cd "$(dirname "$0")/backend" && node server.js &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 4
if curl -s http://localhost:5001/api/dashboard > /dev/null 2>&1; then
  echo "✅ Backend running on http://localhost:5001"
else
  echo "⚠️  Backend may still be starting up..."
fi

# Start frontend in background
echo "Starting frontend (port 5173)..."
cd "$(dirname "$0")/frontend" && npm run dev &
FRONTEND_PID=$!

sleep 3
echo ""
echo "═══════════════════════════════════════════"
echo "  ✅  Dashboard is ready!"
echo "  👉  Open: http://localhost:5173"
echo "═══════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop both servers."

# Wait and clean up on exit
trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
