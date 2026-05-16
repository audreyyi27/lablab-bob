// GitHub OAuth UI — token stays on server; browser only uses session cookie.

const Auth = (function () {
  let sessionCache = null;
  let reposCache = null;

  function apiUrl(path) {
    const base = window.REPOTALK_API_BASE || '';
    return `${base}${path}`;
  }

  async function apiFetch(path, options = {}) {
    const res = await fetch(apiUrl(path), {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
    return res;
  }

  async function getSession(forceRefresh = false) {
    if (!forceRefresh && sessionCache) return sessionCache;

    try {
      const res = await apiFetch('/api/auth/session');
      if (!res.ok) {
        sessionCache = { authenticated: false };
        return sessionCache;
      }
      sessionCache = await res.json();
      return sessionCache;
    } catch {
      sessionCache = { authenticated: false };
      return sessionCache;
    }
  }

  function isAuthenticated() {
    return Boolean(sessionCache?.authenticated);
  }

  function connectGitHub() {
    window.location.href = apiUrl('/api/auth/github/login');
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    sessionCache = { authenticated: false };
    reposCache = null;
    updateAuthUI();
    hideRepoPicker();
    if (typeof window.onGitHubDisconnected === 'function') {
      window.onGitHubDisconnected();
    }
  }

  async function loadRepos() {
    const res = await apiFetch('/api/auth/repos');
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to load your repositories');
    }
    const data = await res.json();
    reposCache = data.repos || [];
    return reposCache;
  }

  function updateAuthUI() {
    const disconnected = document.getElementById('authDisconnected');
    const connected = document.getElementById('authConnected');
    const userLogin = document.getElementById('authUserLogin');
    const userAvatar = document.getElementById('authUserAvatar');

    if (!disconnected || !connected) return;

    if (sessionCache?.authenticated) {
      disconnected.style.display = 'none';
      connected.style.display = 'flex';
      if (userLogin) userLogin.textContent = sessionCache.user?.name || sessionCache.user?.login || 'GitHub user';
      if (userAvatar && sessionCache.user?.avatar_url) {
        userAvatar.src = sessionCache.user.avatar_url;
        userAvatar.alt = sessionCache.user.login || 'GitHub avatar';
      }
    } else {
      disconnected.style.display = 'flex';
      connected.style.display = 'none';
    }
  }

  function showRepoPicker() {
    const picker = document.getElementById('repoPicker');
    if (picker) picker.style.display = 'block';
  }

  function hideRepoPicker() {
    const picker = document.getElementById('repoPicker');
    if (picker) picker.style.display = 'none';
    const list = document.getElementById('repoList');
    if (list) list.innerHTML = '';
  }

  function renderRepoList(repos, filter = '') {
    const listEl = document.getElementById('repoList');
    const emptyEl = document.getElementById('repoListEmpty');
    if (!listEl) return;

    const q = filter.trim().toLowerCase();
    const filtered = q
      ? repos.filter(
          (r) =>
            r.full_name.toLowerCase().includes(q) ||
            (r.description && r.description.toLowerCase().includes(q))
        )
      : repos;

    if (emptyEl) {
      emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';
    }

    listEl.innerHTML = filtered
      .map(
        (repo) => `
      <button type="button" class="repo-list-item" data-owner="${escapeAttr(repo.owner)}" data-repo="${escapeAttr(repo.name)}" data-full="${escapeAttr(repo.full_name)}">
        <span class="repo-list-icon">${repo.private ? '🔒' : '📦'}</span>
        <span class="repo-list-main">
          <span class="repo-list-name">${escapeHtml(repo.full_name)}</span>
          ${repo.description ? `<span class="repo-list-desc">${escapeHtml(repo.description)}</span>` : ''}
        </span>
        ${repo.language ? `<span class="repo-list-lang">${escapeHtml(repo.language)}</span>` : ''}
      </button>
    `
      )
      .join('');

    listEl.querySelectorAll('.repo-list-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const owner = btn.dataset.owner;
        const repo = btn.dataset.repo;
        const full = btn.dataset.full;
        document.getElementById('repoUrl').value = full;
        if (typeof window.onAuthenticatedRepoSelect === 'function') {
          window.onAuthenticatedRepoSelect(owner, repo);
        }
      });
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;');
  }

  async function refreshAfterLogin() {
    sessionCache = null;
    await getSession(true);
    updateAuthUI();

    if (!sessionCache.authenticated) return;

    showRepoPicker();
    const loadingEl = document.getElementById('repoListLoading');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
      const repos = await loadRepos();
      renderRepoList(repos);
    } catch (err) {
      if (typeof window.showAnalysisError === 'function') {
        window.showAnalysisError(err.message);
      }
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  function handleAuthQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    const connected = params.get('connected');

    if (authError && typeof window.showAnalysisError === 'function') {
      window.showAnalysisError(`GitHub login failed: ${authError}`);
    }

    if (authError || connected) {
      params.delete('auth_error');
      params.delete('connected');
      const qs = params.toString();
      const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
      window.history.replaceState({}, '', next);
    }

    return Boolean(connected);
  }

  async function init() {
    const justConnected = handleAuthQueryParams();

    const connectBtn = document.getElementById('connectGithubBtn');
    const disconnectBtn = document.getElementById('disconnectGithubBtn');
    const searchInput = document.getElementById('repoSearch');

    connectBtn?.addEventListener('click', connectGitHub);
    disconnectBtn?.addEventListener('click', () => logout());

    searchInput?.addEventListener('input', () => {
      if (reposCache) renderRepoList(reposCache, searchInput.value);
    });

    await getSession();
    updateAuthUI();

    if (sessionCache.authenticated) {
      await refreshAfterLogin();
    } else if (justConnected) {
      await refreshAfterLogin();
    }
  }

  return {
    init,
    getSession,
    isAuthenticated,
    connectGitHub,
    logout,
    apiUrl,
    apiFetch,
  };
})();
