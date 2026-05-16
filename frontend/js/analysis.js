// GitHub Repository Reader
// Handles URL validation, GitHub API calls, and UI updates

// State management
let currentRepo = null;
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
    } catch (error) {
        showError(error.message);
    }
}

// Display repository results
function displayResults(repoData, treeData) {
    hideLoading();
    hideError();

    const resultsSection = document.getElementById('resultsSection');
    resultsSection.style.display = 'block';

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
