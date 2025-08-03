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

// ======================
// Set THIS to your real VirusTotal API key, or use .env file
// ======================
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY || '482c8d34d486b60b7bd794f82b2cba7b523c532c2583b37732a5053f0a3d9513';
// ======================

app.use(cors());
app.use(express.json());
const FEEDBACK_FILE = path.join(__dirname, 'feedback.txt');
const VISITOR_COUNT_FILE = path.join(__dirname, 'visitor-count.json');

// Serve static files (index.html, etc)
app.use(express.static(__dirname));

// ----- Visitor Counter Functions -----
function loadVisitorCount() {
    try {
        if (fs.existsSync(VISITOR_COUNT_FILE)) {
            const data = JSON.parse(fs.readFileSync(VISITOR_COUNT_FILE, 'utf8'));
            return {
                count: data.count || 0,
                sessions: data.sessions || {}
            };
        }
    } catch (error) {
        console.error('Error loading visitor count:', error);
    }
    return { count: 0, sessions: {} };
}

function saveVisitorCount(data) {
    try {
        fs.writeFileSync(VISITOR_COUNT_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving visitor count:', error);
    }
}

function generateSessionId(req) {
    // Create a unique session ID based on IP and user agent
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const sessionKey = `${ip}-${userAgent}`;
    return require('crypto').createHash('md5').update(sessionKey).digest('hex');
}

// ----- Feedback Endpoints -----

// Admin authentication middleware
function isAdmin(req) {
    // Simple admin check - you can modify this to use a more secure method
    const adminToken = req.headers['x-admin-token'];
    const adminPassword = req.headers['x-admin-password'];
    
    // Set your admin credentials here - CHANGE THESE TO YOUR OWN SECURE VALUES
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin123';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminpass123';
    
    return adminToken === ADMIN_TOKEN && adminPassword === ADMIN_PASSWORD;
}

// POST Feedback
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

// GET Feedback (with timestamps for admin, without for regular users)
app.get('/feedback', (req, res) => {
    fs.readFile(FEEDBACK_FILE, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') return res.json({ feedbacks: [], isAdmin: false });
            console.error('Failed to read feedback:', err);
            return res.status(500).json({ error: 'Failed to read feedback' });
        }
        const lines = data.trim().split('\n').filter(Boolean);
        const isAdminUser = isAdmin(req);
        
        if (isAdminUser) {
            // For admin: return with timestamps and line numbers
            const feedbacks = lines.reverse().map((line, index) => {
                const idx = line.indexOf(' - ');
                return {
                    id: lines.length - index - 1, // Line number for deletion
                    timestamp: idx !== -1 ? line.substring(0, idx) : '',
                    text: idx !== -1 ? line.substring(idx + 3) : line
                };
            });
            res.json({ feedbacks, isAdmin: true });
        } else {
            // For regular users: return just the feedback text
            const feedbacks = lines.reverse().map(line => {
                const idx = line.indexOf(' - ');
                return idx !== -1 ? line.substring(idx + 3) : line;
            });
            res.json({ feedbacks, isAdmin: false });
        }
    });
});

// DELETE Feedback (admin only)
app.delete('/feedback/:id', (req, res) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const lineNumber = parseInt(req.params.id);
    if (isNaN(lineNumber) || lineNumber < 0) {
        return res.status(400).json({ error: 'Invalid feedback ID' });
    }
    
    fs.readFile(FEEDBACK_FILE, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') return res.status(404).json({ error: 'No feedback found' });
            console.error('Failed to read feedback:', err);
            return res.status(500).json({ error: 'Failed to read feedback' });
        }
        
        const lines = data.trim().split('\n').filter(Boolean);
        if (lineNumber >= lines.length) {
            return res.status(404).json({ error: 'Feedback not found' });
        }
        
        // Remove the specified line
        lines.splice(lineNumber, 1);
        
        // Write back to file
        fs.writeFile(FEEDBACK_FILE, lines.join('\n') + '\n', err => {
            if (err) {
                console.error('Failed to delete feedback:', err);
                return res.status(500).json({ error: 'Failed to delete feedback' });
            }
            res.json({ message: 'Feedback deleted successfully' });
        });
    });
});

// ----- VirusTotal Endpoints -----

// Scan URL
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

// Get results
app.get('/analysis/:id', async (req, res) => {
    const analysisId = req.params.id;
    if (!analysisId) return res.status(400).json({ error: 'Analysis ID is required' });
    try {
        const response = await axios.get(
            `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
            {
                headers: { 'x-apikey': VIRUSTOTAL_API_KEY }
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching analysis results:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch analysis results', details: error.response?.data || error.message });
    }
});

// Scan File
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
        console.error('Error uploading file to VirusTotal:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to upload file', details: error.response?.data || error.message });
    }
});

// ----- Updated Visitor Counter -----
app.get('/api/counter', (req, res) => {
    try {
        const visitorData = loadVisitorCount();
        const sessionId = generateSessionId(req);
        const now = Date.now();
        
        // Check if this is a new visitor (session not seen in last 24 hours)
        const lastVisit = visitorData.sessions[sessionId];
        const isNewVisitor = !lastVisit || (now - lastVisit) > (24 * 60 * 60 * 1000); // 24 hours
        
        if (isNewVisitor) {
            visitorData.count++;
            visitorData.sessions[sessionId] = now;
            saveVisitorCount(visitorData);
        }
        
        res.json({ count: visitorData.count });
    } catch (error) {
        console.error('Error updating visitor count:', error);
        res.status(500).json({ count: 'Error' });
    }
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Initialize visitor count file if it doesn't exist
function initializeVisitorCount() {
    if (!fs.existsSync(VISITOR_COUNT_FILE)) {
        const initialData = { count: 0, sessions: {} };
        saveVisitorCount(initialData);
        console.log('Visitor count file initialized');
    }
}

app.listen(PORT, () => {
    initializeVisitorCount();
    console.log(`Server running at http://https://safe-scan-vt.onrender.com:${PORT}/`);
    console.log(`Visitor counter: Persistent storage enabled`);
});
