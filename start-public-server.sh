#!/bin/bash

# DealOrbit Public Server Setup
# This script helps you share your website with a public URL

echo "🚀 DealOrbit Public Server Setup"
echo "================================"
echo ""

# Check if Python server is running
if ! lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Starting local server on port 8000..."
    python3 -m http.server 8000 &
    SERVER_PID=$!
    echo "✅ Local server started (PID: $SERVER_PID)"
    sleep 2
else
    echo "✅ Local server already running on port 8000"
fi

echo ""
echo "Choose your tunneling method:"
echo "1. ngrok (requires free signup at https://ngrok.com)"
echo "2. cloudflared (no signup required)"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    if [ ! -f "./ngrok" ]; then
        echo "❌ ngrok not found. Please download from https://ngrok.com/download"
        exit 1
    fi
    
    echo ""
    echo "📝 ngrok Setup Instructions:"
    echo "1. Sign up for free at: https://dashboard.ngrok.com/signup"
    echo "2. Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "3. Run: ./ngrok config add-authtoken YOUR_TOKEN"
    echo "4. Then run: ./ngrok http 8000"
    echo ""
    read -p "Have you set up your ngrok authtoken? (y/n): " ready
    
    if [ "$ready" = "y" ] || [ "$ready" = "Y" ]; then
        echo "Starting ngrok tunnel..."
        ./ngrok http 8000
    else
        echo "Please set up ngrok first, then run this script again."
    fi
    
elif [ "$choice" = "2" ]; then
    if [ ! -f "./cloudflared" ]; then
        echo "Downloading cloudflared..."
        curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64 -o cloudflared
        chmod +x cloudflared
    fi
    
    echo "Starting cloudflared tunnel (no signup required)..."
    echo "Your public URL will appear below:"
    echo ""
    ./cloudflared tunnel --url http://localhost:8000
else
    echo "Invalid choice. Exiting."
    exit 1
fi







