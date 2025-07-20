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

// Your actual VirusTotal API key (keep this secret, move to .env for production)
const VIRUSTOTAL_API_KEY = '482c8d34d486b60b7bd794f82b2cba7b523c532c2583b37732a5053f0a3d9513'; // <-- replace with your real key!

app.use(cors());
app.use(express.json());

const FEEDBACK_FILE = path.join(__dirname, 'feedback.txt');

// Serve static files
app.use(express.static(__dirname));

// === Feedback Endpoints ===

// Save feedback
app.post('/feedback', (req, res) => {
    const { feedback } = req.body;
    if (typeof feedback !== 'string' || feedback.trim().length === 0) {
        return res.status(400).json({ error: 'Feedback is required' });
    }
    const feedbackEntry = `${new Date().toISOString()} - ${feedback.replace(/\r?\n/g, ' ')}\n`;
    fs.appendFile(FEEDBACK_FILE, feedbackEntry, err => {
        if (err) {
            console.error('Failed to save feedback:', err);
            return res.status(500).json({ error: 'Failed to save feedback' });
        }
        res.json({ message: 'Feedback received' });
    });
});

// List feedback (just messages, not timestamps)
app.get('/feedback', (req, res) => {
    fs.readFile(FEEDBACK_FILE, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.json({ feedbacks: [] }); // No feedback yet
            }
            console.error('Failed to read feedback:', err);
            return res.status(500).json({ error: 'Failed to read feedback' });
        }
        const lines = data.trim().split('\n').filter(Boolean);
        const feedbacks = lines
            .reverse()
            .map(line => {
                const idx = line.indexOf(' - ');
                return idx !== -1 ? line.substring(idx + 3) : line;
            });
        res.json({ feedbacks });
    });
});

// === VirusTotal URL Scan Endpoint ===
app.post('/scan-url', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const response = await axios.post(
            'https://www.virustotal.com/api/v3/urls',
            new URLSearchParams({ url: url }).toString(),
            {
                headers: {
                    'x-apikey': VIRUSTOTAL_API_KEY,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error('Error from VirusTotal API:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to scan URL', details: error.response?.data || error.message });
    }
});

// === Get Analysis By ID ===
app.get('/analysis/:id', async (req, res) => {
    const analysisId = req.params.id;
    if (!analysisId) return res.status(400).json({ error: 'Analysis ID is required' });
    try {
        const response = await axios.get(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
            headers: { 'x-apikey': VIRUSTOTAL_API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching analysis results:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch analysis results', details: error.response?.data || error.message });
    }
});

// === VirusTotal File Scan ===
const upload = multer();
app.post('/scan-file', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'File is required' });
    }
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
        console.error('Error uploading file to VirusTotal:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to upload file', details: error.response?.data || error.message });
    }
});

// === Visitor Counter (simple example, in-memory, reset on restart) ===
let visitorCount = 0;
app.get('/api/counter', (req, res) => {
    // Optionally use something persistent for production!
    visitorCount++;
    res.json({ count: visitorCount });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://https://safe-scan-vt.onrender.com:${PORT}/`);
});
