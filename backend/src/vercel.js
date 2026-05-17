// Vercel deploy provider for the Continuous Delivery panel.
//
// Required environment:
//   VERCEL_TOKEN     — personal/team token from https://vercel.com/account/tokens
//   VERCEL_TEAM_ID   — optional team id (e.g. team_xxx); omit for personal scope
//
// Flow when CD is triggered with a GitHub repo (owner/repo):
//   1. Look up the repo in the Vercel-GitHub integration to get the numeric
//      repoId and default branch.
//   2. Find or create a Vercel project linked to that GitHub repo.
//   3. Create a production deployment from the chosen branch.
//   4. Poll until READY / ERROR / CANCELED and surface the production URL.

import { config } from './config.js';

const VERCEL_API = 'https://api.vercel.com';

export function isVercelConfigured() {
  return Boolean(config.vercel.token);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${config.vercel.token}`,
    'Content-Type': 'application/json',
  };
}

function teamParam(prefix = '?') {
  if (!config.vercel.teamId) return '';
  return `${prefix}teamId=${encodeURIComponent(config.vercel.teamId)}`;
}

function appendTeam(query) {
  // `query` may be '' or '?foo=bar'.
  if (!config.vercel.teamId) return query;
  return query ? `${query}&teamId=${encodeURIComponent(config.vercel.teamId)}` : `?teamId=${encodeURIComponent(config.vercel.teamId)}`;
}

async function vfetch(pathAndQuery, init = {}) {
  const url = `${VERCEL_API}${pathAndQuery}`;
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      (body && body.error && body.error.message) ||
      (typeof body === 'string' ? body : response.statusText);
    const err = new Error(`Vercel ${response.status} ${response.statusText}: ${message}`);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  return body;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'app';
}

async function resolveGithubRepo(owner, repo) {
  const query = encodeURIComponent(repo);
  const data = await vfetch(
    `/v1/integrations/search-repo?provider=github&query=${query}`
  );
  const matches = (data && data.repos) || [];
  const match = matches.find(
    (r) =>
      String(r.namespace || '').toLowerCase() === owner.toLowerCase() &&
      String(r.name || r.slug || '').toLowerCase() === repo.toLowerCase()
  );

  if (!match) {
    throw new Error(
      `Vercel cannot see ${owner}/${repo}. Install the Vercel GitHub app for that repo at https://vercel.com/account/integrations.`
    );
  }

  return {
    repoId: match.id,
    defaultBranch: match.defaultBranch || 'main',
    namespace: match.namespace,
    repo: match.name || match.slug,
  };
}

async function findProject(name) {
  try {
    return await vfetch(`/v9/projects/${encodeURIComponent(name)}${teamParam('?')}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function getProject(name) {
  return vfetch(`/v9/projects/${encodeURIComponent(name)}${teamParam('?')}`);
}

async function createProject(name, owner, repo) {
  return vfetch(`/v10/projects${teamParam('?')}`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      gitRepository: { type: 'github', repo: `${owner}/${repo}` },
    }),
  });
}

async function getOrCreateProject(projectName, owner, repo) {
  const existing = await findProject(projectName);
  if (existing) return existing;
  return createProject(projectName, owner, repo);
}

/**
 * Trigger a production deployment from a GitHub repo.
 *
 * Returns { deployment, project, repoInfo } where deployment is the raw
 * Vercel API response (uid, url, readyState, inspectorUrl …).
 */
export async function deployFromGithub({ owner, repo, branch, projectName, target = 'production' }) {
  if (!isVercelConfigured()) {
    throw new Error('Vercel is not configured. Set VERCEL_TOKEN in .env.');
  }

  const slug = slugify(projectName || `${owner}-${repo}`);
  const repoInfo = await resolveGithubRepo(owner, repo);
  const ref = branch || repoInfo.defaultBranch || 'main';

  const project = await getOrCreateProject(slug, owner, repo);

  const body = {
    name: project.name,
    project: project.id,
    target,
    gitSource: {
      type: 'github',
      ref,
      repoId: repoInfo.repoId,
      org: owner,
      repo,
    },
  };

  const deployment = await vfetch(
    `/v13/deployments${appendTeam('?forceNew=1&skipAutoDetectionConfirmation=1')}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  return { deployment, project, repoInfo };
}

export async function getDeployment(uid) {
  return vfetch(`/v13/deployments/${encodeURIComponent(uid)}${teamParam('?')}`);
}

/**
 * Fetch the raw build log events for a deployment.
 */
export async function getDeploymentEvents(uid) {
  return vfetch(
    `/v3/deployments/${encodeURIComponent(uid)}/events${appendTeam('?builds=1')}`
  );
}

// Strip ANSI color codes from log output so the heuristic can match cleanly.
const ANSI_RE = /\x1b\[[0-9;]*m/g;

/**
 * Extract a short, human-readable error message from the build logs.
 * Prefers high-signal patterns (UNRESOLVED_ENTRY, "Cannot resolve",
 * "command not found", "ENOENT", etc.) over the generic "exited with 1".
 */
export function summarizeBuildError(events) {
  if (!Array.isArray(events)) return null;

  const lines = events
    .map((e) => ((e && (e.text || e.payload?.text)) || '').replace(ANSI_RE, ''))
    .filter((t) => t && t.trim());

  // High-signal patterns first.
  const highSignal = [
    /UNRESOLVED_ENTRY[^]*?(?=\n|$)/,
    /Cannot resolve entry module[^\n]*/i,
    /Could not resolve entry[^\n]*/i,
    /ENOENT[^\n]*(?:package\.json|index\.html)?[^\n]*/i,
    /(?:next|vite|nuxt|react-scripts|svelte-kit): command not found[^\n]*/i,
    /Cannot find module ['"][^'"]+['"][^\n]*/i,
    /No Output Directory named ['"][^'"]+['"][^\n]*/i,
    /missing script: [^\n]+/i,
    /No build script[^\n]*/i,
  ];

  for (const pattern of highSignal) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = lines[i].match(pattern);
      if (m) return m[0].trim().slice(0, 600);
    }
  }

  // Otherwise the last "Error:" line.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^Error:?\s/i.test(lines[i].trim())) {
      return lines[i].trim().slice(0, 600);
    }
  }

  // Fallback: last non-empty line.
  return lines[lines.length - 1]?.trim().slice(0, 600) || null;
}

/**
 * Patch project settings (e.g. rootDirectory, framework, buildCommand).
 */
export async function updateProject(projectIdOrName, patch) {
  return vfetch(
    `/v9/projects/${encodeURIComponent(projectIdOrName)}${teamParam('?')}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  );
}

/**
 * Re-deploy an existing project from the same GitHub source.
 */
export async function redeployProject({ project, owner, repo, branch, repoId }) {
  const body = {
    name: project.name,
    project: project.id,
    target: 'production',
    gitSource: {
      type: 'github',
      ref: branch || 'main',
      repoId,
      org: owner,
      repo,
    },
  };

  return vfetch(
    `/v13/deployments${appendTeam('?forceNew=1&skipAutoDetectionConfirmation=1')}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

/**
 * Map Vercel readyState → the status vocabulary used by the CD UI.
 */
export function mapState(readyState) {
  switch ((readyState || '').toUpperCase()) {
    case 'QUEUED':
    case 'INITIALIZING':
      return 'initiated';
    case 'BUILDING':
    case 'ANALYZING':
    case 'UPLOADING':
      return 'running';
    case 'READY':
      return 'completed';
    case 'ERROR':
      return 'failed';
    case 'CANCELED':
      return 'cancelled';
    default:
      return 'running';
  }
}

export function productionUrl(deployment, project) {
  // Prefer the project's stable production alias if present.
  const alias = project?.alias?.find?.((a) => a.domain)?.domain;
  if (alias) return `https://${alias}`;
  if (deployment?.url) return `https://${deployment.url}`;
  return null;
}

export function inspectorUrl(deployment) {
  if (!deployment) return null;
  if (deployment.inspectorUrl) return deployment.inspectorUrl;
  const id = deployment.id || deployment.uid;
  if (id) return `https://vercel.com/_/deployments/${id}`;
  return null;
}

export function deploymentId(deployment) {
  return deployment?.id || deployment?.uid || null;
}
