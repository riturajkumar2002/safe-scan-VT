const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- IMPORTANT: Environment Variables ---
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY;
const MONGO_URI = process.env.MONGO_URI;

// --- Middleware ---
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() }); // Store file in memory

// --- MongoDB Connection & Visitor Counter Model ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

// --- API Routes ---

// Visitor Counter Route
app.get('/api/counter', async (req, res) => {
    try {
        const visitorCounter = await Counter.findOneAndUpdate(
            { name: 'visitorCount' },
            { $inc: { count: 1 } },
            { new: true, upsert: true } // new: return modified doc; upsert: create if not found
        );
        res.json({ count: visitorCounter.count });
    } catch (error) {
        console.error('Counter error:', error);
        res.status(500).json({ error: 'Could not process visitor count' });
    }
});

// URL Scan Route
app.post('/scan-url', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const response = await axios.post('https://www.virustotal.com/api/v3/urls',
            new URLSearchParams({ url }).toString(),
            { headers: { 'x-apikey': VIRUSTOTAL_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to scan URL', details: error.response?.data || error.message });
    }
});

// File Scan Route
app.post('/scan-file', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    try {
        const formData = new FormData();
        formData.append('file', req.file.buffer, req.file.originalname);

        const response = await axios.post('https://www.virustotal.com/api/v3/files', formData, {
            headers: { ...formData.getHeaders(), 'x-apikey': VIRUSTOTAL_API_KEY },
            maxBodyLength: Infinity
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to upload file', details: error.response?.data || error.message });
    }
});

// Analysis Results Route
app.get('/analysis/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const response = await axios.get(`https://www.virustotal.com/api/v3/analyses/${id}`, {
            headers: { 'x-apikey': VIRUSTOTAL_API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analysis', details: error.response?.data || error.message });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
