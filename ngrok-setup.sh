#!/bin/bash

# ngrok Setup and Launch Script for DealOrbit

echo "🚀 ngrok Setup for DealOrbit"
echo "============================"
echo ""

# Check if ngrok exists
if [ ! -f "./ngrok" ]; then
    echo "❌ ngrok not found. Downloading..."
    curl -o ngrok.zip https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-amd64.zip
    unzip -o ngrok.zip
    chmod +x ngrok
    rm ngrok.zip
    echo "✅ ngrok downloaded"
fi

# Check if authtoken is configured
if ! ./ngrok config check > /dev/null 2>&1; then
    echo "📝 ngrok requires authentication (free account)"
    echo ""
    echo "Step 1: Sign up for free at: https://dashboard.ngrok.com/signup"
    echo "Step 2: Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo ""
    read -p "Enter your ngrok authtoken (or press Enter to open signup page): " authtoken
    
    if [ -z "$authtoken" ]; then
        echo "Opening ngrok signup page..."
        open "https://dashboard.ngrok.com/signup"
        echo ""
        echo "After signing up, run this script again and enter your authtoken."
        exit 0
    else
        ./ngrok config add-authtoken "$authtoken"
        if [ $? -eq 0 ]; then
            echo "✅ Authtoken configured successfully!"
        else
            echo "❌ Failed to configure authtoken. Please check and try again."
            exit 1
        fi
    fi
else
    echo "✅ ngrok is already configured"
fi

# Ensure local server is running
if ! lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Starting local server on port 8000..."
    python3 -m http.server 8000 > /dev/null 2>&1 &
    SERVER_PID=$!
    sleep 2
    echo "✅ Local server started (PID: $SERVER_PID)"
else
    echo "✅ Local server already running on port 8000"
fi

echo ""
echo "🔗 Starting ngrok tunnel..."
echo ""
echo "Your public URL will appear below:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start ngrok
./ngrok http 8000







