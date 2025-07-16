const getElement = id => document.getElementById(id);

function updateResult(content, display = true) {
    const result = getElement('result');
    result.style.display = display ? 'block' : 'none';
    result.innerHTML = content;
}

function showLoading(message) {
    updateResult(`<div class="loading"><p>${message}</p><div class="spinner"></div></div>`);
}

function showError(message) {
    updateResult(`<p class="error">${message}</p>`);
}

async function scanURL() {
    const urlInput = getElement("urlInput");
    const url = urlInput.value.trim();
    if (!url) {
        showError("Please enter a URL.");
        return;
    }
    try {
        new URL(url);
    } catch {
        showError("Please enter a valid URL, e.g., https://example.com");
        return;
    }

    showLoading("Submitting URL for scanning...");
    try {
        const response = await fetch("https://safe-scan-vt.onrender.com/scan-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
        });
        if (!response.ok) throw new Error("Failed to submit URL for scanning.");
        const result = await response.json();
        showLoading("Analyzing results...");
        pollAnalysisResults(result.data.id);
    } catch (error) {
        showError(`Error: ${error.message}`);
    }
}

async function scanFile() {
    const fileInput = getElement('fileInput');
    const file = fileInput.files[0];
    if (!file) {
        showError("Please select a file to scan.");
        return;
    }
    if (file.size > 32 * 1024 * 1024) {
        showError("File size exceeds the 32MB limit.");
        return;
    }

    showLoading("Uploading file...");
    try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("https://safe-scan-vt.onrender.com/scan-file", {
            method: "POST",
            body: formData
        });
        if (!response.ok) throw new Error("Failed to upload file for scanning.");
        const result = await response.json();
        showLoading("Analyzing results...");
        pollAnalysisResults(result.data.id, file.name);
    } catch (error) {
        showError(`Error: ${error.message}`);
    }
}

async function pollAnalysisResults(analysisId, fileName = '') {
    const maxAttempts = 20;
    let attempts = 0;
    const poll = async () => {
        if (attempts >= maxAttempts) {
            showError("Analysis timed out. The file or URL may be too large or the service is busy. Please try again later.");
            return;
        }
        try {
            const response = await fetch(`https://safe-scan-vt.onrender.com/analysis/${analysisId}`);
            if (!response.ok) throw new Error("Failed to retrieve analysis results.");
            const report = await response.json();
            const status = report.data?.attributes?.status;

            if (status === "completed") {
                showFormattedResult(report);
            } else if (status === "queued" || status === "in-progress") {
                attempts++;
                setTimeout(poll, 5000); // Poll every 5 seconds
            } else {
                throw new Error("Analysis failed or returned an unknown status.");
            }
        } catch (error) {
            showError(`Error: ${error.message}`);
        }
    };
    poll();
}

function showFormattedResult(data) {
    const stats = data.data?.attributes?.stats;
    if (!stats) {
        showError("Could not retrieve analysis statistics from the report.");
        return;
    }

    const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
    if (!total) {
        showError("No analysis results available from any vendor.");
        return;
    }

    const getPercent = (val) => total > 0 ? ((val / total) * 100).toFixed(1) : 0;

    const categories = {
        malicious: { label: "Malicious", value: stats.malicious || 0, color: 'malicious' },
        suspicious: { label: "Suspicious", value: stats.suspicious || 0, color: 'suspicious' },
        harmless: { label: "Harmless", value: stats.harmless || 0, color: 'safe' },
        undetected: { label: "Undetected", value: stats.undetected || 0, color: 'undetected' },
    };

    const verdict = stats.malicious > 0 ? "Malicious" : stats.suspicious > 0 ? "Suspicious" : "Safe";

    const progressBars = Object.values(categories)
        .map(cat => `<div class="progress-bar ${cat.color}" style="width: ${getPercent(cat.value)}%" title="${cat.label}: ${cat.value}"></div>`)
        .join('');

    const detailItems = Object.values(categories)
        .map(cat => `
            <div class="detail-item ${cat.color}">
                <span class="detail-label">${cat.label}</span>
                <span class="detail-value">${cat.value}
                    <span class="detail-percent">(${getPercent(cat.value)}%)</span>
                </span>
            </div>
        `).join('');

    const html = `
        <h3>Scan Report</h3>
        <p><strong>Overall Verdict:</strong> <span class="${verdict.toLowerCase()}">${verdict}</span></p>
        <div class="progress-section">
            <div class="progress-label">
                <span>Vendor Analysis</span>
                <span>${total} Total Vendors</span>
            </div>
            <div class="progress-stacked">${progressBars}</div>
        </div>
        <div class="detection-details">${detailItems}</div>
        <button onclick='showFullReport(${JSON.stringify(data)})'>View Full Report</button>
    `;
    updateResult(html);
}

function showFullReport(reportData) {
    const results = reportData.data?.attributes?.results;
    const modal = getElement('FullReportModel');
    const content = getElement('FullReportContent');
    
    if (!results) {
        content.innerHTML = '<p>No detailed results available.</p>';
        return;
    }

    const rows = Object.entries(results).map(([engine, result]) => `
        <tr>
            <td>${engine}</td>
            <td class="${result.category.toLowerCase()}">${result.category}</td>
        </tr>
    `).join('');

    content.innerHTML = `<table><thead><tr><th>Engine</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>`;
    modal.classList.add('show');
}

function closeModal() {
    getElement('FullReportModel').classList.remove('show');
}

async function loadVisitCount() {
    try {
        const response = await fetch('https://safe-scan-vt.onrender.com/api/counter');
        if (!response.ok) throw new Error('Could not fetch count.');
        const data = await response.json();
        getElement('visitor-count').textContent = data.count;
    } catch (error) {
        getElement('visitor-count').textContent = 'N/A';
    }
}

window.addEventListener('load', () => {
    loadVisitCount();
    window.addEventListener('click', e => {
        if (e.target === getElement('FullReportModel')) {
            closeModal();
        }
    });
});
