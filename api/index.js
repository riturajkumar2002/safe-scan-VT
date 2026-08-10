const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const serverless = require('serverless-http');
require('dotenv').config();

const app = express();

// Use env var only; do NOT hardcode keys here
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin123';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminpass123';

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join('/tmp', 'safe-scan-data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.txt');
const VISITOR_COUNT_FILE = path.join(DATA_DIR, 'visitor-count.json');

function loadVisitorCount() {
    try {
        if (fs.existsSync(VISITOR_COUNT_FILE)) {
            const data = JSON.parse(fs.readFileSync(VISITOR_COUNT_FILE, 'utf8'));
            return { count: data.count || 0, sessions: data.sessions || {} };
        }
    } catch (error) {
        console.error('Error loading visitor count:', error);
    }
    return { count: 0, sessions: {} };
}

function saveVisitorCount(data) {
    try { fs.writeFileSync(VISITOR_COUNT_FILE, JSON.stringify(data, null, 2)); }
    catch (error) { console.error('Error saving visitor count:', error); }
}

function generateSessionId(req) {
    const ip = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const sessionKey = `${ip}-${userAgent}`;
    return require('crypto').createHash('md5').update(sessionKey).digest('hex');
}

function isAdmin(req) {
    const adminToken = req.headers['x-admin-token'];
    const adminPassword = req.headers['x-admin-password'];
    return adminToken === ADMIN_TOKEN && adminPassword === ADMIN_PASSWORD;
}

app.post('/feedback', (req, res) => {
    const { feedback } = req.body;
    if (typeof feedback !== 'string' || feedback.trim().length === 0) return res.status(400).json({ error: 'Feedback is required' });
    const feedbackEntry = `${new Date().toISOString()} - ${feedback.replace(/\r?\n/g, ' ')}\n`;
    fs.appendFile(FEEDBACK_FILE, feedbackEntry, err => {
        if (err) { console.error('Failed to save feedback:', err); return res.status(500).json({ error: 'Failed to save feedback' }); }
        res.json({ message: 'Feedback received' });
    });
});

app.get('/feedback', (req, res) => {
    fs.readFile(FEEDBACK_FILE, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') return res.json({ feedbacks: [], isAdmin: false });
            console.error('Failed to read feedback:', err); return res.status(500).json({ error: 'Failed to read feedback' });
        }
        const lines = data.trim().split('\n').filter(Boolean);
        if (isAdmin(req)) {
            const feedbacks = lines.reverse().map((line, index) => {
                const idx = line.indexOf(' - ');
                return { id: lines.length - index - 1, timestamp: idx !== -1 ? line.substring(0, idx) : '', text: idx !== -1 ? line.substring(idx + 3) : line };
            });
            res.json({ feedbacks, isAdmin: true });
        } else {
            const feedbacks = lines.reverse().map(line => { const idx = line.indexOf(' - '); return idx !== -1 ? line.substring(idx + 3) : line; });
            res.json({ feedbacks, isAdmin: false });
        }
    });
});

app.delete('/feedback/:id', (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
    const lineNumber = parseInt(req.params.id);
    if (isNaN(lineNumber) || lineNumber < 0) return res.status(400).json({ error: 'Invalid feedback ID' });
    fs.readFile(FEEDBACK_FILE, 'utf8', (err, data) => {
        if (err) { if (err.code === 'ENOENT') return res.status(404).json({ error: 'No feedback found' }); console.error('Failed to read feedback:', err); return res.status(500).json({ error: 'Failed to read feedback' }); }
        const lines = data.trim().split('\n').filter(Boolean);
        if (lineNumber >= lines.length) return res.status(404).json({ error: 'Feedback not found' });
        lines.splice(lineNumber, 1);
        fs.writeFile(FEEDBACK_FILE, lines.join('\n') + '\n', err => { if (err) { console.error('Failed to delete feedback:', err); return res.status(500).json({ error: 'Failed to delete feedback' }); } res.json({ message: 'Feedback deleted successfully' }); });
    });
});

// VirusTotal proxy endpoints
app.post('/scan-url', async (req, res) => {
    const { url } = req.body; if (!url) return res.status(400).json({ error: 'URL is required' });
    if (!VIRUSTOTAL_API_KEY) return res.status(500).json({ error: 'Server missing VIRUSTOTAL_API_KEY' });
    try {
        const response = await axios.post('https://www.virustotal.com/api/v3/urls', new URLSearchParams({ url: url }).toString(), { headers: { 'x-apikey': VIRUSTOTAL_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' } });
        res.json(response.data);
    } catch (error) { console.error('Error from VirusTotal API:', error.response?.data || error.message); res.status(500).json({ error: 'Failed to scan URL', details: error.response?.data || error.message }); }
});

app.get('/analysis/:id', async (req, res) => {
    const analysisId = req.params.id; if (!analysisId) return res.status(400).json({ error: 'Analysis ID is required' });
    if (!VIRUSTOTAL_API_KEY) return res.status(500).json({ error: 'Server missing VIRUSTOTAL_API_KEY' });
    try { const response = await axios.get(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, { headers: { 'x-apikey': VIRUSTOTAL_API_KEY } }); res.json(response.data); }
    catch (error) { console.error('Error fetching analysis results:', error.response?.data || error.message); res.status(500).json({ error: 'Failed to fetch analysis results', details: error.response?.data || error.message }); }
});

const upload = multer();
app.post('/scan-file', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    if (!VIRUSTOTAL_API_KEY) return res.status(500).json({ error: 'Server missing VIRUSTOTAL_API_KEY' });
    try {
        const formData = new FormData();
        formData.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype, knownLength: req.file.size });
        const response = await axios.post('https://www.virustotal.com/api/v3/files', formData, { headers: { ...formData.getHeaders(), 'x-apikey': VIRUSTOTAL_API_KEY }, maxContentLength: Infinity, maxBodyLength: Infinity });
        res.json(response.data);
    } catch (error) { console.error('Error uploading file to VirusTotal:', error.response?.data || error.message); res.status(500).json({ error: 'Failed to upload file', details: error.response?.data || error.message }); }
});

app.get('/api/counter', (req, res) => {
    try {
        const visitorData = loadVisitorCount();
        const sessionId = generateSessionId(req);
        const isNewVisitor = !visitorData.sessions[sessionId];
        if (isNewVisitor) { visitorData.count++; visitorData.sessions[sessionId] = Date.now(); saveVisitorCount(visitorData); }
        res.json({ count: visitorData.count });
    } catch (error) { console.error('Error updating visitor count:', error); res.status(500).json({ count: 'Error' }); }
});

app.use((err, req, res, next) => { console.error('Unhandled error:', err); res.status(500).json({ error: 'Internal Server Error', details: err.message }); });

module.exports = serverless(app);
