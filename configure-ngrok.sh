#!/bin/bash

echo "🔧 ngrok Configuration"
echo "======================"
echo ""
echo "Paste your ngrok authtoken below."
echo "(You can get it from: https://dashboard.ngrok.com/get-started/your-authtoken)"
echo ""
read -p "Enter your authtoken: " authtoken

if [ -z "$authtoken" ]; then
    echo "❌ No authtoken provided."
    exit 1
fi

echo ""
echo "Configuring ngrok..."
cd /Volumes/DrewSanDisk/DealOrbit
./ngrok config add-authtoken "$authtoken"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ngrok configured successfully!"
    echo ""
    echo "Next step: Starting your server and tunnel..."
    echo ""
    read -p "Press Enter to continue..."
    
    # Start server
    if ! lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "Starting local server..."
        python3 -m http.server 8000 > /dev/null 2>&1 &
        sleep 2
    fi
    
    echo "✅ Server running on port 8000"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔗 Starting ngrok tunnel..."
    echo "Your public URL will appear below:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    ./ngrok http 8000
else
    echo ""
    echo "❌ Failed to configure ngrok. Please check your authtoken."
    exit 1
fi







