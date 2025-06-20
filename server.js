const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
    console.log(`Feedback server running on http://localhost:${PORT}`);
});
