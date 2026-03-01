# ngrok Setup Guide for DealOrbit

## Quick Setup Steps

### 1. Create Free ngrok Account
- Go to: https://dashboard.ngrok.com/signup
- Sign up with email (it's free!)
- Verify your email if needed

### 2. Get Your Authtoken
- After logging in, go to: https://dashboard.ngrok.com/get-started/your-authtoken
- Copy your authtoken (it looks like: `2abc123def456ghi789jkl012mno345pq_6r7s8t9u0v1w2x3y4z5`)

### 3. Configure ngrok
Run this command (replace YOUR_TOKEN with your actual token):
```bash
cd /Volumes/DrewSanDisk/DealOrbit
./ngrok config add-authtoken YOUR_TOKEN
```

### 4. Start Your Tunnel
```bash
# Make sure local server is running first
python3 -m http.server 8000 &

# Then start ngrok
./ngrok http 8000
```

### 5. Share Your URL
ngrok will display a URL like:
```
Forwarding: https://abc123.ngrok-free.app -> http://localhost:8000
```

Share the `https://abc123.ngrok-free.app` URL with your partner!

## Easy Way: Use the Setup Script

Just run:
```bash
cd /Volumes/DrewSanDisk/DealOrbit
./ngrok-setup.sh
```

The script will guide you through everything!

## Benefits of ngrok
- ✅ Free account available
- ✅ More stable than temporary tunnels
- ✅ Can get a permanent URL (with paid plan)
- ✅ Better performance
- ✅ Web interface to monitor traffic

## Troubleshooting

**"authtoken required" error:**
- Make sure you've run: `./ngrok config add-authtoken YOUR_TOKEN`

**"port already in use" error:**
- Stop any other servers on port 8000
- Or use a different port: `./ngrok http 8080`

**Need help?**
- ngrok docs: https://ngrok.com/docs
- Dashboard: https://dashboard.ngrok.com







