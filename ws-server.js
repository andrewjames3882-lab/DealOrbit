#!/usr/bin/env node

// Combined HTTP/WebSocket + API Server for DealOrbit
// - Serves static files (index.html, app.js, styles.css, etc.)
// - Exposes a multi-tenant JSON API for:
//   - Authentication (per-rooftop login)
//   - Per-rooftop application state persistence
// - Keeps WebSocket support available (currently unused by the client)

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;
let sharedState = null; // kept for backward-compat WebSocket messages (not used by API)
let connectedClients = new Set();

// --- Simple JSON file "database" for multi-tenant data ---

const DB_FILE = path.join(__dirname, 'db.json');

function ensureDbFile() {
    if (!fs.existsSync(DB_FILE)) {
        const initial = {
            tenants: [], // [{ id, company, planType, createdAt, state }]
            sessions: [] // [{ token, tenantId, userId, createdAt, expiresAt }]
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    }
}

function loadDb() {
    ensureDbFile();
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        if (!raw.trim()) {
            return { tenants: [], sessions: [] };
        }
        const parsed = JSON.parse(raw);
        // Ensure required top-level keys exist
        return {
            tenants: Array.isArray(parsed.tenants) ? parsed.tenants : [],
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
        };
    } catch (err) {
        console.error('❌ Failed to read DB file, recreating it:', err);
        const initial = { tenants: [], sessions: [] };
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
        } catch (writeErr) {
            console.error('❌ Failed to recreate DB file:', writeErr);
        }
        return initial;
    }
}

function saveDb(db) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (err) {
        console.error('❌ Failed to write DB file:', err);
    }
}

function generateId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// Password hashing helpers (PBKDF2 with per-user salt)
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
    } catch {
        // Fallback comparison if lengths differ
        return hash === testHash;
    }
}

function generateSessionToken() {
    return generateId('sess');
}

function getAuthTokenFromRequest(req) {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.substring(7).trim();
}

function getSessionFromToken(db, token) {
    if (!token) return null;
    const session = db.sessions.find(s => s.token === token);
    if (!session) return null;
    if (session.expiresAt && Date.now() > Date.parse(session.expiresAt)) {
        return null;
    }
    return session;
}

function getTenantByCompany(db, companyRaw) {
    if (!companyRaw) return null;
    const company = String(companyRaw).trim().toLowerCase();
    if (!company) return null;
    return db.tenants.find(t => t.company && t.company.toLowerCase() === company);
}

function getAuthContext(db, req) {
    const token = getAuthTokenFromRequest(req);
    if (!token) return null;
    const session = getSessionFromToken(db, token);
    if (!session) return null;
    const tenant = db.tenants.find(t => t.id === session.tenantId);
    if (!tenant) return null;
    const state = tenant.state || {};
    const users = Array.isArray(state.users) ? state.users : [];
    const user = users.find(u => u.id === session.userId);
    if (!user) return null;
    return { token, session, tenant, state, user };
}

function createInitialTenantState({ user, company }) {
    const nowIso = new Date().toISOString();
    return {
        managers: [],
        dealHistory: [],
        rotationOrder: [],
        dailyDeals: {},
        lastAssignedManager: null,
        historicalSpreadsheets: [],
        paymentBumpGoals: {},
        users: [
            {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                company,
                phone: user.phone || '',
                role: user.role,
                passwordHash: user.passwordHash,
                needsPasswordSetup: false,
                createdAt: nowIso
            }
        ],
        removedDeals: [],
        purchasePlan: {
            planType: 'standard',
            maxUsers: 10,
            currentUsers: 1
        }
    };
}

function createSession(db, tenantId, userId) {
    const token = generateSessionToken();
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
    const session = {
        token,
        tenantId,
        userId,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(expiresAt).toISOString()
    };
    db.sessions.push(session);
    return session;
}

function sanitizeUserForClient(user) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
}

// MIME types for serving files
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Helper to read JSON body from a request
function readJsonBody(req, callback) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        if (!body) {
            callback(null, {});
            return;
        }
        try {
            const data = JSON.parse(body);
            callback(null, data);
        } catch (err) {
            callback(err);
        }
    });
}

// Common CORS headers for API responses
function setApiCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Create HTTP server that serves files and API
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const { pathname } = parsedUrl;

    // Health check endpoint
    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            clients: connectedClients.size,
            hasState: sharedState !== null
        }));
        return;
    }

    // Handle CORS preflight for API routes
    if (pathname.startsWith('/api/') && req.method === 'OPTIONS') {
        setApiCorsHeaders(res);
        res.writeHead(200);
        res.end();
        return;
    }

    // --- Authentication API ---

    if (pathname === '/api/auth/signup' && req.method === 'POST') {
        setApiCorsHeaders(res);
        readJsonBody(req, (err, body) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
                return;
            }

            const name = (body.name || '').trim();
            const email = (body.email || '').trim();
            const company = (body.company || '').trim();
            const phone = (body.phone || '').trim();
            const role = (body.role || 'admin').trim();
            const username = (body.username || '').trim();
            const password = body.password || '';

            if (!name || !email || !company || !role || !username || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required fields' }));
                return;
            }

            const db = loadDb();

            // Ensure company not already registered
            const existingTenant = getTenantByCompany(db, company);
            if (existingTenant) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'A dealership with this company name already exists. Please contact support if this is unexpected.' }));
                return;
            }

            // Ensure username/email not already used globally
            const existingUser = db.tenants
                .flatMap(t => (t.state && Array.isArray(t.state.users)) ? t.state.users : [])
                .find(u => 
                    (u.email && u.email.toLowerCase() === email.toLowerCase()) ||
                    (u.username && u.username.toLowerCase() === username.toLowerCase())
                );
            if (existingUser) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'An account with this email or username already exists.' }));
                return;
            }

            const tenantId = generateId('tenant');
            const userId = generateId('user');
            const passwordHash = hashPassword(password);

            const initialUser = {
                id: userId,
                name,
                email,
                username,
                company,
                phone,
                role,
                passwordHash,
                needsPasswordSetup: false,
                createdAt: new Date().toISOString()
            };

            const state = createInitialTenantState({ user: initialUser, company });

            const tenant = {
                id: tenantId,
                company,
                planType: 'standard',
                createdAt: new Date().toISOString(),
                state
            };

            db.tenants.push(tenant);
            const session = createSession(db, tenantId, userId);
            saveDb(db);

            const safeUser = sanitizeUserForClient(initialUser);

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                token: session.token,
                user: safeUser,
                tenant: { id: tenantId, company, planType: tenant.planType }
            }));
        });
        return;
    }

    // Lookup user for login (by company + username)
    if (pathname === '/api/auth/lookup' && req.method === 'POST') {
        setApiCorsHeaders(res);
        readJsonBody(req, (err, body) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
                return;
            }
            const company = (body.company || '').trim();
            const username = (body.username || '').trim();
            if (!company || !username) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing company or username' }));
                return;
            }
            const db = loadDb();
            const tenant = getTenantByCompany(db, company);
            if (!tenant || !tenant.state || !Array.isArray(tenant.state.users)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ exists: false }));
                return;
            }
            const user = tenant.state.users.find(u => 
                u.username && u.username.toLowerCase() === username.toLowerCase()
            );
            if (!user) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ exists: false }));
                return;
            }
            const needsPasswordSetup = !!user.needsPasswordSetup || !user.passwordHash;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                exists: true,
                needsPasswordSetup,
                displayName: user.name,
                role: user.role
            }));
        });
        return;
    }

    // Complete initial password setup and log in
    if (pathname === '/api/auth/complete-setup' && req.method === 'POST') {
        setApiCorsHeaders(res);
        readJsonBody(req, (err, body) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
                return;
            }
            const company = (body.company || '').trim();
            const username = (body.username || '').trim();
            const newPassword = body.newPassword || '';
            if (!company || !username || !newPassword) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required fields' }));
                return;
            }
            const db = loadDb();
            const tenant = getTenantByCompany(db, company);
            if (!tenant || !tenant.state || !Array.isArray(tenant.state.users)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid company or user' }));
                return;
            }
            const user = tenant.state.users.find(u => 
                u.username && u.username.toLowerCase() === username.toLowerCase()
            );
            if (!user) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid company or user' }));
                return;
            }
            if (user.passwordHash && !user.needsPasswordSetup) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Password is already set. Please log in instead.' }));
                return;
            }
            user.passwordHash = hashPassword(newPassword);
            user.needsPasswordSetup = false;
            const session = createSession(db, tenant.id, user.id);
            saveDb(db);

            const safeUser = sanitizeUserForClient(user);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                token: session.token,
                user: safeUser,
                tenant: { id: tenant.id, company: tenant.company, planType: tenant.planType }
            }));
        });
        return;
    }

    // Regular login
    if (pathname === '/api/auth/login' && req.method === 'POST') {
        setApiCorsHeaders(res);
        readJsonBody(req, (err, body) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
                return;
            }
            const company = (body.company || '').trim();
            const username = (body.username || '').trim();
            const password = body.password || '';
            if (!company || !username || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required fields' }));
                return;
            }
            const db = loadDb();
            const tenant = getTenantByCompany(db, company);
            if (!tenant || !tenant.state || !Array.isArray(tenant.state.users)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid username or password' }));
                return;
            }
            const user = tenant.state.users.find(u => 
                u.username && u.username.toLowerCase() === username.toLowerCase()
            );
            if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid username or password' }));
                return;
            }
            const session = createSession(db, tenant.id, user.id);
            saveDb(db);
            const safeUser = sanitizeUserForClient(user);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                token: session.token,
                user: safeUser,
                tenant: { id: tenant.id, company: tenant.company, planType: tenant.planType }
            }));
        });
        return;
    }

    // Get current authenticated user + tenant
    if (pathname === '/api/auth/me' && req.method === 'GET') {
        setApiCorsHeaders(res);
        const db = loadDb();
        const auth = getAuthContext(db, req);
        if (!auth) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not authenticated' }));
            return;
        }
        const safeUser = sanitizeUserForClient(auth.user);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            user: safeUser,
            tenant: { id: auth.tenant.id, company: auth.tenant.company, planType: auth.tenant.planType }
        }));
        return;
    }

    // Logout: invalidate current session
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
        setApiCorsHeaders(res);
        const db = loadDb();
        const token = getAuthTokenFromRequest(req);
        if (token) {
            const idx = db.sessions.findIndex(s => s.token === token);
            if (idx !== -1) {
                db.sessions.splice(idx, 1);
                saveDb(db);
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    // --- State sync endpoints (polling-based, per-tenant) ---

    if (pathname === '/api/state' && req.method === 'GET') {
        setApiCorsHeaders(res);
        const db = loadDb();
        const auth = getAuthContext(db, req);
        if (!auth) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not authenticated' }));
            return;
        }
        const tenant = auth.tenant;
        const state = tenant.state || null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            state,
            timestamp: Date.now()
        }));
        return;
    }
    
    if (pathname === '/api/state' && req.method === 'POST') {
        setApiCorsHeaders(res);
        const db = loadDb();
        const auth = getAuthContext(db, req);
        if (!auth) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not authenticated' }));
            return;
        }
        readJsonBody(req, (err, body) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
                return;
            }
            if (!body || typeof body.state !== 'object') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing state in request body' }));
                return;
            }
            const tenant = db.tenants.find(t => t.id === auth.tenant.id);
            if (!tenant) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Tenant not found' }));
                return;
            }
            // Replace tenant state with provided state blob
            tenant.state = body.state;
            saveDb(db);

            // Also keep an in-memory sharedState reference for backward-compat logging
            sharedState = body.state;
            broadcastToAll({
                type: 'state_sync',
                data: sharedState,
                timestamp: Date.now()
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        });
        return;
    }
    
    // Handle OPTIONS for non-API routes (minimal)
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    
    // Static file serving
    const staticParsedUrl = url.parse(req.url);
    let filePath = staticParsedUrl.pathname === '/' ? '/index.html' : staticParsedUrl.pathname;
    filePath = path.join(__dirname, filePath);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    console.log(`✅ New client connected from ${req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown'}`);
    console.log(`   Total connected clients: ${connectedClients.size + 1}`);
    connectedClients.add(ws);
    
    // Send current shared state to newly connected client immediately
    if (sharedState) {
        console.log(`📤 Sending initial state to new client`);
        ws.send(JSON.stringify({
            type: 'state_sync',
            data: sharedState,
            timestamp: Date.now()
        }));
    } else {
        console.log(`ℹ️  No shared state yet - waiting for first client to send state`);
    }
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'state_update':
                    // Update shared state
                    sharedState = data.data;
                    console.log(`📥 State updated by client. Current clients: ${connectedClients.size}`);
                    // Broadcast to all other clients (excluding the sender)
                    broadcastToOthers(ws, {
                        type: 'state_sync',
                        data: sharedState,
                        timestamp: Date.now(),
                        from: 'partner'
                    });
                    console.log(`📤 Broadcasting to ${connectedClients.size - 1} other client(s)`);
                    break;
                    
                case 'ping':
                    // Respond to ping for connection health check
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;
                    
                default:
                    console.log(`⚠️  Unknown message type: ${data.type}`);
            }
        } catch (error) {
            console.error('❌ Error processing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log(`🔌 Client disconnected. Remaining clients: ${connectedClients.size - 1}`);
        connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        connectedClients.delete(ws);
    });
});

function broadcastToOthers(sender, message) {
    const messageStr = JSON.stringify(message);
    connectedClients.forEach((client) => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

function broadcastToAll(message) {
    const messageStr = JSON.stringify(message);
    connectedClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

// Start server
server.listen(PORT, () => {
    console.log(`🚀 DealOrbit server running on http://localhost:${PORT}`);
    console.log(`✅ HTTP file serving enabled`);
    console.log(`✅ WebSocket real-time sync enabled`);
    console.log(`📡 Waiting for clients to connect...`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down WebSocket server...');
    wss.close(() => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});

