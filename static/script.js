// Initialize CodeMirror
let editor = CodeMirror.fromTextArea(document.getElementById("code"), {
    mode: "python",
    theme: "dracula",
    lineNumbers: true,
    styleActiveLine: true,
    matchBrackets: true,
    indentUnit: 4
});

// Refresh to fix sizing
setTimeout(() => {
    editor.refresh();
}, 200);

let highlightedLines = [];

function changeLanguage() {
    const lang = document.getElementById("langSelect").value;
    if (lang === "c") {
        editor.setOption("mode", "text/x-csrc");
    } else {
        editor.setOption("mode", "python");
    }
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'success') icon = 'fa-circle-check';
    
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// File Upload
document.getElementById('fileInput').addEventListener('change', async function(e) {
    if (!this.files.length) return;
    
    const file = this.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
        showToast("Uploading and parsing file...", "info");
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.error) {
            showToast(data.error, "error");
        } else {
            editor.setValue(data.code);
            if (data.language) {
                document.getElementById("langSelect").value = data.language;
                changeLanguage();
            }
            showToast("File loaded successfully", "success");
        }
    } catch (err) {
        showToast("Upload failed", "error");
    }
    
    // Reset input
    this.value = '';
});

// Load Sample
function loadSample() {
    const pySample = `import threading
import time

bank_balance = 1000

def withdraw(amount):
    global bank_balance
    if bank_balance >= amount:
        print(f"Processing withdrawal of {amount}")
        time.sleep(0.1) # Simulate network delay
        bank_balance -= amount
        print(f"Remaining balance: {bank_balance}")
    else:
        print("Insufficient funds")

t1 = threading.Thread(target=withdraw, args=(800,))
t2 = threading.Thread(target=withdraw, args=(800,))

t1.start()
t2.start()

t1.join()
t2.join()
print(f"Final Balance: {bank_balance}")`;
    
    document.getElementById("langSelect").value = "python";
    changeLanguage();
    editor.setValue(pySample);
    showToast("Sample loaded", "info");
}

function clearEditor() {
    editor.setValue("");
    document.getElementById('output').innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-shield-halved"></i>
            <h3>Ready for Analysis</h3>
            <p>Write some code or upload a file, then click <strong>Analyze</strong>.</p>
        </div>
    `;
    clearHighlights();
    document.getElementById('downloadBtn').disabled = true;
    showToast("Editor cleared", "info");
}

function copyCode() {
    navigator.clipboard.writeText(editor.getValue());
    showToast("Code copied to clipboard!", "success");
}

// Clear old highlights
function clearHighlights() {
    highlightedLines.forEach(line => {
        editor.removeLineClass(line, "background", "highlight-line");
    });
    highlightedLines = [];
}

// Jump to line and highlight
function jumpToLine(lineNum) {
    const actualLine = lineNum - 1;
    
    // Scroll to line
    editor.scrollIntoView({line: actualLine, ch: 0}, 200);
    editor.setCursor({line: actualLine, ch: 0});
    editor.focus();

    // Temporarily flash the line
    editor.addLineClass(actualLine, "background", "highlight-line");
    setTimeout(() => {
        if (!highlightedLines.includes(actualLine)) {
            editor.removeLineClass(actualLine, "background", "highlight-line");
        }
    }, 1500);
}

// Analyze Code
async function analyzeCode() {
    const code = editor.getValue();
    if (!code.trim()) {
        showToast("Editor is empty", "error");
        return;
    }

    const analyzeBtn = document.getElementById("analyzeBtn");
    const outputDiv = document.getElementById("output");
    const lang = document.getElementById("langSelect").value;
    
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';
    outputDiv.innerHTML = '<div class="empty-state"><div class="loader"></div><p>Performing static analysis...</p></div>';
    clearHighlights();

    try {
        const res = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, language: lang })
        });

        const data = await res.json();
        window.lastReportData = data;
        renderReport(data);
        showToast("Analysis complete", "success");
    } catch (err) {
        showToast("Analysis failed", "error");
        outputDiv.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation" style="color:var(--danger)"></i><p>An error occurred.</p></div>`;
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fa-solid fa-play"></i> Analyze';
    }
}

function renderReport(data) {
    const outputDiv = document.getElementById("output");
    
    if (data.total_issues === 0) {
        outputDiv.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-check-circle" style="color: var(--success)"></i>
                <h3>No Race Conditions Detected</h3>
                <p>Your code looks safe based on our static analysis.</p>
            </div>
        `;
        document.getElementById('downloadBtn').disabled = true;
        return;
    }

    document.getElementById('downloadBtn').disabled = false;
    let html = `<h2><i class="fa-solid fa-bug"></i> ${data.total_issues} Issue(s) Found</h2><hr style="border-color: var(--border-color); margin: 10px 0 20px 0;">`;

    // Shared Variables
    html += `
        <div class="result-card">
            <div class="card-header info">
                <i class="fa-solid fa-share-nodes"></i> Shared Variables Detected
            </div>
            <div class="card-body">
                <p><code>${data.shared_variables.join("</code>, <code>")}</code></p>
            </div>
        </div>
    `;

    // Race Conditions
    data.race_conditions.forEach((rc, index) => {
        // Highlight in editor
        rc.lines.forEach(l => {
            const actL = l - 1;
            editor.addLineClass(actL, "background", "highlight-line");
            highlightedLines.push(actL);
        });

        const lineLinks = rc.lines.map(l => `<span class="line-tag" onclick="jumpToLine(${l})">Line ${l}</span>`).join(" ");

        html += `
            <div class="result-card">
                <div class="card-header danger">
                    <i class="fa-solid fa-triangle-exclamation"></i> Race Condition: ${rc.variable}
                </div>
                <div class="card-body">
                    <p>Detected concurrent access to <strong>${rc.variable}</strong> at: ${lineLinks}</p>
                    
                    <div class="ai-box">
                        <h4><i class="fa-solid fa-sparkles"></i> AI Explanation</h4>
                        <p>${rc.ai_explanation}</p>
                    </div>

                    <p><strong>Step-by-Step Scenario:</strong></p>
                    <ul class="step-list">
                        ${rc.step_by_step.map(step => `<li>${step}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    });

    // Suggestions
    html += `
        <div class="result-card">
            <div class="card-header success">
                <i class="fa-solid fa-wrench"></i> Suggested Fixes
            </div>
            <div class="card-body">
    `;

    data.suggestions.forEach(s => {
        html += `
            <p><i class="fa-solid fa-lightbulb" style="color:var(--warning)"></i> <strong>${s.fix}</strong></p>
            <pre class="code-snippet"><code>${s.fixed_code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
            <br>
        `;
    });

    html += `</div></div>`;
    outputDiv.innerHTML = html;
}

// Download PDF Report
function downloadReport() {
    if (!window.lastReportData) {
        showToast("No data to generate report", "error");
        return;
    }
    
    const data = window.lastReportData;
    const langSelect = document.getElementById("langSelect");
    const lang = langSelect.options[langSelect.selectedIndex].text;
    
    // Create a temporary container
    const printContainer = document.createElement('div');
    printContainer.className = 'pdf-report-container';
    
    // Build HTML for PDF
    const now = new Date();
    const timestamp = now.toLocaleString();
    
    let html = `
        <div class="pdf-header">
            <h1><i class="fa-solid fa-microchip"></i> ConcurSense</h1>
            <h3>Race Condition Detection Report</h3>
            <hr>
            <div class="pdf-metadata">
                <p><strong>Generated on:</strong> ${timestamp}</p>
                <p><strong>Language:</strong> ${lang}</p>
                <p><strong>Issues Found:</strong> ${data.total_issues}</p>
            </div>
        </div>
        <div class="pdf-body">
    `;
    
    if (data.total_issues === 0) {
        html += `<p class="pdf-safe-msg">✅ No Race Conditions Detected. The code appears safe based on static analysis.</p>`;
    } else {
        html += `
            <div class="pdf-section">
                <h4><i class="fa-solid fa-share-nodes"></i> Shared Variables</h4>
                <p class="pdf-code-inline">${data.shared_variables.join(", ")}</p>
            </div>
        `;
        
        data.race_conditions.forEach((rc, i) => {
            const severity = "High";
            const badgeClass = "badge-high";
            const badgeIcon = "🔴";
            
            html += `
                <div class="pdf-card">
                    <div class="pdf-card-header">
                        <span><i class="fa-solid fa-triangle-exclamation"></i> Issue #${i + 1}: Race Condition on '${rc.variable}'</span>
                        <span class="pdf-badge ${badgeClass}">${badgeIcon} ${severity} Severity</span>
                    </div>
                    <div class="pdf-card-body">
                        <p><strong>Detected concurrent access to:</strong> <span class="pdf-code-inline">${rc.variable}</span> at lines ${rc.lines.join(", ")}</p>
                        
                        <h5>AI Explanation</h5>
                        <p>${rc.ai_explanation}</p>
                        
                        <h5>Step-by-Step Scenario</h5>
                        <ul class="pdf-steps">
                            ${rc.step_by_step.map(step => `<li>${step}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        });
        
        data.suggestions.forEach((s, i) => {
            html += `
                <div class="pdf-card success-card">
                    <div class="pdf-card-header">
                        <span><i class="fa-solid fa-wrench"></i> Suggested Fix for '${s.variable}'</span>
                    </div>
                    <div class="pdf-card-body">
                        <p><strong>Recommendation:</strong> ${s.fix}</p>
                        <pre class="pdf-code-block"><code>${s.fixed_code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
                    </div>
                </div>
            `;
        });
    }
    
    html += `
        </div>
        <div class="pdf-footer">
            <p>Generated by ConcurSense</p>
            <p>For educational and analysis purposes</p>
        </div>
    `;
    
    printContainer.innerHTML = html;
    document.body.appendChild(printContainer);
    
    // Temporarily allow body/html overflow so html2canvas doesn't crop at 100vh
    const originalOverflow = document.body.style.overflow;
    const originalHeight = document.body.style.height;
    const originalHTMLOverflow = document.documentElement.style.overflow;
    const originalHTMLHeight = document.documentElement.style.height;
    
    document.body.style.overflow = 'visible';
    document.body.style.height = 'auto';
    document.documentElement.style.overflow = 'visible';
    document.documentElement.style.height = 'auto';
    const originalStyles = {
        bodyOverflow: document.body.style.overflow,
        bodyHeight: document.body.style.height,
        htmlOverflow: document.documentElement.style.overflow,
        htmlHeight: document.documentElement.style.height
    };
    
    document.body.style.setProperty('overflow', 'visible', 'important');
    document.body.style.setProperty('height', 'auto', 'important');
    document.documentElement.style.setProperty('overflow', 'visible', 'important');
    document.documentElement.style.setProperty('height', 'auto', 'important');
    
    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5],
      filename:     'ConcurSense_Report.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          backgroundColor: '#ffffff'
      },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    showToast("Generating PDF Report...", "info");

    // Give the browser time to render the printContainer
    setTimeout(() => {
        window.scrollTo(0, 0);
        
        html2pdf().set(opt).from(printContainer).save().then(() => {
            showToast("Download Complete", "success");
            document.body.removeChild(printContainer);
            
            // Restore original styles
            document.body.style.overflow = originalOverflow;
            document.body.style.height = originalHeight;
            document.documentElement.style.overflow = originalHTMLOverflow;
            document.documentElement.style.height = originalHTMLHeight;
        }).catch(err => {
            console.error("PDF Generation Error:", err);
            showToast("PDF Generation Failed", "error");
            if (document.body.contains(printContainer)) {
                document.body.removeChild(printContainer);
            }
            document.body.style.overflow = originalOverflow;
            document.body.style.height = originalHeight;
            document.documentElement.style.overflow = originalHTMLOverflow;
            document.documentElement.style.height = originalHTMLHeight;
        });
    }, 1500); // Increased delay for safety
}
