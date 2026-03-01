# How to Get Your ngrok Authtoken

## Step-by-Step Instructions

### Step 1: Sign Up (if you haven't already)
1. Go to: https://dashboard.ngrok.com/signup
2. Sign up with your email address (it's free!)
3. Verify your email if prompted

### Step 2: Log In
1. Go to: https://dashboard.ngrok.com/login
2. Log in with your email and password

### Step 3: Get Your Authtoken
1. After logging in, you'll be taken to your dashboard
2. Look for the "Your Authtoken" section, OR
3. Go directly to: https://dashboard.ngrok.com/get-started/your-authtoken
4. You'll see a long string that looks like:
   ```
   2abc123def456ghi789jkl012mno345pq_6r7s8t9u0v1w2x3y4z5
   ```
5. Click the "Copy" button next to it (or manually select and copy it)

### Step 4: Use Your Authtoken
Once you have your authtoken, run this command:

```bash
cd /Volumes/DrewSanDisk/DealOrbit
./ngrok config add-authtoken YOUR_TOKEN_HERE
```

(Replace `YOUR_TOKEN_HERE` with the token you copied)

### Step 5: Start Your Tunnel
After configuring, start ngrok:

```bash
# Start local server (if not running)
python3 -m http.server 8000 &

# Start ngrok tunnel
./ngrok http 8000
```

## Quick Links
- **Sign Up**: https://dashboard.ngrok.com/signup
- **Get Authtoken**: https://dashboard.ngrok.com/get-started/your-authtoken
- **Dashboard**: https://dashboard.ngrok.com

## What the Authtoken Looks Like
Your authtoken will be a long string of letters, numbers, and underscores, typically around 40-50 characters long.

Example format: `2abc123def456ghi789jkl012mno345pq_6r7s8t9u0v1w2x3y4z5`

## Troubleshooting
- **Can't find the authtoken?** Make sure you're logged in and go directly to: https://dashboard.ngrok.com/get-started/your-authtoken
- **Token not working?** Make sure you copied the entire token (no spaces before or after)
- **Need help?** Check ngrok docs: https://ngrok.com/docs







