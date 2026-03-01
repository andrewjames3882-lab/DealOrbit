# Real-Time Sync Setup for DealOrbit

## ✅ What's Been Added

Real-time synchronization has been added to DealOrbit! Now when you and your partner access the same URL, any changes you make will automatically sync in real-time.

## 📋 Requirements

You need **Node.js** installed to enable real-time sync. If Node.js is not installed:

### Install Node.js on macOS:

1. **Using Homebrew (recommended):**
   ```bash
   brew install node
   ```

2. **Or download from:**
   https://nodejs.org/

   Download the LTS version and install it.

### Verify Installation:
```bash
node --version
npm --version
```

## 🚀 How to Use

Once Node.js is installed, use the updated sharing script:

```bash
./share-website.sh
```

This will:
1. ✅ Install WebSocket dependencies automatically
2. ✅ Start the DealOrbit server (serves files + WebSocket sync)
3. ✅ Create a public tunnel via cloudflared
4. ✅ Give you a shareable URL

## 🔄 How Real-Time Sync Works

1. Both you and your partner visit the same public URL
2. When you make any change (add deal, modify rotation, etc.), it instantly syncs to your partner
3. Your partner sees your changes in real-time without refreshing
4. Works both ways - changes sync from either person

## 🛠️ Manual Setup (if needed)

If you prefer to start services manually:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   node ws-server.js
   ```

3. **In another terminal, start cloudflared:**
   ```bash
   ./cloudflared tunnel --url http://localhost:8000
   ```

## ⚠️ Troubleshooting

- **If you see "Node.js not found":** Install Node.js first (see above)
- **If WebSocket connection fails:** The server needs to be running. Make sure `ws-server.js` is running.
- **If changes don't sync:** Check browser console (F12) for connection errors

## 📝 Notes

- The server must stay running for real-time sync to work
- If you close the server, you'll lose real-time sync but can still use the app locally
- The WebSocket connection automatically reconnects if it drops



