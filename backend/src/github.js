const GITHUB_API = 'https://api.github.com';

export async function githubFetch(path, accessToken, options = {}) {
  const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'RepoTalk',
    ...options.headers,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function fetchUserRepos(accessToken) {
  const repos = [];
  let page = 1;

  while (page <= 5) {
    const batch = await githubFetch(
      `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
      accessToken
    );
    if (!batch?.length) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return repos;
}

export async function fetchRepoWithTree(accessToken, owner, repo) {
  const repoData = await githubFetch(`/repos/${owner}/${repo}`, accessToken);
  const defaultBranch = repoData.default_branch || 'main';
  let resolvedBranch = defaultBranch;
  let treeData = null;

  try {
    treeData = await githubFetch(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
      accessToken
    );
  } catch (err) {
    if (err.status === 404 && defaultBranch !== 'master') {
      treeData = await githubFetch(
        `/repos/${owner}/${repo}/git/trees/master?recursive=1`,
        accessToken
      );
      resolvedBranch = 'master';
    } else if (err.status !== 404) {
      throw err;
    }
  }

  return { repo: repoData, tree: treeData, branch: resolvedBranch };
}

export async function fetchRepoContents(accessToken, owner, repo, filePath, ref) {
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  return githubFetch(
    `/repos/${owner}/${repo}/contents/${encodedPath}${query}`,
    accessToken
  );
}
