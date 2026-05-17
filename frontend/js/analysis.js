// GitHub Repository Reader
// Handles URL validation, GitHub API calls, and UI updates

// State management
let currentRepo = null;
let currentOwner = null;
let currentRepoName = null;
let useAuthenticatedApi = false;

function apiBase() {
    return window.REPOTALK_API_BASE || '';
}

async function refreshAuthMode() {
    if (typeof Auth === 'undefined') {
        useAuthenticatedApi = false;
        return;
    }
    const session = await Auth.getSession();
    useAuthenticatedApi = Boolean(session.authenticated);
}

/** Resolved repo + branch used for tree + contents API */
let explorerContext = null;

/** Abort duplicate tree interactions when reloading */
let fileTreeAbort = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    initializeEventListeners();
    initializeAnalysisListeners();
    if (typeof Auth !== 'undefined') {
        await Auth.init();
        await refreshAuthMode();
    }
    checkUrlParams();
});

window.showAnalysisError = showError;
window.onAuthenticatedRepoSelect = (owner, repo) => {
    fetchRepository(owner, repo);
};

window.onGitHubDisconnected = () => {
    useAuthenticatedApi = false;
};

// Initialize event listeners
function initializeEventListeners() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const repoInput = document.getElementById('repoUrl');
    const exampleBtns = document.querySelectorAll('.example-btn');

    analyzeBtn.addEventListener('click', handleAnalyze);

    repoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleAnalyze();
        }
    });

    exampleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            repoInput.value = btn.dataset.url;
            handleAnalyze();
        });
    });
}

// Check URL parameters for direct repository loading
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const repo = urlParams.get('repo');

    if (repo) {
        document.getElementById('repoUrl').value = repo;
        handleAnalyze();
    }
}

// Handle analyze button click
async function handleAnalyze() {
    const input = document.getElementById('repoUrl').value.trim();

    if (!input) {
        showError('Please enter a GitHub repository URL');
        return;
    }

    const repoInfo = extractRepoInfo(input);

    if (!repoInfo) {
        showError('Invalid GitHub URL format. Please use: github.com/owner/repo or owner/repo');
        return;
    }

    await fetchRepository(repoInfo.owner, repoInfo.repo);
}

// Initialize analysis event listeners
function initializeAnalysisListeners() {
    const audienceBtns = document.querySelectorAll('.audience-btn');
    const changeAudienceBtn = document.getElementById('changeAudienceBtn');
    const exportDocBtn = document.getElementById('exportDocBtn');

    audienceBtns.forEach(btn => {
        btn.addEventListener('click', (evt) => {
            const audience = btn.dataset.audience;
            handleAudienceSelection(audience, evt);
        });
    });

    if (changeAudienceBtn) {
        changeAudienceBtn.addEventListener('click', () => {
            showAudienceSelector();
        });
    }

    if (exportDocBtn) {
        exportDocBtn.addEventListener('click', () => {
            exportDocument();
        });
    }

    document.querySelectorAll('#engineerModeSwitch .mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => setEngineerMode(btn.dataset.mode));
    });
}

// Currently-selected audience and engineer mode ('docs' | 'cd')
let currentAudience = null;
let currentEngineerMode = 'docs';

function isEngineerAudience(audience) {
    return audience === 'software_engineer' || audience === 'engineering_manager';
}

// Handle audience selection
async function handleAudienceSelection(audience, evt) {
    if (!currentOwner || !currentRepoName) {
        showError('Please analyze a repository first');
        return;
    }

    currentAudience = audience;

    // Update audience-button UI
    document.querySelectorAll('.audience-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    const target = evt?.target?.closest?.('.audience-btn')
        || document.querySelector(`.audience-btn[data-audience="${audience}"]`);
    if (target) target.classList.add('selected');

    const modeSwitch = document.getElementById('engineerModeSwitch');
    const deploymentPanel = document.getElementById('deploymentPanel');
    const documentDisplay = document.getElementById('documentDisplay');
    const analysisLoading = document.getElementById('analysisLoading');

    if (!isEngineerAudience(audience)) {
        if (modeSwitch) modeSwitch.style.display = 'none';
        if (deploymentPanel) deploymentPanel.style.display = 'none';
        await runDocumentGeneration(audience);
        return;
    }

    // Engineer audiences: show the Docs / CD toggle and reset state.
    if (modeSwitch) modeSwitch.style.display = 'block';
    if (documentDisplay) documentDisplay.style.display = 'none';
    if (analysisLoading) analysisLoading.style.display = 'none';
    if (deploymentPanel) deploymentPanel.style.display = 'none';

    // Default engineer mode = Documentation
    setEngineerMode(currentEngineerMode || 'docs');
}

// Apply a Docs / CD mode for an engineer audience
async function applyEngineerMode(mode) {
    if (!currentAudience || !isEngineerAudience(currentAudience)) return;

    currentEngineerMode = mode;

    const documentDisplay = document.getElementById('documentDisplay');
    const analysisLoading = document.getElementById('analysisLoading');
    const deploymentPanel = document.getElementById('deploymentPanel');

    if (mode === 'cd') {
        if (documentDisplay) documentDisplay.style.display = 'none';
        if (analysisLoading) analysisLoading.style.display = 'none';
        if (deploymentPanel) deploymentPanel.style.display = 'block';
        initializeDeploymentControls(currentOwner, currentRepoName);
        deploymentPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    if (deploymentPanel) deploymentPanel.style.display = 'none';
    await runDocumentGeneration(currentAudience);
}

// Visually mark a mode and then run it
function setEngineerMode(mode) {
    document.querySelectorAll('#engineerModeSwitch .mode-btn').forEach((b) => {
        b.classList.toggle('selected', b.dataset.mode === mode);
    });
    applyEngineerMode(mode);
}

// Run document generation for a given audience
async function runDocumentGeneration(audience) {
    const loading = document.getElementById('analysisLoading');
    const display = document.getElementById('documentDisplay');
    if (loading) loading.style.display = 'flex';
    if (display) display.style.display = 'none';

    try {
        await refreshAuthMode();

        let response;
        if (useAuthenticatedApi && typeof Auth !== 'undefined') {
            response = await Auth.apiFetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner: currentOwner,
                    repo: currentRepoName,
                    audience,
                }),
            });
        } else {
            response = await fetch(`${apiBase()}/api/analyze/public`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner: currentOwner,
                    repo: currentRepoName,
                    audience,
                }),
            });
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Analysis failed (${response.status})`);
        }

        const data = await response.json();
        displayDocument(data.document);
    } catch (error) {
        console.error('Analysis error:', error);
        showError(error.message);
        if (loading) loading.style.display = 'none';
    }
}

// Display generated document
function displayDocument(doc) {
    document.getElementById('analysisLoading').style.display = 'none';
    document.getElementById('documentDisplay').style.display = 'block';

    const titleEl = document.getElementById('documentTitle');
    const contentEl = document.getElementById('documentContent');

    titleEl.textContent = doc.title;

    let html = '';
    for (const section of doc.sections) {
        html += `
            <div class="document-section">
                <h3>${escapeHtml(section.heading)}</h3>
                <div>${formatMarkdown(section.content)}</div>
            </div>
        `;
    }

    contentEl.innerHTML = html;

    // Scroll to document
    document.getElementById('documentDisplay').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// Format markdown-like content to HTML
function formatMarkdown(text) {
    let html = escapeHtml(text);

    // Convert **bold** to <strong>
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert `code` to <code>
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert bullet points
    html = html.replace(/^• (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Convert line breaks to paragraphs
    const paragraphs = html.split('\n\n');
    html = paragraphs.map(p => {
        p = p.trim();
        if (!p) return '';
        if (p.startsWith('<ul>') || p.startsWith('<ol>')) return p;
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return html;
}

// Show audience selector
function showAudienceSelector() {
    document.getElementById('documentDisplay').style.display = 'none';
    document.querySelectorAll('.audience-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// Export document
function exportDocument() {
    const title = document.getElementById('documentTitle').textContent;
    const content = document.getElementById('documentContent').innerText;

    const blob = new Blob([`${title}\n${'='.repeat(title.length)}\n\n${content}`], {
        type: 'text/plain',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentRepoName}-analysis.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Extract owner and repo from various URL formats
function extractRepoInfo(input) {
    input = input.trim();

    let match = input.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
        return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }

    match = input.match(/^github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
        return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }

    match = input.match(/^([^\/]+)\/([^\/]+)$/);
    if (match) {
        return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }

    return null;
}

function encodeRepoContentPath(path) {
    return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function escapeHtmlAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function decodeGitHubBase64Content(base64) {
    const clean = base64.replace(/\s/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    if (bytes.some((b) => b === 0)) {
        return { kind: 'binary' };
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return { kind: 'text', text };
}

function githubBlobWebUrl(repoHtmlUrl, branch, path) {
    const encoded = path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    return `${repoHtmlUrl}/blob/${encodeURIComponent(branch)}/${encoded}`;
}

function resetPreviewPanel() {
    const pathEl = document.getElementById('previewPath');
    const linkEl = document.getElementById('previewGithubLink');
    const codeEl = document.getElementById('previewCode');

    if (pathEl) pathEl.textContent = '—';
    if (linkEl) {
        linkEl.style.display = 'none';
        linkEl.href = '#';
    }
    if (codeEl) codeEl.textContent = '';

    setPreviewVisible('placeholder');
}

function setPreviewVisible(kind) {
    const ph = document.getElementById('previewPlaceholder');
    const ld = document.getElementById('previewLoading');
    const pre = document.getElementById('previewPre');
    const msg = document.getElementById('previewMessage');
    if (!ph || !ld || !pre || !msg) return;

    ph.style.display = 'none';
    ld.style.display = 'none';
    pre.style.display = 'none';
    msg.style.display = 'none';

    if (kind === 'placeholder') ph.style.display = 'flex';
    else if (kind === 'loading') ld.style.display = 'flex';
    else if (kind === 'code') pre.style.display = 'block';
    else if (kind === 'message') msg.style.display = 'block';
}

function markSelectedFile(row) {
    document.querySelectorAll('.tree-item.file.selected').forEach((el) => {
        el.classList.remove('selected');
    });
    row.classList.add('selected');
}

function showPreviewMessage(html) {
    const msg = document.getElementById('previewMessage');
    if (msg) msg.innerHTML = html;
    setPreviewVisible('message');
}

async function loadFilePreview(path) {
    if (!explorerContext || !currentRepo) return;

    const { owner, repo, branch } = explorerContext;

    document.getElementById('previewPath').textContent = path;

    const ghLink = document.getElementById('previewGithubLink');
    ghLink.href = githubBlobWebUrl(currentRepo.html_url, branch, path);
    ghLink.style.display = 'inline-flex';

    setPreviewVisible('loading');

    const encodedPath = encodeRepoContentPath(path);

    try {
        let res;
        if (useAuthenticatedApi && typeof Auth !== 'undefined') {
            res = await Auth.apiFetch(
                `/api/github/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
            );
        } else {
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
            res = await fetch(apiUrl);
        }

        if (!res.ok) {
            if (res.status === 403) {
                showPreviewMessage(
                    '<p>GitHub refused this request (often rate limiting). Try again in a minute.</p>'
                );
                return;
            }
            if (res.status === 404) {
                showPreviewMessage('<p>That path was not found on this branch.</p>');
                return;
            }
            showPreviewMessage(`<p>Could not load file (${res.status}).</p>`);
            return;
        }

        const data = await res.json();

        if (Array.isArray(data)) {
            showPreviewMessage('<p>Expected a file but GitHub returned a directory listing.</p>');
            return;
        }

        if (data.type !== 'file') {
            showPreviewMessage(
                `<p>This tree entry is not a regular file (type: <code>${escapeHtmlAttr(data.type)}</code>). Open it on GitHub instead.</p>`
            );
            return;
        }

        if (!data.content || data.encoding !== 'base64') {
            const tooLarge =
                typeof data.message === 'string' &&
                data.message.toLowerCase().includes('too large');
            if (tooLarge && data.html_url) {
                showPreviewMessage(
                    `<p>This file is too large for the GitHub Contents API preview (&gt;1&nbsp;MB).</p><p><a href="${escapeHtmlAttr(data.html_url)}" target="_blank" rel="noopener noreferrer">Open file on GitHub</a></p>`
                );
                return;
            }
            showPreviewMessage(
                '<p>No inline content returned from GitHub for this path.</p>'
            );
            return;
        }

        const decoded = decodeGitHubBase64Content(data.content);

        if (decoded.kind === 'binary') {
            const dl =
                data.download_url ||
                githubBlobWebUrl(currentRepo.html_url, branch, path);
            showPreviewMessage(
                `<p>Binary file — preview not shown.</p><p><a href="${escapeHtmlAttr(dl)}" target="_blank" rel="noopener noreferrer">Download / view on GitHub</a></p>`
            );
            return;
        }

        const codeEl = document.getElementById('previewCode');
        codeEl.textContent = decoded.text;
        setPreviewVisible('code');
    } catch (err) {
        console.warn('File preview failed:', err);
        showPreviewMessage('<p>Network error while fetching file content.</p>');
    }
}

function handleFileTreeClick(e) {
    const fileRow = e.target.closest('.tree-item.file');
    if (fileRow && fileRow.dataset.path) {
        e.preventDefault();
        markSelectedFile(fileRow);
        loadFilePreview(fileRow.dataset.path);
        return;
    }

    const folderRow = e.target.closest('.tree-item.folder');
    if (folderRow) {
        e.preventDefault();
        toggleFolder(folderRow);
    }
}

// ============================================
// DEPLOYMENT INTEGRATION (Engineer Role)
// ============================================

let currentRepoForDeployment = null;

let deploymentStatusListenerBound = false;

/**
 * Initialize deployment controls when repository is loaded
 */
function initializeDeploymentControls(owner, repo) {
    currentRepoForDeployment = { owner, repo };

    const deploymentPanel = document.getElementById('deploymentPanel');
    if (deploymentPanel) {
        deploymentPanel.style.display = 'block';
    }

    const triggerBtn = document.getElementById('triggerDeploymentBtn');

    if (triggerBtn) {
        triggerBtn.onclick = () => handleDeploymentTrigger(owner, repo);
    }

    loadDeploymentHistory(owner, repo);
    loadOrchestrateConnection();

    if (!deploymentStatusListenerBound) {
        window.addEventListener('deploymentStatusUpdate', handleDeploymentStatusUpdate);
        deploymentStatusListenerBound = true;
    }
}

async function loadOrchestrateConnection() {
    const badge = document.getElementById('orchestrateConnection');
    if (!badge) return;

    try {
        const res = await fetch(`${apiBase()}/api/deployment/connection`, { credentials: 'include' });
        const data = await res.json();
        const conn = data?.connection || {};

        const vercel = data?.vercel || {};
        const lines = [];

        if (vercel.configured) {
            lines.push(`✅ Vercel CD: ${vercel.message || 'ready — real deploys enabled'}`);
        } else {
            lines.push('⚠️ Vercel CD: set VERCEL_TOKEN in .env for real deploys');
        }

        if (!conn.configured) {
            lines.push('ℹ️ watsonx Orchestrate: optional (not required for Vercel deploy)');
        } else if (conn.authenticated && conn.workflowAccessible) {
            lines.push(`✅ watsonx Orchestrate: connected (${conn.region || '?'})`);
        } else if (conn.authenticated) {
            lines.push(
                `⚠️ Orchestrate: authenticated, no workspace role — Vercel deploy still works. ${(conn.message || '').slice(0, 120)}`
            );
        } else {
            lines.push(`⚠️ Orchestrate: ${conn.message || 'not reachable'}`);
        }

        const cls = vercel.configured ? 'orchestrate-status-ok' : 'orchestrate-status-warn';
        badge.className = `orchestrate-connection ${cls}`;
        badge.querySelector('.text').textContent = lines.join(' · ');
    } catch (err) {
        badge.className = 'orchestrate-connection orchestrate-status-err';
        badge.querySelector('.text').textContent = `watsonx Orchestrate: ${err.message}`;
    }
}

/**
 * Handle deployment trigger — executes immediately via watsonx Orchestrate
 * using sensible defaults (no configuration modal required).
 */
async function handleDeploymentTrigger(owner, repo) {
    const triggerBtn = document.getElementById('triggerDeploymentBtn');
    const branch = currentRepo?.default_branch || 'main';
    const environment = 'production';
    const deploymentType = 'auto';

    try {
        if (triggerBtn) {
            triggerBtn.disabled = true;
            triggerBtn.innerHTML = `
                <div class="loading-spinner" style="width: 16px; height: 16px;"></div>
                Deploying via watsonx Orchestrate…
            `;
        }

        const deployment = await window.deploymentManager.triggerDeployment(owner, repo, {
            branch,
            environment,
            deploymentType,
        });

        showActiveDeployment(deployment);
        showSuccess(`Deployment initiated on ${branch} → ${environment} (id ${deployment.id.substring(0, 8)})`);
    } catch (error) {
        showError('Failed to trigger deployment: ' + error.message);
    } finally {
        if (triggerBtn) {
            triggerBtn.disabled = false;
            triggerBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 10V3L4 14H11L11 21L20 10L13 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Deploy Now
            `;
        }
    }
}

/**
 * Open deployment configuration modal
 */
function openDeploymentModal(owner, repo) {
    const modal = document.getElementById('deploymentModal');
    if (!modal) return;
    
    // Set default branch from current repo
    const branchInput = document.getElementById('deployBranch');
    if (branchInput && currentRepo) {
        branchInput.value = currentRepo.default_branch || 'main';
    }
    
    modal.style.display = 'flex';
    
    // Store repo info for confirmation
    modal.dataset.owner = owner;
    modal.dataset.repo = repo;
}

/**
 * Close deployment modal
 */
window.closeDeploymentModal = function() {
    const modal = document.getElementById('deploymentModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

/**
 * Confirm and execute deployment
 */
window.confirmDeployment = async function() {
    const modal = document.getElementById('deploymentModal');
    if (!modal) return;
    
    const owner = modal.dataset.owner;
    const repo = modal.dataset.repo;
    const branch = document.getElementById('deployBranch').value || 'main';
    const environment = document.getElementById('deployEnvironment').value;
    const deploymentType = document.getElementById('deployType').value;
    
    // Close modal
    closeDeploymentModal();
    
    const triggerBtn = document.getElementById('triggerDeploymentBtn');
    
    try {
        triggerBtn.disabled = true;
        triggerBtn.innerHTML = `
            <div class="loading-spinner" style="width: 16px; height: 16px;"></div>
            Deploying...
        `;

        const deployment = await window.deploymentManager.triggerDeployment(owner, repo, {
            branch,
            environment,
            deploymentType
        });

        // Show active deployment
        showActiveDeployment(deployment);

        showSuccess(`Deployment initiated! ID: ${deployment.id}`);

    } catch (error) {
        showError('Failed to trigger deployment: ' + error.message);
    } finally {
        triggerBtn.disabled = false;
        triggerBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 10V3L4 14H11L11 21L20 10L13 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Deploy Now
        `;
    }
}

// Track which deployment ids have already triggered the auto-redirect.
const redirectedDeployments = new Set();

function deploymentUrlBlock(deployment) {
    if (deployment?.url) {
        const safeUrl = escapeHtmlAttr(deployment.url);
        const inspector = deployment.inspectorUrl
            ? `<a href="${escapeHtmlAttr(deployment.inspectorUrl)}" target="_blank" rel="noopener" class="deployment-inspector">Inspect on Vercel ↗</a>`
            : '';
        const siteWarn =
            deployment.isPublic === false
                ? `<p class="deployment-site-warn">⚠️ Vercel built successfully but this URL serves nothing (NOT_FOUND). RepoTalk will retry with a different root directory when possible — or set Root Directory in the Vercel inspector and redeploy.</p>`
                : '';
        return `
            <div class="deployment-url-block">
                <span class="deployment-url-label">Production</span>
                <a href="${safeUrl}" target="_blank" rel="noopener" class="deployment-url-link">${safeUrl}</a>
                ${inspector}
                ${siteWarn}
            </div>
        `;
    }
    if (deployment?.inspectorUrl) {
        return `
            <div class="deployment-url-block">
                <a href="${escapeHtmlAttr(deployment.inspectorUrl)}" target="_blank" rel="noopener" class="deployment-inspector">Inspect on Vercel ↗</a>
            </div>
        `;
    }
    return '';
}

function deploymentProgressBlock(deployment) {
    const attempts = deployment?.attempts;
    const logs = deployment?.logs || [];
    const lastLog = logs[logs.length - 1] || '';
    const attemptCount = Array.isArray(attempts) ? attempts.length : 0;
    if (attemptCount <= 1 && !lastLog) return '';

    const attemptText = attemptCount > 1
        ? `Attempt ${attemptCount} — auto-healed by RepoTalk`
        : 'Building on Vercel…';

    return `
        <div class="deployment-progress">
            <span class="deployment-progress-attempt">${escapeHtml(attemptText)}</span>
            <span class="deployment-progress-log">${escapeHtml(lastLog)}</span>
        </div>
    `;
}

/**
 * Show active deployment
 */
function showActiveDeployment(deployment) {
    const activeSection = document.getElementById('activeDeployments');
    const deploymentsList = document.getElementById('deploymentsList');

    const statusInfo = window.deploymentManager.formatStatus(deployment.status);
    const providerLabel = deployment.provider === 'vercel' ? 'Vercel' : 'Simulated';

    const deploymentCard = document.createElement('div');
    deploymentCard.className = 'deployment-card';
    deploymentCard.id = `deployment-${deployment.id}`;
    deploymentCard.dataset.provider = deployment.provider || 'simulated';
    deploymentCard.innerHTML = `
        <div class="deployment-header">
            <span class="deployment-id">#${deployment.id.substring(0, 8)} · ${providerLabel}</span>
            <span class="deployment-status status-${statusInfo.color}">
                ${statusInfo.icon} ${statusInfo.text}
            </span>
        </div>
        <div class="deployment-info">
            <div class="deployment-detail">
                <span class="detail-label">Branch:</span>
                <span class="detail-value">${escapeHtml(deployment.branch)}</span>
            </div>
            <div class="deployment-detail">
                <span class="detail-label">Environment:</span>
                <span class="detail-value">${escapeHtml(deployment.environment)}</span>
            </div>
            <div class="deployment-detail">
                <span class="detail-label">Triggered:</span>
                <span class="detail-value">${formatRelativeTime(deployment.triggeredAt)}</span>
            </div>
        </div>
        <div class="deployment-url-slot">${deploymentUrlBlock(deployment)}</div>
        <div class="deployment-progress-slot">${deploymentProgressBlock(deployment)}</div>
        <div class="deployment-actions">
            <button class="btn-secondary btn-sm" onclick="cancelDeployment('${deployment.id}')">
                Cancel
            </button>
        </div>
    `;

    deploymentsList.insertBefore(deploymentCard, deploymentsList.firstChild);
    activeSection.style.display = 'block';
}

/**
 * Handle deployment status updates
 */
function handleDeploymentStatusUpdate(event) {
    const { executionId, status } = event.detail;
    const deploymentCard = document.getElementById(`deployment-${executionId}`);
    
    if (!deploymentCard) return;

    const statusInfo = window.deploymentManager.formatStatus(status.status);
    const statusEl = deploymentCard.querySelector('.deployment-status');

    if (statusEl) {
        statusEl.className = `deployment-status status-${statusInfo.color}`;
        statusEl.textContent = `${statusInfo.icon} ${statusInfo.text}`;
    }

    const slot = deploymentCard.querySelector('.deployment-url-slot');
    if (slot && (status.url || status.inspectorUrl)) {
        slot.innerHTML = deploymentUrlBlock(status);
    }
    const progressSlot = deploymentCard.querySelector('.deployment-progress-slot');
    if (progressSlot) {
        progressSlot.innerHTML = deploymentProgressBlock(status);
    }

    // Auto-redirect only when the live URL actually serves content.
    if (
        status.status === 'completed' &&
        status.url &&
        status.isPublic !== false &&
        !redirectedDeployments.has(executionId)
    ) {
        redirectedDeployments.add(executionId);
        showSuccess(`Deployment ready → opening ${status.url}`);
        try {
            const newTab = window.open(status.url, '_blank', 'noopener');
            if (!newTab) {
                // Popup blocked — fall back to same-window navigation after a short delay.
                setTimeout(() => { window.location.href = status.url; }, 1500);
            }
        } catch (_) {
            setTimeout(() => { window.location.href = status.url; }, 1500);
        }
    }

    if (status.status === 'failed' || status.status === 'cancelled') {
        setTimeout(() => {
            deploymentCard.remove();
            if (currentRepoForDeployment) {
                loadDeploymentHistory(currentRepoForDeployment.owner, currentRepoForDeployment.repo);
            }
        }, 3000);
    } else if (status.status === 'completed') {
        if (currentRepoForDeployment) {
            loadDeploymentHistory(currentRepoForDeployment.owner, currentRepoForDeployment.repo);
        }
        if (status.isPublic === false) {
            showError('Deploy finished on Vercel but the public URL is not reachable (404). Check build output and root directory, then redeploy.');
        }
    }
}

/**
 * Load deployment history
 */
async function loadDeploymentHistory(owner, repo) {
    try {
        const deployments = await window.deploymentManager.listDeployments(owner, repo, 5);
        
        if (deployments.length === 0) return;

        const historySection = document.getElementById('deploymentHistory');
        const historyList = document.getElementById('historyList');

        historyList.innerHTML = deployments.map(d => {
            const statusInfo = window.deploymentManager.formatStatus(d.status);
            const startTime = d.parameters?.timestamp || d.started_at;
            
            return `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-id">#${d.execution_id?.substring(0, 8) || 'N/A'}</span>
                        <span class="history-status status-${statusInfo.color}">
                            ${statusInfo.icon} ${statusInfo.text}
                        </span>
                    </div>
                    <div class="history-details">
                        <span>${escapeHtml(d.parameters?.branch || 'main')}</span>
                        <span>→</span>
                        <span>${escapeHtml(d.parameters?.environment || 'production')}</span>
                        <span>•</span>
                        <span>${formatRelativeTime(startTime)}</span>
                    </div>
                </div>
            `;
        }).join('');

        historySection.style.display = 'block';

    } catch (error) {
        console.error('Failed to load deployment history:', error);
    }
}

/**
 * Cancel a deployment
 */
window.cancelDeployment = async function(executionId) {
    if (!confirm('Cancel this deployment?')) return;

    try {
        await window.deploymentManager.cancelDeployment(executionId);
        showSuccess('Deployment cancelled');
    } catch (error) {
        showError('Failed to cancel deployment: ' + error.message);
    }
};

/**
 * Show success message
 */
function showSuccess(message) {
    // Create a temporary success notification
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp) {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// END DEPLOYMENT INTEGRATION
// ============================================

function handleFileTreeClick(e) {
    const fileRow = e.target.closest('.tree-item.file');
    if (fileRow && fileRow.dataset.path) {
        e.preventDefault();
        markSelectedFile(fileRow);
        loadFilePreview(fileRow.dataset.path);
        return;
    }

    const toggle = e.target.closest('.tree-toggle');
    if (toggle && !toggle.classList.contains('tree-toggle-spacer')) {
        e.preventDefault();
        const item = toggle.closest('.tree-item.folder');
        if (!item) return;
        const children = item.nextElementSibling;
        if (children && children.classList.contains('tree-children')) {
            item.classList.toggle('collapsed');
            toggle.classList.toggle('expanded');
        }
        return;
    }

    const folderRow = e.target.closest('.tree-item.folder');
    if (folderRow) {
        const children = folderRow.nextElementSibling;
        if (children && children.classList.contains('tree-children')) {
            folderRow.classList.toggle('collapsed');
            const t = folderRow.querySelector('.tree-toggle');
            if (t && !t.classList.contains('tree-toggle-spacer')) {
                t.classList.toggle('expanded');
            }
        }
    }
}

function handleFileTreeKeydown(e) {
    if (e.key !== 'Enter') return;
    const fileRow = e.target.closest('.tree-item.file');
    if (fileRow && fileRow.dataset.path) {
        e.preventDefault();
        markSelectedFile(fileRow);
        loadFilePreview(fileRow.dataset.path);
    }
}

// Fetch repository data from GitHub API (authenticated proxy or public API)
async function fetchRepository(owner, repo) {
    showLoading();

    try {
        await refreshAuthMode();

        if (useAuthenticatedApi && typeof Auth !== 'undefined') {
            const res = await Auth.apiFetch(`/api/github/repos/${owner}/${repo}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                if (res.status === 404) {
                    throw new Error('Repository not found or you do not have access.');
                }
                if (res.status === 401) {
                    throw new Error('Session expired. Connect GitHub again.');
                }
                throw new Error(body.error || `Failed to fetch repository (${res.status})`);
            }
            const payload = await res.json();
            currentRepo = payload.repo;
            explorerContext = { owner, repo, branch: payload.branch };
            displayResults(payload.repo, payload.tree);
            return;
        }

        const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`);

        if (!repoResponse.ok) {
            if (repoResponse.status === 404) {
                throw new Error('Repository not found. Please check the URL and try again.');
            } else if (repoResponse.status === 403) {
                throw new Error('GitHub API rate limit exceeded. Please try again later.');
            } else {
                throw new Error(`Failed to fetch repository: ${repoResponse.statusText}`);
            }
        }

        const repoData = await repoResponse.json();
        currentRepo = repoData;

        const defaultBranch = repoData.default_branch || 'main';
        let resolvedBranch = defaultBranch;
        let treeData = null;

        try {
            let treeResponse = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`
            );

            if (treeResponse.ok) {
                treeData = await treeResponse.json();
            } else {
                const masterResponse = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`
                );
                if (masterResponse.ok) {
                    treeData = await masterResponse.json();
                    resolvedBranch = 'master';
                }
            }
        } catch (error) {
            console.warn('Could not fetch file tree:', error);
        }

        explorerContext = { owner, repo, branch: resolvedBranch };

        displayResults(repoData, treeData);
        
        // Initialize deployment controls for engineer role
        initializeDeploymentControls(owner, repo);
    } catch (error) {
        showError(error.message);
    }
}

// Display repository results
function displayResults(repoData, treeData) {
    hideLoading();
    hideError();

    // Store current repo info for analysis
    currentOwner = repoData.owner.login;
    currentRepoName = repoData.name;

    const resultsSection = document.getElementById('resultsSection');
    resultsSection.style.display = 'block';

    // Show analysis panel
    const analysisPanel = document.getElementById('analysisPanel');
    if (analysisPanel) {
        analysisPanel.style.display = 'block';
    }

    document.getElementById('repoName').textContent = repoData.full_name;
    document.getElementById('repoLink').href = repoData.html_url;
    document.getElementById('repoStars').textContent = formatNumber(repoData.stargazers_count);
    document.getElementById('repoForks').textContent = formatNumber(repoData.forks_count);
    document.getElementById('repoWatchers').textContent = formatNumber(repoData.watchers_count);

    const description = repoData.description || 'No description provided';
    document.getElementById('repoDescription').textContent = description;

    const languageEl = document.getElementById('repoLanguage');
    if (repoData.language) {
        languageEl.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px;">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            </svg>
            ${repoData.language}
        `;
        languageEl.style.display = 'flex';
    } else {
        languageEl.style.display = 'none';
    }

    const licenseEl = document.getElementById('repoLicense');
    if (repoData.license) {
        licenseEl.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px;">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2"/>
                <path d="M12 16V12M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            ${repoData.license.name}
        `;
        licenseEl.style.display = 'flex';
    } else {
        licenseEl.style.display = 'none';
    }

    const updatedEl = document.getElementById('repoUpdated');
    const updatedDate = new Date(repoData.updated_at);
    updatedEl.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px;">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Updated ${formatRelativeTime(updatedDate)}
    `;

    resetPreviewPanel();

    if (treeData && treeData.tree) {
        displayFileTree(treeData.tree);
    } else {
        document.getElementById('fileTree').innerHTML = `
            <p style="color: var(--text-tertiary); text-align: center; padding: 40px;">
                File structure not available
            </p>
        `;
        document.getElementById('fileCount').textContent = 'N/A';
    }

    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Display file tree structure
function displayFileTree(files) {
    const fileTree = document.getElementById('fileTree');
    const fileCount = document.getElementById('fileCount');

    const fileCountNum = files.filter((f) => f.type === 'blob').length;
    fileCount.textContent = `${fileCountNum} file${fileCountNum !== 1 ? 's' : ''}`;

    const tree = buildTreeStructure(files);
    fileTree.innerHTML = renderTree(tree);

    if (fileTreeAbort) fileTreeAbort.abort();
    fileTreeAbort = new AbortController();
    const { signal } = fileTreeAbort;

    fileTree.addEventListener('click', handleFileTreeClick, { signal });
    fileTree.addEventListener('keydown', handleFileTreeKeydown, { signal });
}

// Build hierarchical tree structure from flat file list
function buildTreeStructure(files) {
    const root = { name: '', type: 'tree', children: {} };

    files.forEach((file) => {
        const parts = file.path.split('/');
        let current = root;

        parts.forEach((part, index) => {
            if (index === parts.length - 1) {
                if (file.type === 'blob') {
                    if (!current.children[part]) {
                        current.children[part] = {
                            name: part,
                            type: 'blob',
                            path: file.path,
                        };
                    }
                }
            } else {
                if (!current.children[part]) {
                    current.children[part] = {
                        name: part,
                        type: 'tree',
                        children: {},
                    };
                }
                current = current.children[part];
            }
        });
    });

    return root;
}

// Render tree structure as HTML (folders grouped for clearer hierarchy)
function renderTree(node, level = 0) {
    if (!node.children) return '';

    const entries = Object.values(node.children).sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'tree' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    let html = '';

    entries.forEach((entry) => {
        const isFolder = entry.type === 'tree';
        const icon = getFileIcon(entry.name, isFolder);
        const hasChildren = isFolder && Object.keys(entry.children || {}).length > 0;

        if (isFolder) {
            html += `<div class="tree-folder-group">`;
            html += `
            <div class="tree-item folder${hasChildren ? ' collapsed' : ''}" data-level="${level}">
                ${hasChildren ? '<span class="tree-toggle" tabindex="-1">▶</span>' : '<span class="tree-toggle tree-toggle-spacer" aria-hidden="true">▶</span>'}
                <span class="tree-icon">${icon}</span>
                <span class="tree-name">${escapeHtml(entry.name)}</span>
            </div>
        `;
            if (hasChildren) {
                html += `<div class="tree-children">${renderTree(entry, level + 1)}</div>`;
            }
            html += `</div>`;
        } else {
            html += `
            <div class="tree-item file" data-level="${level}" data-path="${escapeHtmlAttr(entry.path)}" tabindex="0">
                <span class="tree-toggle tree-toggle-spacer" aria-hidden="true">▶</span>
                <span class="tree-icon">${icon}</span>
                <span class="tree-name">${escapeHtml(entry.name)}</span>
            </div>
        `;
        }
    });

    return html;
}

// Get appropriate icon for file/folder
function getFileIcon(name, isFolder) {
    if (isFolder) return '📁';

    const ext = name.split('.').pop().toLowerCase();
    const iconMap = {
        js: '📜',
        jsx: '⚛️',
        ts: '📘',
        tsx: '⚛️',
        py: '🐍',
        java: '☕',
        cpp: '⚙️',
        c: '⚙️',
        go: '🐹',
        rs: '🦀',
        php: '🐘',
        rb: '💎',
        swift: '🦅',
        kt: '🎯',
        scala: '📊',
        html: '🌐',
        css: '🎨',
        scss: '🎨',
        sass: '🎨',
        vue: '💚',
        svelte: '🧡',
        json: '📋',
        xml: '📋',
        yaml: '📋',
        yml: '📋',
        csv: '📊',
        sql: '🗄️',
        md: '📝',
        txt: '📄',
        pdf: '📕',
        doc: '📘',
        docx: '📘',
        env: '⚙️',
        config: '⚙️',
        conf: '⚙️',
        gitignore: '🚫',
        dockerignore: '🚫',
        png: '🖼️',
        jpg: '🖼️',
        jpeg: '🖼️',
        gif: '🖼️',
        svg: '🎨',
        ico: '🖼️',
        sh: '🔧',
        bash: '🔧',
        dockerfile: '🐳',
        lock: '🔒',
        zip: '📦',
        tar: '📦',
        gz: '📦',
    };

    return iconMap[ext] || '📄';
}

// Show loading state
function showLoading() {
    explorerContext = null;
    resetPreviewPanel();

    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
}

// Hide loading state
function hideLoading() {
    document.getElementById('loadingState').style.display = 'none';
}

// Show error state
function showError(message) {
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
}

// Hide error state
function hideError() {
    document.getElementById('errorState').style.display = 'none';
}

// Reset analysis (for try again button)
function resetAnalysis() {
    hideError();
    document.getElementById('repoUrl').focus();
}

// Format large numbers (1500 -> 1.5k)
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// Format relative time (e.g., "2 days ago")
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) {
        return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    } else if (diffMonths > 0) {
        return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    } else if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMins > 0) {
        return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else {
        return 'just now';
    }
}
