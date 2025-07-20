// This helper function already exists in your code
const getElement = id => document.getElementById(id);

// --- NEW VISITOR COUNTER FUNCTION ---
// This function fetches the count from your serverless API
function updateVisitorCount() {
    // The endpoint for the serverless function. 
    // This relative path '/api/counter' works when you deploy on Vercel/Netlify.
    // If you host the API elsewhere, you'd use the full URL, e.g., 'https://your-api.com/api/counter'
    const apiEndpoint = '/api/counter';

    fetch(apiEndpoint)
        .then(response => {
            if (!response.ok) {
                // Don't throw an error for the counter, just log it.
                // This prevents it from breaking other parts of the site if the counter is down.
                console.error('Visitor counter API response was not ok.');
                return { count: 'N/A' }; // Return a default object
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
                // Display 'N/A' (Not Available) if the fetch fails
                countElement.textContent = 'N/A';
            }
        });
}
// --- END NEW VISITOR COUNTER FUNCTION ---


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
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: url })
        });

        if (!response.ok) {
            throw new Error("Failed to submit URL");
        }

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

        if (!response.ok) {
            throw new Error("Failed to upload file");
        }

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
            showLoading("Analyzing " + (fileName ? fileName : '') + "... (" + (((maxAttempts - attempts) * interval) / 1000).toFixed(0) + "s remaining)");
            const response = await fetch("https://safe-scan-vt.onrender.com/analysis/" + analysisId);

            if (!response.ok) {
                throw new Error("Failed to get analysis results");
            }

            const report = await response.json();
            const status = report.data && report.data.attributes && report.data.attributes.status;

            if (status === "completed") {
                showFormattedResult(report);
                break;
            }
            if (status === "failed") {
                throw new Error("Analysis failed");
            }
            if (++attempts >= maxAttempts) {
                throw new Error("Analysis timed out - please try again!");
            }
            interval = Math.min(interval * 1.5, 8000);
            await new Promise(resolve => setTimeout(resolve, interval));
        } catch (error) {
            showError("Error: " + error.message);
            break;
        }
    }
}

function showFormattedResult(data) {
    if (!data || !data.data || !data.data.attributes || !data.data.attributes.stats) {
        showError("Invalid response format!");
        return;
    }
    const stats = data.data.attributes.stats;
    const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
    if (!total) {
        showError("No analysis results available!");
        return;
    }

    function getPercent(val) {
        return ((val / total) * 100).toFixed(1);
    }

    const categories = {
        malicious: { color: "malicious", label: "Malicious" },
        suspicious: { color: "suspicious", label: "Suspicious" },
        harmless: { color: "safe", label: "Clean" },
        undetected: { color: "undetected", label: "Undetected" },
    };

    const percents = {};
    for (const key in categories) {
        percents[key] = getPercent(stats[key] || 0);
    }

    const verdict =
        stats.malicious > 0
            ? "Malicious"
            : stats.suspicious > 0
            ? "Suspicious"
            : "Safe";
    const verdictClass =
        stats.malicious > 0
            ? "malicious"
            : stats.suspicious > 0
            ? "suspicious"
            : "safe";

    let html =
        '<h3>Scan Report</h3>' +
        '<div class="scan-stats">' +
        '<p><strong>Verdict: </strong> <span class="' +
        verdictClass +
        '">' +
        verdict +
        "</span></p>" +
        '<div class="progress-section">' +
        '<div class="progress-label">' +
        '<span>Detection Results</span>' +
        '<span class="progress-percent">' +
        percents.malicious +
        '% Detection Rate</span>' +
        "</div>" +
        '<div class="progress-stacked">';

    for (const key in categories) {
        html +=
            '<div class="progress-bar ' +
            categories[key].color +
            '" style="width: ' +
            percents[key] +
            '%" title="' +
            categories[key].label +
            ": " +
            (stats[key] || 0) +
            " (" +
            percents[key] +
            '%)"></div>';
    }

    html += "</div><div class=\"progress-legend\">";

    for (const key in categories) {
        html +=
            '<div class="legend-item"><span class="legend-color ' +
            categories[key].color +
            '"></span><span>' +
            categories[key].label +
            " (" +
            percents[key] +
            '%)</span></div>';
    }

    html += "</div></div><div class=\"detection-details\">";

    for (const key in categories) {
        html +=
            '<div class="detail-item ' +
            categories[key].color +
            '"><span class="detail-label">' +
            categories[key].label +
            '</span><span class="detail-value">' +
            (stats[key] || 0) +
            '</span><span class="detail-percent">' +
            percents[key] +
            '%<span></div>';
    }

    html +=
        '</div></div><button onclick="showFullReport(this.getAttribute(\'data-report\'))" data-report=\'' +
        JSON.stringify(data) +
        "'> View Full Report</button>";

    updateResult(html);

    setTimeout(() => {
        const progressStacked = getElement("result").querySelector(".progress-stacked");
        if (progressStacked) {
            progressStacked.classList.add("animate");
        }
    }, 1000);
}

function showFullReport(reportData) {
    const data = typeof reportData === "string" ? JSON.parse(reportData) : reportData;
    const modal = getElement("FullReportModel");
    const results = data.data && data.data.attributes && data.data.attributes.results;

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
            html += "<tr><td>" + engine + "</td><td class='" + categoryClass + "'>" + category + "</td></tr>";
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

// Your existing 'load' event listener
window.addEventListener("load", () => {
    // --- NEW: CALL THE VISITOR COUNTER FUNCTION ON PAGE LOAD ---
    updateVisitorCount();
    // -----------------------------------------------------------

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
            const response = await fetch("https://safe-scan-vt.onrender.com/feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ feedback }),
            });
            if (!response.ok) {
                throw new Error("Failed to submit feedback");
            }
            feedbackMessage.style.display = "block";
            feedbackMessage.style.color = "var(--success)";
            feedbackMessage.textContent = "Thank you for your feedback!";
            feedbackInput.value = "";
            loadFeedbackList();
        } catch (error) {
            feedbackMessage.style.display = "block";
            feedbackMessage.style.color = "var(--danger)";
            feedbackMessage.textContent = "Error submitting feedback. Please try again later.";
        }
    });

    async function loadFeedbackList() {
        const feedbackList = getElement("feedbackList");
        try {
            const response = await fetch("https://safe-scan-vt.onrender.com/feedback");
            if (!response.ok) {
                throw new Error("Failed to fetch feedback list");
            }
            const data = await response.json();
            feedbackList.innerHTML = "";
            if (data.feedbacks && data.feedbacks.length > 0) {
                data.feedbacks.forEach((item) => {
                    const li = document.createElement("li");
                    li.textContent = item;
                    feedbackList.appendChild(li);
                });
            } else {
                feedbackList.innerHTML = "<li>No feedback available.</li>";
            }
        } catch (error) {
            feedbackList.innerHTML = "<li>Error loading feedback list.</li>";
        }
    }

    loadFeedbackList();
});