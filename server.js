const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// === Load VirusTotal API key from .env ===
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
if (!VIRUSTOTAL_API_KEY) {
    console.error("❌ Missing VirusTotal API key in .env file!");
    process.exit(1);
}

app.use(cors());
app.use(express.json());

// === Serve static frontend from /public ===
app.use(express.static(path.join(__dirname, 'public')));

// === In-memory visitor count ===
let visitCount = 0;

app.use((req, res, next) => {
    if (!req.path.startsWith('/visit-count')) {
        visitCount++;
        console.log(`➡️ ${req.path} | Visitors: ${visitCount}`);
    }
    next();
});

app.get('/visit-count', (req, res) => {
    res.json({ count: visitCount });
});

// === Feedback: POST ===
app.post('/feedback', (req, res) => {
    const { feedback } = req.body;
    if (!feedback) return res.status(400).json({ error: 'Feedback is required' });

    const entry = `${new Date().toISOString()} - ${feedback}\n`;
    const filePath = path.join(__dirname, 'feedback.txt');

    fs.appendFile(filePath, entry, err => {
        if (err) return res.status(500).json({ error: 'Failed to save feedback' });
        res.json({ message: 'Feedback received' });
    });
});

// === Feedback: GET ===
app.get('/feedback', (req, res) => {
    const filePath = path.join(__dirname, 'feedback.txt');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read feedback' });

        const feedbacks = data.trim().split('\n').filter(Boolean);
        res.json({ feedbacks });
    });
});

// === Scan URL ===
app.post('/scan-url', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const response = await axios.post(
            'https://www.virustotal.com/api/v3/urls',
            new URLSearchParams({ url }).toString(),
            {
                headers: {
                    'x-apikey': VIRUSTOTAL_API_KEY,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error('🔴 URL Scan Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to scan URL' });
    }
});

// === Get Analysis Results ===
app.get('/analysis/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Analysis ID is required' });

    try {
        const response = await axios.get(
            `https://www.virustotal.com/api/v3/analyses/${id}`,
            {
                headers: { 'x-apikey': VIRUSTOTAL_API_KEY }
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error('🔴 Analysis Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch analysis results' });
    }
});

// === Scan File ===
const upload = multer();

app.post('/scan-file', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    try {
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
            knownLength: req.file.size
        });

        const response = await axios.post(
            'https://www.virustotal.com/api/v3/files',
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'x-apikey': VIRUSTOTAL_API_KEY
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error('🔴 File Upload Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// === Global Error Handler ===
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// === Start Server ===
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
