#!/bin/bash

# Quick script to share DealOrbit website with a public URL (with real-time sync)

echo "🌐 Starting DealOrbit Public Tunnel with Real-Time Sync..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if ws-server.js exists
if [ ! -f "./ws-server.js" ]; then
    echo "❌ ws-server.js not found!"
    exit 1
fi

# Install Node.js dependencies if needed
if [ ! -d "./node_modules" ]; then
    echo "📦 Installing WebSocket dependencies..."
    npm install --silent 2>&1 | grep -v "npm WARN" || true
    echo ""
fi

# Kill any existing server on port 8000
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 8000 already in use. Stopping existing server..."
    lsof -ti :8000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Start Node.js server (serves files AND handles WebSocket sync)
echo "🚀 Starting DealOrbit server with real-time sync..."
node ws-server.js > /tmp/dealorbit-server.log 2>&1 &
SERVER_PID=$!
sleep 2

# Check if server started successfully
if ! lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Failed to start server. Check /tmp/dealorbit-server.log for errors."
    exit 1
fi

echo "✅ Server running on http://localhost:8000 (PID: $SERVER_PID)"
echo "✅ Real-time synchronization enabled!"
echo ""
echo "🔗 Creating public tunnel (this may take a few seconds)..."
echo ""

# Store PID for cleanup
echo $SERVER_PID > /tmp/dealorbit-server.pid

# Start cloudflared and capture the URL
./cloudflared tunnel --url http://localhost:8000 2>&1 | while IFS= read -r line; do
    echo "$line"
    # Look for the URL in the output
    if echo "$line" | grep -q "https://.*trycloudflare.com"; then
        URL=$(echo "$line" | grep -o "https://[^ ]*\.trycloudflare\.com")
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ YOUR PUBLIC URL (with Real-Time Sync):"
        echo "   $URL"
        echo ""
        echo "📤 Share this URL with your business partner!"
        echo "🔄 Any changes you make will sync in real-time!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Press Ctrl+C to stop the tunnel and server."
        echo ""
    fi
done

# Cleanup on exit
trap "kill $SERVER_PID 2>/dev/null; rm -f /tmp/dealorbit-server.pid" EXIT





