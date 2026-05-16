import { Router } from 'express';
import { fetchRepoWithTree } from '../github.js';
import { analyzeRepository, generateDocument } from '../analyzer.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { isWatsonxConfigured } from '../watsonx.js';

const router = Router();

const VALID_AUDIENCES = [
  'ceo',
  'product_manager',
  'engineering_manager',
  'software_engineer',
  'designer',
  'beginner',
  'investor',
];

function respondWithError(res, err, { notFoundMessage, rateLimitMessage } = {}) {
  if (err.status === 404) {
    return res.status(404).json({ error: notFoundMessage });
  }
  if (err.status === 403) {
    return res.status(403).json({ error: rateLimitMessage });
  }

  const status = err.status || 500;
  const payload = { error: err.message || 'Failed to analyze repository' };
  if (err.details) payload.details = err.details;
  return res.status(status).json(payload);
}

async function handleAnalyzeRequest(req, res, accessToken) {
  const { owner, repo, audience } = req.body;

  if (!owner || !repo) {
    return res.status(400).json({ error: 'Owner and repo are required' });
  }

  if (!audience) {
    return res.status(400).json({ error: 'Audience is required' });
  }

  if (!VALID_AUDIENCES.includes(audience)) {
    return res.status(400).json({
      error: `Invalid audience. Must be one of: ${VALID_AUDIENCES.join(', ')}`,
    });
  }

  if (!isWatsonxConfigured()) {
    return res.status(503).json({
      error:
        'IBM watsonx.ai WML is not configured. Set WATSONX_WML_API_KEY and WATSONX_WML_PROJECT_ID in .env, then restart the server.',
    });
  }

  const { repo: repoData, tree: treeData, branch } = await fetchRepoWithTree(
    accessToken,
    owner,
    repo
  );

  if (!treeData?.tree) {
    return res.status(400).json({ error: 'Could not fetch repository file tree' });
  }

  const analysisData = await analyzeRepository(
    accessToken,
    owner,
    repo,
    repoData,
    treeData,
    branch
  );

  const document = await generateDocument(audience, analysisData);

  res.json({
    success: true,
    analysis: {
      technologies: analysisData.tech.technologies,
      frameworks: analysisData.tech.frameworks,
      tools: analysisData.tech.tools,
      architecture: analysisData.architecture,
      importantFiles: analysisData.importantFiles,
    },
    document,
    metadata: {
      owner,
      repo,
      audience,
      analyzedAt: new Date().toISOString(),
      generatedBy: document.generatedBy,
      model: document.model,
    },
  });
}

/**
 * Analyze repository and generate audience-specific document
 * POST /api/analyze
 * Body: { owner, repo, audience }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    await handleAnalyzeRequest(req, res, req.session.githubAccessToken);
  } catch (err) {
    console.error('Analysis error:', err);
    respondWithError(res, err, {
      notFoundMessage: 'Repository not found or you do not have access.',
      rateLimitMessage:
        'GitHub API rate limit exceeded. Try again later or connect GitHub for higher limits.',
    });
  }
});

/**
 * Analyze repository without authentication (public repos only)
 * POST /api/analyze/public
 * Body: { owner, repo, audience }
 */
router.post('/public', async (req, res) => {
  try {
    await handleAnalyzeRequest(req, res, null);
  } catch (err) {
    console.error('Public analysis error:', err);
    respondWithError(res, err, {
      notFoundMessage: 'Repository not found.',
      rateLimitMessage:
        'GitHub API rate limit exceeded. Try again later or connect GitHub for higher limits.',
    });
  }
});

export default router;
