#!/bin/bash

# Complete Step-by-Step Guide to Share DealOrbit Website

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DealOrbit Website Sharing - Complete Guide"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check ngrok configuration
echo "STEP 1: Checking ngrok configuration..."
if ./ngrok config check > /dev/null 2>&1; then
    echo "✅ ngrok is already configured!"
    echo ""
else
    echo "❌ ngrok needs to be configured"
    echo ""
    echo "📝 You need to get your authtoken from ngrok:"
    echo "   1. The page should have opened in your browser"
    echo "   2. If not, go to: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "   3. Sign up/login if needed (it's free!)"
    echo "   4. Copy your authtoken (long string of letters/numbers)"
    echo ""
    read -p "Paste your ngrok authtoken here: " authtoken
    
    if [ -z "$authtoken" ]; then
        echo "❌ No authtoken provided. Exiting."
        exit 1
    fi
    
    echo ""
    echo "Configuring ngrok..."
    ./ngrok config add-authtoken "$authtoken"
    
    if [ $? -eq 0 ]; then
        echo "✅ ngrok configured successfully!"
    else
        echo "❌ Failed to configure ngrok. Please check your authtoken."
        exit 1
    fi
    echo ""
fi

# Step 2: Start local server
echo "STEP 2: Starting local web server..."
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Server already running on port 8000"
else
    echo "Starting server on port 8000..."
    python3 -m http.server 8000 > /dev/null 2>&1 &
    SERVER_PID=$!
    sleep 2
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ Server started successfully (PID: $SERVER_PID)"
    else
        echo "❌ Failed to start server. Please check if port 8000 is available."
        exit 1
    fi
fi
echo ""

# Step 3: Test local server
echo "STEP 3: Testing local server..."
if curl -s http://localhost:8000 > /dev/null 2>&1; then
    echo "✅ Local server is working!"
    echo "   You can test it at: http://localhost:8000"
else
    echo "⚠️  Server might not be ready yet. Continuing anyway..."
fi
echo ""

# Step 4: Start ngrok tunnel
echo "STEP 4: Starting ngrok tunnel..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 Your public URL will appear below:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Look for a line that says 'Forwarding:' with a URL"
echo "That URL is what you share with your partner!"
echo ""
echo "Press Ctrl+C to stop the tunnel when done."
echo ""

# Start ngrok
./ngrok http 8000







