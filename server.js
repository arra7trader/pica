/**
 * PICA - Indodax API Proxy Server
 * 
 * Server lokal untuk menghubungkan website PICA dengan Indodax API.
 * Mengatasi masalah CORS dan menangani signature HMAC-SHA512.
 * 
 * Cara menjalankan:
 * 1. Install Node.js jika belum ada
 * 2. Buka terminal di folder ini
 * 3. Jalankan: node server.js
 * 4. Buka website PICA di browser
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const url = require('url');

const PORT = 3001;

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Secret-Key',
    'Content-Type': 'application/json'
};

// Create HMAC-SHA512 signature
function createSignature(params, secretKey) {
    const queryString = new URLSearchParams(params).toString();
    return crypto.createHmac('sha512', secretKey).update(queryString).digest('hex');
}

// Make request to Indodax API
async function callIndodaxAPI(apiKey, secretKey, method) {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const params = {
            method: method,
            timestamp: timestamp,
            recvWindow: 5000
        };

        const signature = createSignature(params, secretKey);
        const postData = new URLSearchParams(params).toString();

        const options = {
            hostname: 'indodax.com',
            port: 443,
            path: '/tapi',
            method: 'POST',
            headers: {
                'Key': apiKey,
                'Sign': signature,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Fetch public ticker data
async function fetchTicker(pair) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'indodax.com',
            port: 443,
            path: `/api/ticker/${pair}`,
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Fetch all summaries for price data
async function fetchSummaries() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'indodax.com',
            port: 443,
            path: '/api/summaries',
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Request handler
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    try {
        // Get portfolio info
        if (path === '/api/portfolio' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const { apiKey, secretKey } = JSON.parse(body);

                    if (!apiKey || !secretKey) {
                        res.writeHead(400, corsHeaders);
                        res.end(JSON.stringify({ success: false, error: 'API keys required' }));
                        return;
                    }

                    console.log(`[${new Date().toLocaleTimeString()}] Fetching portfolio...`);

                    // Get account info from Indodax
                    const result = await callIndodaxAPI(apiKey, secretKey, 'getInfo');

                    if (result.success === 1) {
                        // Also fetch current prices
                        const summaries = await fetchSummaries();

                        res.writeHead(200, corsHeaders);
                        res.end(JSON.stringify({
                            success: true,
                            data: result.return,
                            prices: summaries.tickers || {}
                        }));
                        console.log(`[${new Date().toLocaleTimeString()}] Portfolio fetched successfully!`);
                    } else {
                        res.writeHead(200, corsHeaders);
                        res.end(JSON.stringify({
                            success: false,
                            error: result.error || 'Unknown error'
                        }));
                        console.log(`[${new Date().toLocaleTimeString()}] API Error: ${result.error}`);
                    }
                } catch (e) {
                    res.writeHead(500, corsHeaders);
                    res.end(JSON.stringify({ success: false, error: e.message }));
                    console.error(`[${new Date().toLocaleTimeString()}] Error:`, e.message);
                }
            });
            return;
        }

        // Get ticker price
        if (path === '/api/ticker' && req.method === 'GET') {
            const pair = parsedUrl.query.pair || 'btc_idr';
            console.log(`[${new Date().toLocaleTimeString()}] Fetching ticker: ${pair}`);

            const result = await fetchTicker(pair);
            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify(result));
            return;
        }

        // Get all summaries
        if (path === '/api/summaries' && req.method === 'GET') {
            console.log(`[${new Date().toLocaleTimeString()}] Fetching summaries...`);

            const result = await fetchSummaries();
            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify(result));
            return;
        }

        // Health check
        if (path === '/api/health') {
            res.writeHead(200, corsHeaders);
            res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
            return;
        }

        // 404 for other routes
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({ error: 'Not found' }));

    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
});

server.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  PICA Indodax Proxy Server');
    console.log('='.repeat(50));
    console.log(`  Server running at: http://localhost:${PORT}`);
    console.log('');
    console.log('  Endpoints:');
    console.log('  - POST /api/portfolio  (get account info)');
    console.log('  - GET  /api/ticker     (get price ticker)');
    console.log('  - GET  /api/summaries  (get all prices)');
    console.log('  - GET  /api/health     (health check)');
    console.log('');
    console.log('  Press Ctrl+C to stop the server');
    console.log('='.repeat(50));
    console.log('');
});
