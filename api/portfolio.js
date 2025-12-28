const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

module.exports = (req, res) => {
    // Allow CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { apiKey, secretKey } = req.body;

    if (!apiKey || !secretKey) {
        return res.status(400).json({ error: 'Missing API Key or Secret Key' });
    }

    const method = 'getInfo';
    const timestamp = Date.now();
    const body = { method, timestamp, recvWindow: 10000 };
    const payload = querystring.stringify(body);

    const signature = crypto.createHmac('sha512', secretKey)
        .update(payload)
        .digest('hex');

    const options = {
        hostname: 'indodax.com',
        port: 443,
        path: '/tapi',
        method: 'POST',
        headers: {
            'Key': apiKey,
            'Sign': signature,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const apiReq = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const json = JSON.parse(data);

                // Fetch prices for validatio/estimation
                https.get('https://indodax.com/api/summaries', (priceRes) => {
                    let priceData = '';
                    priceRes.on('data', c => priceData += c);
                    priceRes.on('end', () => {
                        try {
                            const prices = JSON.parse(priceData).tickers;
                            res.status(200).json({ success: true, data: json.return, prices: prices });
                        } catch (e) {
                            // Return portfolio even if prices fail
                            res.status(200).json({ success: true, data: json.return, prices: {} });
                        }
                    });
                });

            } catch (e) {
                res.status(500).json({ error: 'Failed to parse Indodax response' });
            }
        });
    });

    apiReq.on('error', (e) => {
        res.status(500).json({ error: e.message });
    });

    apiReq.write(payload);
    apiReq.end();
};
