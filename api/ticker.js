const https = require('https');

module.exports = (req, res) => {
    // Allow CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { pair } = req.query;
    if (!pair) {
        return res.status(400).json({ error: 'Missing pair parameter' });
    }

    const targetUrl = `https://indodax.com/api/ticker/${pair}`;

    https.get(targetUrl, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const json = JSON.parse(data);
                res.status(200).json(json);
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse Indodax response' });
            }
        });
    }).on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
};
