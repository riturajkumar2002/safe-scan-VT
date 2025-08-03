// ------------- RANDOM COLOR THEME FEATURE -------------
const colorThemes = [
    {
        '--primary-color': '#0057b7',
        '--primary-color-hover': '#003f7f',
        '--success': '#2ecc40',
        '--danger': '#ee3d3d',
        '--background': '#e6f3ff',
        '--surface': '#ffffff',
        '--text': '#131b23',
        '--text-secondary': '#335571'
    },
    {
        '--primary-color': '#a259ff',
        '--primary-color-hover': '#6b00b6',
        '--success': '#00b894',
        '--danger': '#e17055',
        '--background': '#f5f0fa',
        '--surface': '#fff0fb',
        '--text': '#43305e',
        '--text-secondary': '#729198'
    },
    {
        '--primary-color': '#019267',
        '--primary-color-hover': '#025940',
        '--success': '#88e26f',
        '--danger': '#ed6a5a',
        '--background': '#e0f8f1',
        '--surface': '#ffffff',
        '--text': '#183a1d',
        '--text-secondary': '#28875c'
    },
    {
        '--primary-color': '#f7c873',
        '--primary-color-hover': '#d9a441',
        '--success': '#53ebbb',
        '--danger': '#fa5252',
        '--background': '#23272e',
        '--surface': '#323846',
        '--text': '#f0f6f5',
        '--text-secondary': '#aaa'
    }
    // Add more if you wish!
];

function applyRandomTheme() {
    const theme = colorThemes[Math.floor(Math.random() * colorThemes.length)];
    for (const [k, v] of Object.entries(theme)) {
        document.documentElement.style.setProperty(k, v);
    }
}
// Apply it ASAP on DOMContentLoaded
window.addEventListener('DOMContentLoaded', applyRandomTheme);
// ---------------------------------------------------------

const getElement = id => document.getElementById(id);

function updateVisitorCount() {
    const countElement = getElement('visitor-count');
    if (!countElement) return;
    
    // Show loading state
    countElement.textContent = 'Loading...';
    
    fetch('/api/counter')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch visitor count');
            }
            return response.json();
        })
        .then(data => {
            const currentCount = parseInt(countElement.textContent) || 0;
            const newCount = data.count;
            
            // Animate the count update if it changed
            if (newCount !== currentCount && currentCount > 0) {
                animateCountChange(currentCount, newCount, countElement);
            } else {
                countElement.textContent = newCount;
            }
        })
        .catch((error) => {
            console.error('Error updating visitor count:', error);
            countElement.textContent = 'N/A';
        });
}

function animateCountChange(from, to, element) {
    const duration = 1000; // 1 second animation
    const startTime = Date.now();
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentCount = Math.floor(from + (to - from) * easeOutQuart);
        
        element.textContent = currentCount;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = to;
        }
    }
    
    requestAnimationFrame(update);
}

const updateResult = (content, display = true) => {
    const result = getElement('result');
    result.style.display = display ? 'block' : 'none';
    result.innerHTML = content;
};

const showLoading = message => updateResult(
    `<div class="loading"><p>${message}</p><div class="spinner"></div></div>`
);

const showError = message => updateResult(`<p class="error">${message}</p>`);

async function scanURL() {
    const urlInput = getElement("urlInput");
    const url = urlInput.value.trim();
    if (!url) return showError("Please enter a URL");
    try {
        new URL(url);
    } catch {
        showError("Please enter a valid URL.");
        return;
    }
    try {
        showLoading("Submitting URL for scanning...");
        const response = await fetch("/scan-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });
        if (!response.ok) throw new Error("Failed to submit URL");
        const result = await response.json();
        await new Promise(r => setTimeout(r, 3000));
        showLoading("Getting scan results...");
        await pollAnalysisResults(result.data.id);
    } catch (error) {
        showError("Error: " + error.message);
    }
}

async function scanFile() {
    const fileInput = getElement('fileInput');
    const file = fileInput.files[0];
    if (!file) return showError("Please select a file!");
    if (file.size > 32 * 1024 * 1024) return showError("File size exceeds 32MB limit.");
    try {
        showLoading("Uploading file...");
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/scan-file", { method: "POST", body: formData });
        if (!response.ok) throw new Error("Failed to upload file");
        const result = await response.json();
        await new Promise(r => setTimeout(r, 3000));
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
            showLoading(`Analyzing ${fileName ? fileName : ''}... (${(((maxAttempts - attempts) * interval) / 1000).toFixed(0)}s remaining)`);
            const response = await fetch(`/analysis/${analysisId}`);
            if (!response.ok) throw new Error("Failed to get analysis results");
            const report = await response.json();
            const status = report.data?.attributes?.status;
            if (status === "completed") {
                showFormattedResult(report);
                break;
            }
            if (status === "failed") throw new Error("Analysis failed");
            if (++attempts >= maxAttempts) throw new Error("Analysis timed out - please try again!");
            interval = Math.min(interval * 1.5, 8000);
            await new Promise(resolve => setTimeout(resolve, interval));
        } catch (error) {
            showError("Error: " + error.message);
            break;
        }
    }
}

function showFormattedResult(data) {
    if (!data?.data?.attributes?.stats) return showError("Invalid response format!");
    const stats = data.data.attributes.stats;
    const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
    if (!total) {
        showError("No analysis results available!");
        return;
    }
    function getPercent(val) { return ((val / total) * 100).toFixed(1); }
    const categories = {
        malicious: { color: "malicious", label: "Malicious" },
        suspicious: { color: "suspicious", label: "Suspicious" },
        harmless: { color: "safe", label: "Clean" },
        undetected: { color: "undetected", label: "Undetected" },
    };
    const percents = {};
    for (const key in categories) percents[key] = getPercent(stats[key] || 0);
    const verdict =
        stats.malicious > 0 ? "Malicious" :
        stats.suspicious > 0 ? "Suspicious" : "Safe";
    const verdictClass =
        stats.malicious > 0 ? "malicious" :
        stats.suspicious > 0 ? "suspicious" : "safe";
    let html =
        '<h3>Scan Report</h3><div class="scan-stats">' +
        `<p><strong>Verdict: </strong> <span class="${verdictClass}">${verdict}</span></p>` +
        '<div class="progress-section"><div class="progress-label">' +
        '<span>Detection Results</span>' +
        `<span class="progress-percent">${percents.malicious}% Detection Rate</span></div>` +
        '<div class="progress-stacked">';
    for (const key in categories) {
        html += `<div class="progress-bar ${categories[key].color}" style="width: ${percents[key]}%" title="${categories[key].label}: ${(stats[key] || 0)} (${percents[key]}%)"></div>`;
    }
    html += "</div><div class=\"progress-legend\">";
    for (const key in categories) {
        html += `<div class="legend-item"><span class="legend-color ${categories[key].color}"></span><span>${categories[key].label} (${percents[key]}%)</span></div>`;
    }
    html += "</div></div><div class=\"detection-details\">";
    for (const key in categories) {
        html += `<div class="detail-item ${categories[key].color}"><span class="detail-label">${categories[key].label}</span><span class="detail-value">${stats[key] || 0}</span><span class="detail-percent">${percents[key]}%</span></div>`;
    }
    html += `</div></div><button onclick="showFullReport(this.getAttribute('data-report'))" data-report='${JSON.stringify(data)}'> View Full Report</button>`;
    updateResult(html);
    setTimeout(() => {
        const progressStacked = getElement("result").querySelector(".progress-stacked");
        if (progressStacked) progressStacked.classList.add("animate");
    }, 1000);
}

function showFullReport(reportData) {
    const data = typeof reportData === "string" ? JSON.parse(reportData) : reportData;
    const modal = getElement("FullReportModel");
    const results = data.data?.attributes?.results;
    let html = "<h3>Full Report Details</h3>";
    if (results) {
        html += "<table><tr><th>Engine</th><th>Result</th></tr>";
        for (const engine in results) {
            const category = results[engine].category;
            const categoryClass =
                category === "malicious"
                    ? "malicious"
                    : category === "suspicious"
                    ? "suspicious"
                    : "safe";
            html += `<tr><td>${engine}</td><td class='${categoryClass}'>${category}</td></tr>`;
        }
        html += "</table>";
    } else {
        html += "<p>No detailed results available!</p>";
    }
    modal.style.display = "block";
    getElement("FullReportContent").innerHTML = html;
    modal.offsetHeight;
    modal.classList.add("show");
}

const closeModal = () => {
    const modal = getElement("FullReportModel");
    modal.classList.remove("show");
    setTimeout(() => {
        modal.style.display = "none";
    }, 300);
};

window.addEventListener("load", () => {
    updateVisitorCount();
    
    // Update visitor count every 30 seconds to keep it fresh
    setInterval(updateVisitorCount, 30000);

    const modal = getElement("FullReportModel");
    window.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    const submitBtn = getElement("submitFeedback");
    const feedbackInput = getElement("feedbackInput");
    const feedbackMessage = getElement("feedbackMessage");

    submitBtn.addEventListener("click", async () => {
        const feedback = feedbackInput.value.trim();
        if (!feedback) {
            feedbackMessage.style.display = "block";
            feedbackMessage.style.color = "var(--danger)";
            feedbackMessage.textContent = "Please enter your feedback before submitting.";
            return;
        }
        try {
            submitBtn.disabled = true;
            const response = await fetch("/feedback", {
                method: "POST",
                headers: {"Content-Type": "application/json" },
                body: JSON.stringify({ feedback }),
            });
            if (!response.ok) throw new Error("Failed to submit feedback");
            feedbackMessage.style.display = "block";
            feedbackMessage.style.color = "var(--success)";
            feedbackMessage.textContent = "Thank you for your feedback!";
            feedbackInput.value = "";
            await loadFeedbackList();
        } catch (error) {
            feedbackMessage.style.display = "block";
            feedbackMessage.style.color = "var(--danger)";
            feedbackMessage.textContent = "Error submitting feedback. Please try again later.";
        } finally {
            submitBtn.disabled = false;
            setTimeout(() => {
                feedbackMessage.style.display = "none";
            }, 3000);
        }
    });

    // Admin credentials - CHANGE THESE TO YOUR OWN SECURE VALUES
    const ADMIN_CREDENTIALS = {
        token: 'admin123',
        password: 'adminpass123'
    };

    // Check if user is admin (you can modify this logic)
    function isAdminUser() {
        // For now, we'll use a simple localStorage check
        // In a real application, you'd want proper authentication
        return localStorage.getItem('isAdmin') === 'true';
    }

    // Function to login as admin
    function loginAsAdmin() {
        const token = prompt('Enter admin token:');
        const password = prompt('Enter admin password:');
        
        if (token === ADMIN_CREDENTIALS.token && password === ADMIN_CREDENTIALS.password) {
            localStorage.setItem('isAdmin', 'true');
            alert('Admin login successful!');
            loadFeedbackList();
        } else {
            alert('Invalid credentials!');
        }
    }

    // Function to logout as admin
    function logoutAdmin() {
        localStorage.removeItem('isAdmin');
        alert('Logged out as admin');
        loadFeedbackList();
    }

    // Function to delete feedback
    async function deleteFeedback(feedbackId) {
        if (!confirm('Are you sure you want to delete this feedback?')) {
            return;
        }
        
        try {
            const response = await fetch(`/feedback/${feedbackId}`, {
                method: 'DELETE',
                headers: {
                    'x-admin-token': ADMIN_CREDENTIALS.token,
                    'x-admin-password': ADMIN_CREDENTIALS.password
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete feedback');
            }
            
            alert('Feedback deleted successfully!');
            loadFeedbackList();
        } catch (error) {
            alert('Error deleting feedback: ' + error.message);
        }
    }

    // Make admin functions globally available
    window.loginAsAdmin = loginAsAdmin;
    window.logoutAdmin = logoutAdmin;
    window.deleteFeedback = deleteFeedback;

    async function loadFeedbackList() {
        const feedbackList = getElement("feedbackList");
        const isAdmin = isAdminUser();
        
        try {
            const headers = {};
            if (isAdmin) {
                headers['x-admin-token'] = ADMIN_CREDENTIALS.token;
                headers['x-admin-password'] = ADMIN_CREDENTIALS.password;
            }
            
            const response = await fetch("/feedback", { headers });
            if (!response.ok) throw new Error();
            const data = await response.json();
            
            feedbackList.innerHTML = "";
            
            // Add admin controls if admin is logged in
            if (isAdmin) {
                const adminControls = document.createElement("div");
                adminControls.className = "admin-controls";
                adminControls.innerHTML = `
                    <div style="margin-bottom: 15px; padding: 10px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">
                        <strong>🔐 Admin Mode Active</strong>
                        <button onclick="logoutAdmin()" style="margin-left: 10px; padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Logout</button>
                    </div>
                `;
                feedbackList.appendChild(adminControls);
            } else {
                const loginButton = document.createElement("div");
                loginButton.style.marginBottom = "15px";
                loginButton.innerHTML = `
                    <button onclick="loginAsAdmin()" class="admin-login-btn">
                        🔐 Admin Login
                    </button>
                `;
                feedbackList.appendChild(loginButton);
            }
            
            if (data.feedbacks && data.feedbacks.length > 0) {
                if (isAdmin && data.isAdmin) {
                    // Admin view with delete buttons
                    data.feedbacks.forEach(item => {
                        const li = document.createElement("li");
                        li.className = "feedback-item";
                        
                        const feedbackContent = document.createElement("div");
                        feedbackContent.className = "feedback-content";
                        feedbackContent.innerHTML = `
                            <div class="feedback-timestamp">
                                ${item.timestamp ? new Date(item.timestamp).toLocaleString() : 'No timestamp'}
                            </div>
                            <div>${item.text}</div>
                        `;
                        
                        const deleteButton = document.createElement("button");
                        deleteButton.textContent = "🗑️ Delete";
                        deleteButton.className = "delete-btn";
                        deleteButton.onclick = () => deleteFeedback(item.id);
                        
                        li.appendChild(feedbackContent);
                        li.appendChild(deleteButton);
                        feedbackList.appendChild(li);
                    });
                } else {
                    // Regular user view
                    data.feedbacks.forEach(item => {
                        const li = document.createElement("li");
                        li.textContent = typeof item === 'string' ? item : item.text;
                        feedbackList.appendChild(li);
                    });
                }
            } else {
                feedbackList.innerHTML += "<li>No feedback available.</li>";
            }
        } catch {
            feedbackList.innerHTML += "<li>Error loading feedback list.</li>";
        }
    }

    loadFeedbackList();
});
