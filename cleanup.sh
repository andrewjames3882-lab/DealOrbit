#!/bin/bash

# DealOrbit Cleanup Script
# Removes temporary tunnel files and stops running processes

echo "🧹 DealOrbit Cleanup"
echo "==================="
echo ""

# Stop Python HTTP server
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "Stopping Python HTTP server..."
    kill $(lsof -ti:8000) 2>/dev/null
    echo "✅ Stopped"
else
    echo "✅ No server running on port 8000"
fi

# Stop cloudflared processes
cloudflared_pids=$(ps aux | grep "cloudflared tunnel" | grep -v grep | awk '{print $2}')
if [ -n "$cloudflared_pids" ]; then
    echo "Stopping cloudflared tunnels..."
    echo "$cloudflared_pids" | xargs kill 2>/dev/null
    echo "✅ Stopped"
else
    echo "✅ No cloudflared tunnels running"
fi

# Stop ngrok processes
ngrok_pids=$(ps aux | grep "ngrok" | grep -v grep | awk '{print $2}')
if [ -n "$ngrok_pids" ]; then
    echo "Stopping ngrok tunnels..."
    echo "$ngrok_pids" | xargs kill 2>/dev/null
    echo "✅ Stopped"
else
    echo "✅ No ngrok tunnels running"
fi

echo ""
read -p "Remove temporary tunnel files? (cloudflared, ngrok, zip files) [y/N]: " remove_files

if [ "$remove_files" = "y" ] || [ "$remove_files" = "Y" ]; then
    cd /Volumes/DrewSanDisk/DealOrbit
    rm -f cloudflared cloudflared.tgz ngrok ngrok.zip ._cloudflared ._cloudflared.tgz ._ngrok ._ngrok.zip
    echo "✅ Temporary files removed"
else
    echo "ℹ️  Files kept (you can remove them later if needed)"
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Note: Git repository and website files are untouched."







