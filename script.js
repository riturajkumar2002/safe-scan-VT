const API_KEY = "482c8d34d486b60b7bd794f82b2cba7b523c532c2583b37732a5053f0a3d9513";

const getElement = id => document.getElementById(id);
const updateResult = (content, display = true) => {
    const result = getElement('result');
    result.style.display = display ? 'block' : 'none';
    result.innerHTML = content;
};
const showLoading = message => updateResult(`
    <div class="loading">
        <p>${message}</p>
        <div class="spinner"></div>
    </div>
`);

const showError = message => updateResult(`<p class="error">${message}</p>`);

async function makeRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "x-apikey": API_KEY,
            ...options.headers
        }
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || 'Request failed!');
    }
    return response.json();
}

async function scanURL() {
    const url = getElement("urlInput").value.trim();
    if (!url) return showError("Please enter a URL");

    try {
        new URL(url);
    } catch {
        return showError("Please enter a valid URL, e.g., https://example.com");
    }

    try {
        showLoading("Submitting URL for scanning...");

        const encodedURL = encodeURIComponent(url);

        const submitResult = await makeRequest("https://www.virustotal.com/api/v3/urls", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/x-www-form-urlencoded"
            },
            body: `url=${encodedURL}`
        });

        if (!submitResult.data?.id) {
            throw new Error("Failed to get analysis ID");
        }

        await new Promise(resolve => setTimeout(resolve, 3000));

        showLoading("Getting scan results...");
        await pollAnalysisResults(submitResult.data.id);
    } catch (error) {
        showError(`Error: ${error.message}`);
    }
}

async function scanFile() {
    const file = getElement('fileInput').files[0];
    if (!file) return showError("Please select a file!");
    if (file.size > 32 * 1024 * 1024) return showError("File size exceeds 32MB limit.");

    try {
        showLoading("Uploading file...");

        const formData = new FormData();
        formData.append("file", file);
        const uploadResult = await makeRequest("https://www.virustotal.com/api/v3/files", {
            method: "POST",
            body: formData
        });
        if (!uploadResult.data?.id) {
            throw new Error("Failed to get file ID");
        }
        await new Promise(resolve => setTimeout(resolve, 3000));

        showLoading("Getting scan results...");
        const analysisResult = await makeRequest(`https://www.virustotal.com/api/v3/analyses/${uploadResult.data.id}`);
        if (!analysisResult.data?.id) {
            throw new Error("Failed to get analysis results!");
        }
        await pollAnalysisResults(analysisResult.data.id, file.name);
    } catch (error) {
        showError(`Error: ${error.message}`);
    }
}

async function pollAnalysisResults(analysisId, fileName = '') {
    const maxAttempts = 20;
    let attempts = 0;
    let interval = 2000;

    while (attempts < maxAttempts) {
        try {
            showLoading(`Analyzing ${fileName ? fileName : ''}... (${((maxAttempts - attempts) * interval / 1000).toFixed(0)}s remaining)`);
            const report = await makeRequest(`https://www.virustotal.com/api/v3/analyses/${analysisId}`);
            const status = report.data?.attributes?.status;
            if (!status) throw new Error("Invalid analysis response!");
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
            showError(`Error: ${error.message}`);
            break;
        }
    }
}

function showFormattedResult(data) {
    if (!data?.data?.attributes?.stats) return showError("Invalid response format!");
    const stats = data.data.attributes.stats;
    const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
    if (!total) return showError("No analysis results available!");
    const getPercent = val => ((val / total) * 100).toFixed(1);
    const categories = {
        'malicious': { color: 'malicious', label: 'Malicious' },
        'suspicious': { color: 'suspicious', label: 'Suspicious' },
        'harmless': { color: 'safe', label: 'Clean' },
        'undetected': { color: 'undetected', label: 'Undetected' }
    };
    const percents = Object.keys(categories).reduce((acc, key) => {
        acc[key] = getPercent(stats[key]);
        return acc;
    }, {});
    const verdict = stats.malicious > 0 ? "Malicious" : stats.suspicious > 0 ? "Suspicious" : "Safe";
    const verdictClass = stats.malicious > 0 ? "malicious" : stats.suspicious > 0 ? "suspicious" : "safe";

    updateResult(`
        <h3>Scan Report</h3>
        <div class="scan-stats">
            <p><strong>Verdict: </strong> <span class="${verdictClass}">${verdict}</span></p>
            <div class="progress-section">
                <div class="progress-label">
                    <span>Detection Results</span>
                    <span class="progress-percent">${percents.malicious}% Detection Rate</span>
                </div>
                <div class="progress-stacked">
                    ${Object.entries(categories).map(([key, { color }]) => `
                        <div class="progress-bar ${color}" style="width: ${percents[key]}%" title="${categories[key].label}: ${stats[key]} (${percents[key]}%)"></div>
                    `).join('')}
                </div>
                <div class="progress-legend">
                    ${Object.entries(categories).map(([key, { color, label }]) => `
                        <div class="legend-item">
                            <span class="legend-color ${color}"></span>
                            <span>${label} (${percents[key]}%)</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="detection-details">
               ${Object.entries(categories).map(([key, { color, label }]) => `
                    <div class="detail-item ${color}">
                        <span class="detail-label">${label}</span>
                        <span class="detail-value">${stats[key]}</span>
                        <span class="detail-percent">${percents[key]}%<span>
                    </div>
                `).join('')}
            </div>
        </div>
        <button onclick="showFullReport(this.getAttribute('data-report'))" data-report='${JSON.stringify(data)}'> View Full Report</button>
    `);

    setTimeout(() => getElement('result').querySelector('.progress-stacked').classList.add('animate'), 1000);
}

function showFullReport(reportData) {
    const data = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;
    const modal = getElement('FullReportModel');
    const results = data.data?.attributes?.results;

    getElement("FullReportContent").innerHTML = `
      <h3>Full Report Details</h3>
        ${results ? `
            <table>
              <tr><th>Engine</th><th>Result</th></tr>
               ${Object.entries(results).map(([engine, 
               { category}]) => `
                    <tr>
                      <td>${engine}</td>
                      <td class="${category === "malicious" ? "malicious" : category === "suspicious" ? "suspicious" : "safe" }">${category}</td>
                    </tr>
                `).join('')}
            </table>
        ` : '<p>No detailed results available!</p>'}
    `;
    modal.style.display = "block";
    modal.offsetHeight;
    modal.classList.add("show");
}

const closeModal = () => {
    const modal = getElement("FullReportModel");
    modal.classList.remove("show");
    setTimeout(() => modal.style.display = "none", 300);
}

window.addEventListener('load', () => {
    const modal = getElement('FullReportModel');
    window.addEventListener('click', e => e.target === modal && closeModal());
});