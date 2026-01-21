#!/usr/bin/env node
/**
 * Mock Accounts Platform Server (No Dependencies)
 *
 * Run: node server.js
 * Test credentials: test@example.com / Test@123
 */

const http = require('http');
const url = require('url');
const PORT = 8080;

// Test user
const USER = {
    id: 'user_001',
    email: 'test@example.com',
    password: 'Test@123',
    display_name: 'Test User',
    role: 'student',
    is_email_verified: true
};

const TOKENS = {
    access: 'mock_access_' + Date.now(),
    refresh: 'mock_refresh_' + Date.now(),
    csrf: 'mock_csrf_' + Date.now()
};

function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function setAuthCookies(res) {
    const cookies = [
        `access_token=${TOKENS.access}; Path=/; Max-Age=900; SameSite=Lax`,
        `refresh_token=${TOKENS.refresh}; Path=/; HttpOnly; Max-Age=604800; SameSite=Lax`,
        `csrf_token=${TOKENS.csrf}; Path=/; Max-Age=604800; SameSite=Lax`
    ];
    res.setHeader('Set-Cookie', cookies);
}

function jsonResponse(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function getBody(req, callback) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => callback(JSON.parse(body || '{}')));
}

const server = http.createServer((req, res) => {
    setCORS(res);

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    // OPTIONS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // POST /api/auth/login
    if (method === 'POST' && path === '/api/auth/login') {
        return getBody(req, body => {
            if (body.email === USER.email && body.password === USER.password) {
                setAuthCookies(res);
                jsonResponse(res, 200, {
                    status: 'ok',
                    message: 'Login successful',
                    data: {
                        access_token: TOKENS.access,
                        user: { ...USER, password: undefined }
                    }
                });
                console.log('✓ Login:', body.email);
            } else {
                jsonResponse(res, 401, {
                    status: 'error',
                    message: 'Invalid credentials',
                    data: null
                });
                console.log('✗ Login failed:', body.email);
            }
        });
    }

    // POST /api/auth/register
    if (method === 'POST' && path === '/api/auth/register') {
        return getBody(req, body => {
            if (body.email === USER.email) {
                return jsonResponse(res, 400, {
                    status: 'error',
                    message: 'Email already registered',
                    data: null
                });
            }
            jsonResponse(res, 200, {
                status: 'ok',
                message: 'Registration successful',
                data: {
                    user: {
                        id: 'user_' + Date.now(),
                        email: body.email,
                        display_name: body.display_name,
                        role: 'student',
                        is_email_verified: false
                    }
                }
            });
            console.log('✓ Register:', body.email);
        });
    }

    // POST /auth/refresh
    if (method === 'POST' && path === '/auth/refresh') {
        const csrf = req.headers['x-csrf-token'];
        if (csrf !== TOKENS.csrf) {
            return jsonResponse(res, 403, {
                status: 'error',
                message: 'Invalid CSRF token',
                data: null
            });
        }
        TOKENS.access = 'mock_access_' + Date.now();
        setAuthCookies(res);
        jsonResponse(res, 200, {
            status: 'ok',
            message: 'Token refreshed',
            data: { access_token: TOKENS.access }
        });
        console.log('✓ Token refreshed');
        return;
    }

    // GET /api/auth/session
    if (method === 'GET' && path === '/api/auth/session') {
        jsonResponse(res, 200, {
            status: 'ok',
            message: 'Session valid',
            data: { user: { ...USER, password: undefined } }
        });
        return;
    }

    // POST /api/auth/logout
    if (method === 'POST' && path === '/api/auth/logout') {
        res.setHeader('Set-Cookie', [
            'access_token=; Path=/; Max-Age=0',
            'refresh_token=; Path=/; Max-Age=0',
            'csrf_token=; Path=/; Max-Age=0'
        ]);
        jsonResponse(res, 200, {
            status: 'ok',
            message: 'Logout successful',
            data: null
        });
        console.log('✓ Logout');
        return;
    }

    // GET /oauth/:provider
    if (method === 'GET' && path.startsWith('/oauth/')) {
        const provider = path.split('/')[2];
        const token = `oauth_${provider}_` + Date.now();
        const user = {
            id: `oauth_${provider}_001`,
            email: `test.${provider}@example.com`,
            display_name: `${provider} User`,
            role: 'student',
            is_email_verified: true
        };

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html>
<head><title>OAuth ${provider}</title>
<style>
body{font-family:Arial;display:flex;justify-content:center;align-items:center;
height:100vh;margin:0;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}
.spinner{border:4px solid rgba(255,255,255,.3);border-top:4px solid #fff;
border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:20px auto}
@keyframes spin{to{transform:rotate(360deg)}}
</style></head>
<body>
<div><h2>${provider}</h2><div class="spinner"></div><p>Authenticating...</p></div>
<script>
setTimeout(()=>{
window.opener.postMessage({status:'ok',data:{access_token:'${token}',user:${JSON.stringify(user)}}}, '*');
window.close();
},1000);
</script>
</body></html>`);
        console.log('✓ OAuth:', provider);
        return;
    }

    // GET /health
    if (method === 'GET' && path === '/health') {
        jsonResponse(res, 200, {
            status: 'ok',
            message: 'Mock server running',
            data: {
                testCredentials: { email: USER.email, password: '********' },
                endpoints: [
                    'POST /api/auth/login',
                    'POST /api/auth/register',
                    'POST /auth/refresh',
                    'GET /api/auth/session',
                    'POST /api/auth/logout',
                    'GET /oauth/:provider'
                ]
            }
        });
        return;
    }

    // 404
    jsonResponse(res, 404, { status: 'error', message: 'Not found', data: null });
});

server.listen(PORT, () => {
    console.log('\n🚀 Mock Accounts Server');
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📧 ${USER.email} / ${USER.password}\n`);
});
