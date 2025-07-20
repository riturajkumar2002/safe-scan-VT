const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
const app = express();
const PORT =  process.env.PORT || 3001;

// Replace this with your real VirusTotal API key
const VIRUSTOTAL_API_KEY = '482c8d34d486b60b7bd794f82b2cba7b523c532c2583b37732a5053f0a3d9513';

app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// === POST Feedback ===
app.post('/feedback', (req, res) => {
    const { feedback } = req.body;
    if (!feedback) {
        return res.status(400).json({ error: 'Feedback is required' });
    }
    const feedbackEntry = `${new Date().toISOString()} - ${feedback}\n`;
    const feedbackFile = path.join(__dirname, 'feedback.txt');
    fs.appendFile(feedbackFile, feedbackEntry, err => {
        if (err) {
            console.error('Failed to save feedback:', err);
            return res.status(500).json({ error: 'Failed to save feedback' });
        }
        console.log('Feedback saved:', feedback);
        res.json({ message: 'Feedback received' });
    });
});

// === GET Feedback ===
app.get('/feedback', (req, res) => {
    const feedbackFile = path.join(__dirname, 'feedback.txt');
    fs.readFile(feedbackFile, 'utf8', (err, data) => {
        if (err) {
            console.error('Failed to read feedback:', err);
            return res.status(500).json({ error: 'Failed to read feedback' });
        }
        const feedbacks = data.trim().split('\n').filter(line => line.length > 0);
        res.json({ feedbacks });
    });
});

// === POST URL to VirusTotal ===
app.post('/scan-url', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

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

        const scanData = response.data;
        res.json(scanData);
    } catch (error) {
        console.error('Error from VirusTotal API:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to scan URL', details: error.response?.data || error.message });
    }
});

// === GET Analysis Results from VirusTotal ===
app.get('/analysis/:id', async (req, res) => {
    const analysisId = req.params.id;
    if (!analysisId) {
        return res.status(400).json({ error: 'Analysis ID is required' });
    }

    try {
        const response = await axios.get(
            `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
            {
                headers: {
                    'x-apikey': VIRUSTOTAL_API_KEY
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching analysis results:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch analysis results', details: error.response?.data || error.message });
    }
});

// === POST File to VirusTotal ===
const multer = require('multer');
const FormData = require('form-data');
const upload = multer();

app.post('/scan-file', upload.single('file'), async (req, res) => {
    console.log('Received file upload request');
    if (!req.file) {
        console.error('No file received in request');
        return res.status(400).json({ error: 'File is required' });
    }
    console.log('File received:', req.file.originalname, req.file.mimetype, req.file.size);

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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// === Start Server ===
app.listen(PORT, () => {
    console.log(`Server running on https://safe-scan-vt.onrender.com/:${PORT}`);
});