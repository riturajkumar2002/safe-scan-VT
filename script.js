const getElement = id => document.getElementById(id);

function updateVisitorCount() {
    fetch('/api/counter')
        .then(response => response.ok ? response.json() : { count: 'N/A' })
        .then(data => {
            const countElement = getElement('visitor-count');
            if (countElement) countElement.textContent = data.count;
        })
        .catch(() => {
            const countElement = getElement('visitor-count');
            if (countElement) countElement.textContent = 'N/A';
        });
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

    async function loadFeedbackList() {
        const feedbackList = getElement("feedbackList");
        try {
            const response = await fetch("/feedback");
            if (!response.ok) throw new Error();
            const data = await response.json();
            feedbackList.innerHTML = "";
            if (data.feedbacks && data.feedbacks.length > 0) {
                data.feedbacks.forEach(item => {
                    const li = document.createElement("li");
                    li.textContent = item;
                    feedbackList.appendChild(li);
                });
            } else {
                feedbackList.innerHTML = "<li>No feedback available.</li>";
            }
        } catch {
            feedbackList.innerHTML = "<li>Error loading feedback list.</li>";
        }
    }

    loadFeedbackList();
});
