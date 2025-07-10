const getElement = id => document.getElementById(id);

// Existing load event
window.addEventListener('load', () => {
    const modal = getElement('FullReportModel');

    // ✅ Attach scanURL to button
    getElement("scanURLBtn").addEventListener("click", scanURL);

    // ✅ Attach scanFile to button (replace inline onclick in HTML)
    getElement("scanFileBtn").addEventListener("click", scanFile);

    // Close modal when clicking outside
    window.addEventListener('click', e => {
        if (e.target === modal) closeModal();
    });

    // Feedback handling
    const submitBtn = getElement('submitFeedback');
    const feedbackInput = getElement('feedbackInput');
    const feedbackMessage = getElement('feedbackMessage');

    submitBtn.addEventListener('click', async () => {
        const feedback = feedbackInput.value.trim();
        if (!feedback) {
            feedbackMessage.style.display = 'block';
            feedbackMessage.style.color = 'var(--danger)';
            feedbackMessage.textContent = 'Please enter your feedback before submitting.';
            return;
        }
        try {
            const response = await fetch('https://safe-scan-vt.onrender.com/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ feedback })
            });
            if (!response.ok) {
                throw new Error('Failed to submit feedback');
            }
            feedbackMessage.style.display = 'block';
            feedbackMessage.style.color = 'var(--success)';
            feedbackMessage.textContent = 'Thank you for your feedback!';
            feedbackInput.value = '';
            loadFeedbackList();
        } catch (error) {
            feedbackMessage.style.display = 'block';
            feedbackMessage.style.color = 'var(--danger)';
            feedbackMessage.textContent = 'Error submitting feedback. Please try again later.';
        }
    });

    async function loadFeedbackList() {
        const feedbackList = getElement('feedbackList');
        try {
            const response = await fetch('https://safe-scan-vt.onrender.com/feedback');
            if (!response.ok) {
                throw new Error('Failed to fetch feedback list');
            }
            const data = await response.json();
            feedbackList.innerHTML = '';
            if (data.feedbacks && data.feedbacks.length > 0) {
                data.feedbacks.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = item;
                    feedbackList.appendChild(li);
                });
            }
        } catch (error) {
            console.error('Error loading feedback list:', error);
        }
    }
});
