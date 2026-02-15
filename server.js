const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json());
app.use(express.static(__dirname));

// === CONFIG ===
const PORT = process.env.PORT || 3000;
const KEYS_FILE = './keys.json';

// === LOAD/SAVE KEYS ===
function loadKeys() {
    try {
        if (fs.existsSync(KEYS_FILE)) {
            const data = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
            const map = new Map();
            for (const k of data) {
                map.set(k.key, { 
                    hwid: k.hwid, 
                    expires: k.expires ? new Date(k.expires) : null 
                });
            }
            console.log(`[KEYS] Loaded ${map.size} keys from file`);
            return map;
        }
    } catch (e) {
        console.log(`[KEYS] Error loading keys: ${e.message}`);
    }
    return new Map();
}

function saveKeys() {
    try {
        const data = [];
        for (const [key, val] of licenses) {
            data.push({
                key: key,
                hwid: val.hwid,
                expires: val.expires
            });
        }
        fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
        console.log(`[KEYS] Saved ${data.length} keys to file`);
    } catch (e) {
        console.log(`[KEYS] Error saving keys: ${e.message}`);
    }
}

// Load keys from file
const licenses = loadKeys();

// === AUTH ===
app.post('/api/auth', (req, res) => {
    const { key, hwid } = req.body;
    console.log(`[AUTH] Request - Key: ${key}, HWID: ${hwid}`);
    
    if (!key || !hwid) {
        return res.json({ success: false, error: 'missing_params' });
    }
    
    const license = licenses.get(key);
    
    if (!license) {
        console.log(`[AUTH] Failed - Invalid key`);
        return res.json({ success: false, error: 'invalid_key' });
    }
    
    if (license.expires && new Date() > license.expires) {
        console.log(`[AUTH] Failed - Expired`);
        return res.json({ success: false, error: 'expired' });
    }
    
    if (license.hwid === null) {
        license.hwid = hwid;
        saveKeys();
        console.log(`[AUTH] HWID registered: ${hwid}`);
    } else if (license.hwid !== hwid) {
        console.log(`[AUTH] Failed - HWID mismatch`);
        return res.json({ success: false, error: 'hwid_mismatch' });
    }
    
    console.log(`[AUTH] Success`);
    res.json({ success: true });
});

// === CHECK ===
app.post('/api/check', (req, res) => {
    const { key, hwid } = req.body;
    
    if (!key || !hwid) {
        return res.json({ valid: false, reason: 'missing_params' });
    }
    
    const license = licenses.get(key);
    
    if (!license) {
        return res.json({ valid: false, reason: 'invalid_key' });
    }
    
    if (license.expires && new Date() > license.expires) {
        console.log(`[CHECK] Expired: ${key}`);
        return res.json({ valid: false, reason: 'expired' });
    }
    
    if (license.hwid !== hwid) {
        return res.json({ valid: false, reason: 'hwid_mismatch' });
    }
    
    res.json({ valid: true });
});

// === ADMIN ===
app.post('/api/admin/add-key', (req, res) => {
    const { adminKey, licenseKey, expires } = req.body;
    
    if (adminKey !== 'SUPER_SECRET_ADMIN_KEY') {
        return res.status(403).json({ success: false });
    }
    
    licenses.set(licenseKey, {
        hwid: null,
        expires: expires ? new Date(expires) : null
    });
    
    saveKeys();
    console.log(`[ADMIN] Key added: ${licenseKey}`);
    res.json({ success: true });
});

app.post('/api/admin/reset-key', (req, res) => {
    const { adminKey, licenseKey } = req.body;
    
    if (adminKey !== 'SUPER_SECRET_ADMIN_KEY') {
        return res.status(403).json({ success: false });
    }
    
    const license = licenses.get(licenseKey);
    if (license) {
        license.hwid = null;
        saveKeys();
        console.log(`[ADMIN] Key reset: ${licenseKey}`);
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'key_not_found' });
    }
});

app.get('/api/admin/list-keys', (req, res) => {
    const { adminKey } = req.query;
    
    if (adminKey !== 'SUPER_SECRET_ADMIN_KEY') {
        return res.status(403).json({ success: false });
    }
    
    const keyList = [];
    for (const [key, data] of licenses) {
        keyList.push({
            key: key,
            hwid: data.hwid,
            expires: data.expires,
            bound: data.hwid !== null
        });
    }
    
    res.json({ success: true, keys: keyList });
});

app.post('/api/admin/delete-key', (req, res) => {
    const { adminKey, licenseKey } = req.body;
    
    if (adminKey !== 'SUPER_SECRET_ADMIN_KEY') {
        return res.status(403).json({ success: false });
    }
    
    if (licenses.has(licenseKey)) {
        licenses.delete(licenseKey);
        saveKeys();
        console.log(`[ADMIN] Key deleted: ${licenseKey}`);
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'key_not_found' });
    }
});

// === START ===
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('   RaycityIN Auth Server');
    console.log('========================================');
    console.log(`Server running on port ${PORT}`);
    console.log(`Keys file: ${path.resolve(KEYS_FILE)}`);
    console.log(`Loaded keys: ${licenses.size}`);
    console.log('');
});
