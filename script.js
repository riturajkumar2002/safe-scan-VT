// This helper function already exists in your code
const getElement = id => document.getElementById(id);

// --- NEW VISITOR COUNTER FUNCTION ---
function updateVisitorCount() {
    const apiEndpoint = '/api/counter';

    fetch(apiEndpoint)
        .then(response => {
            if (!response.ok) {
                console.error('Visitor counter API response was not ok.');
                return { count: 'N/A' };
            }
            return response.json();
        })
        .then(data => {
            const countElement = getElement('visitor-count');
            if (countElement) {
                countElement.textContent = data.count;
            }
        })
        .catch(error => {
            console.error('Error fetching visitor count:', error);
            const countElement = getElement('visitor-count');
            if (countElement) {
                countElement.textContent = 'N/A';
            }
        });
}

// --- CORRECTED AND IMPROVED FEEDBACK FUNCTION ---
// Moved this function outside the 'load' event listener for better structure.
async function loadFeedbackList() {
    const feedbackList = getElement("feedbackList");
    try {
        const response = await fetch("https://safe-scan-vt.onrender.com/feedback");
        if (!response.ok) {
            throw new Error(`Failed to fetch feedback list (Status: ${response.status})`);
        }
        const data = await response.json();

        // --- IMPORTANT: DEBUGGING STEP ---
        // This will show you the exact structure of what your API is sending.
        console.log("Feedback data from API:", data);

        // --- ROBUST DATA HANDLING ---
        // Check if the data is an array itself, or if it has a property that is an array.
        const feedbacks = Array.isArray(data) ? data : data.feedbacks || data.data || [];

        feedbackList.innerHTML = ""; // Clear the list before adding new items

        if (feedbacks.length > 0) {
            feedbacks.forEach((item) => {
                const li = document.createElement("li");
                // If 'item' is an object with a 'text' property, use item.text. Adjust as needed.
                li.textContent = typeof item === 'object' ? item.text : item;
                feedbackList.appendChild(li);
            });
        } else {
            feedbackList.innerHTML = "<li>No feedback has been submitted yet.</li>";
        }
    } catch (error) {
        console.error("Error loading feedback:", error);
        feedbackList.innerHTML = `<li>Error: Could not load feedback. ${error.message}</li>`;
    }
}


const updateResult = (content, display = true) => {
    const result = getElement('result');
    result.style.display = display ? 'block' : 'none';
    result.innerHTML = content;
};

const showLoading = message => updateResult(
    '<div class="loading">' +
        '<p>' + message + '</p>' +
        '<div class="spinner"></div>' +
    '</div>'
);

const showError = message => updateResult('<p class="error">' + message + '</p>');

async function scanURL() {
    const urlInput = getElement("urlInput");
    const url = urlInput.value.trim();
    if (!url) {
        showError("Please enter a URL");
        return;
    }
    try {
        new URL(url);
    } catch {
        showError("Please enter a valid URL, e.g., https://example.com");
        return;
    }
    try {
        showLoading("Submitting URL for scanning...");
        const response = await fetch("https://safe-scan-vt.onrender.com/scan-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url })
        });
        if (!response.ok) throw new Error("Failed to submit URL");
        const result = await response.json();
        await new Promise(resolve => setTimeout(resolve, 3000));
        showLoading("Getting scan results...");
        await pollAnalysisResults(result.data.id);
    } catch (error) {
        showError("Error: " + error.message);
    }
}

async function scanFile() {
    const fileInput = getElement('fileInput');
    const file = fileInput.files[0];
    if (!file) {
        showError("Please select a file!");
        return;
    }
    if (file.size > 32 * 1024 * 1024) {
        showError("File size exceeds 32MB limit.");
        return;
    }
    try {
        showLoading("Uploading file...");
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("https://safe-scan-vt.onrender.com/scan-file", {
            method: "POST",
            body: formData
        });
        if (!response.ok) throw new Error("Failed to upload file");
        const result = await response.json();
        await new Promise(resolve => setTimeout(resolve, 3000));
        showLoading("Getting scan results...");
        await pollAnalysisResults(result.data.id, file.name);
    } catch (error) {
        showError("Error: " + error.message);
    }
}

async function pollAnalysisResults(analysisId, fileName = '') {
    const maxAttempts = 20;
    let attempts = 0;
    let interval = 2000;
    while (attempts < maxAttempts) {
        try {
            showLoading(`Analyzing ${fileName}... (${Math.round(((maxAttempts - attempts) * interval) / 1000)}s remaining)`);
            const response = await fetch(`https://safe-scan-vt.onrender.com/analysis/${analysisId}`);
            if (!response.ok) throw new Error("Failed to get analysis results");
            const report = await response.json();
            const status = report.data?.attributes?.status;
            if (status === "completed") {
                showFormattedResult(report);
                return;
            }
            if (status === "failed") throw new Error("Analysis failed");
            if (++attempts >= maxAttempts) throw new Error("Analysis timed out - please try again!");
            interval = Math.min(interval * 1.5, 8000);
            await new Promise(resolve => setTimeout(resolve, interval));
        } catch (error) {
            showError("Error: " + error.message);
            return;
        }
    }
}

function showFormattedResult(data) {
    if (!data?.data?.attributes?.stats) {
        showError("Invalid response format!");
        return;
    }
    const stats = data.data.attributes.stats;
    const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
    if (!total) {
        showError("No analysis results available!");
        return;
    }
    const getPercent = (val) => ((val / total) * 100).toFixed(1);
    const categories = {
        malicious: { color: "malicious", label: "Malicious" },
        suspicious: { color: "suspicious", label: "Suspicious" },
        harmless: { color: "safe", label: "Clean" },
        undetected: { color: "undetected", label: "Undetected" },
    };
    const percents = Object.fromEntries(Object.keys(categories).map(key => [key, getPercent(stats[key] || 0)]));
    const verdict = stats.malicious > 0 ? "Malicious" : stats.suspicious > 0 ? "Suspicious" : "Safe";
    const verdictClass = stats.malicious > 0 ? "malicious" : stats.suspicious > 0 ? "suspicious" : "safe";

    let html = `<h3>Scan Report</h3><div class="scan-stats"><p><strong>Verdict: </strong> <span class="${verdictClass}">${verdict}</span></p><div class="progress-section"><div class="progress-label"><span>Detection Results</span><span class="progress-percent">${percents.malicious}% Detection Rate</span></div><div class="progress-stacked">${Object.keys(categories).map(key => `<div class="progress-bar ${categories[key].color}" style="width: ${percents[key]}%" title="${categories[key].label}: ${stats[key] || 0} (${percents[key]}%)"></div>`).join('')}</div><div class="progress-legend">${Object.keys(categories).map(key => `<div class="legend-item"><span class="legend-color ${categories[key].color}"></span><span>${categories[key].label} (${percents[key]}%)</span></div>`).join('')}</div></div><div class="detection-details">${Object.keys(categories).map(key => `<div class="detail-item ${categories[key].color}"><span class="detail-label">${categories[key].label}</span><span class="detail-value">${stats[key] || 0}</span><span class="detail-percent">${percents[key]}%<span></div>`).join('')}</div></div><button onclick="showFullReport(this.getAttribute('data-report'))" data-report='${JSON.stringify(data)}'> View Full Report</button>`;
    updateResult(html);
}

function showFullReport(reportData) {
    const data = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;
    const modal = getElement('FullReportModel');
    const results = data.data?.attributes?.results;
    let html = '<h3>Full Report Details</h3>';
    if (results) {
        html += `<table><tr><th>Engine</th><th>Result</th></tr>${Object.entries(results).map(([engine, result]) => {
            const categoryClass = result.category === "malicious" ? "malicious" : result.category === "suspicious" ? "suspicious" : "safe";
            return `<tr><td>${engine}</td><td class="${categoryClass}">${result.category}</td></tr>`;
        }).join('')}</table>`;
    } else {
        html += '<p>No detailed results available!</p>';
    }
    getElement("FullReportContent").innerHTML = html;
    modal.style.display = "block";
}

const closeModal = () => getElement("FullReportModel").style.display = "none";

window.addEventListener("load", () => {
    updateVisitorCount();
    loadFeedbackList(); // Load feedback when the page loads

    window.addEventListener("click", (e) => {
        if (e.target === getElement("FullReportModel")) closeModal();
    });

    getElement("submitFeedback").addEventListener("click", async () => {
        const feedbackInput = getElement("feedbackInput");
        const feedbackMessage = getElement("feedbackMessage");
        const feedback = feedbackInput.value.trim();

        if (!feedback) {
            feedbackMessage.textContent = "Please enter your feedback before submitting.";
            feedbackMessage.style.color = "var(--danger)";
            feedbackMessage.style.display = "block";
            return;
        }

        try {
            const response = await fetch("https://safe-scan-vt.onrender.com/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ feedback }),
            });
            if (!response.ok) throw new Error("Failed to submit feedback");
            
            feedbackMessage.textContent = "Thank you for your feedback!";
            feedbackMessage.style.color = "var(--success)";
            feedbackInput.value = "";
            loadFeedbackList(); // Reload the list to show the new feedback
        } catch (error) {
            feedbackMessage.textContent = "Error submitting feedback. Please try again later.";
            feedbackMessage.style.color = "var(--danger)";
        } finally {
            feedbackMessage.style.display = "block";
        }
    });
});
