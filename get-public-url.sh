#!/bin/bash

echo "🌐 DealOrbit Public URL Generator"
echo "=================================="
echo ""

# Ensure server is running
if ! lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Starting local server on port 8000..."
    python3 -m http.server 8000 > /dev/null 2>&1 &
    sleep 2
    echo "✅ Server started"
fi

echo "🔗 Creating public tunnel..."
echo ""
echo "Please wait a few seconds for the URL to appear..."
echo ""

# Run cloudflared and extract URL
./cloudflared tunnel --url http://localhost:8000 2>&1 | while read line; do
    echo "$line"
    if echo "$line" | grep -qE "https://[a-z0-9-]+\.trycloudflare\.com"; then
        URL=$(echo "$line" | grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" | head -1)
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ YOUR PUBLIC URL IS READY!"
        echo ""
        echo "   $URL"
        echo ""
        echo "📤 Share this URL with your business partner!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Press Ctrl+C to stop the tunnel when done."
    fi
done







