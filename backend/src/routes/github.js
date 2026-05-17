import { Router } from 'express';
import { fetchRepoContents, fetchRepoWithTree } from '../github.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);

router.get('/repos/:owner/:repo', async (req, res) => {
  const { owner, repo } = req.params;

  try {
    const payload = await fetchRepoWithTree(
      req.session.githubAccessToken,
      owner,
      repo
    );
    res.json(payload);
  } catch (err) {
    console.error('Fetch repo error:', err);
    const status = err.status === 404 ? 404 : err.status || 500;
    res.status(status).json({
      error:
        status === 404
          ? 'Repository not found or you do not have access.'
          : err.message || 'Failed to fetch repository',
    });
  }
});

router.get('/repos/:owner/:repo/contents/*', async (req, res) => {
  const { owner, repo } = req.params;
  const filePath = req.params[0];
  const ref = req.query.ref;

  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  try {
    const data = await fetchRepoContents(
      req.session.githubAccessToken,
      owner,
      repo,
      filePath,
      ref
    );
    res.json(data);
  } catch (err) {
    console.error('Fetch contents error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch file' });
  }
});

export default router;
