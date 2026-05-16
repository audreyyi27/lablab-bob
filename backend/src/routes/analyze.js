import { Router } from 'express';
import { fetchRepoWithTree } from '../github.js';
import { analyzeRepository, generateDocument } from '../analyzer.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

/**
 * Analyze repository and generate audience-specific document
 * POST /api/analyze
 * Body: { owner, repo, audience }
 */
router.post('/', requireAuth, async (req, res) => {
  const { owner, repo, audience } = req.body;

  if (!owner || !repo) {
    return res.status(400).json({ error: 'Owner and repo are required' });
  }

  if (!audience) {
    return res.status(400).json({ error: 'Audience is required' });
  }

  const validAudiences = [
    'ceo',
    'product_manager',
    'engineering_manager',
    'software_engineer',
    'designer',
    'beginner',
    'investor',
  ];

  if (!validAudiences.includes(audience)) {
    return res.status(400).json({
      error: `Invalid audience. Must be one of: ${validAudiences.join(', ')}`,
    });
  }

  try {
    // Fetch repository data and file tree
    const { repo: repoData, tree: treeData, branch } = await fetchRepoWithTree(
      req.session.githubAccessToken,
      owner,
      repo
    );

    if (!treeData || !treeData.tree) {
      return res.status(400).json({
        error: 'Could not fetch repository file tree',
      });
    }

    // Analyze repository
    const analysisData = await analyzeRepository(
      req.session.githubAccessToken,
      owner,
      repo,
      repoData,
      treeData,
      branch
    );

    // Generate audience-specific document (with AI if configured)
    const document = await generateDocument(audience, analysisData);

    // Return analysis and document
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
        generatedBy: document.generatedBy || 'template',
        model: document.model || 'Built-in templates',
      },
    });
  } catch (err) {
    console.error('Analysis error:', err);
    const status = err.status === 404 ? 404 : err.status || 500;
    res.status(status).json({
      error:
        status === 404
          ? 'Repository not found or you do not have access.'
          : err.message || 'Failed to analyze repository',
    });
  }
});

/**
 * Analyze repository without authentication (public repos only)
 * POST /api/analyze/public
 * Body: { owner, repo, audience }
 */
router.post('/public', async (req, res) => {
  const { owner, repo, audience } = req.body;

  if (!owner || !repo) {
    return res.status(400).json({ error: 'Owner and repo are required' });
  }

  if (!audience) {
    return res.status(400).json({ error: 'Audience is required' });
  }

  const validAudiences = [
    'ceo',
    'product_manager',
    'engineering_manager',
    'software_engineer',
    'designer',
    'beginner',
    'investor',
  ];

  if (!validAudiences.includes(audience)) {
    return res.status(400).json({
      error: `Invalid audience. Must be one of: ${validAudiences.join(', ')}`,
    });
  }

  try {
    // Fetch repository data and file tree (no auth token)
    const { repo: repoData, tree: treeData, branch } = await fetchRepoWithTree(
      null,
      owner,
      repo
    );

    if (!treeData || !treeData.tree) {
      return res.status(400).json({
        error: 'Could not fetch repository file tree',
      });
    }

    // Analyze repository
    const analysisData = await analyzeRepository(
      null,
      owner,
      repo,
      repoData,
      treeData,
      branch
    );

    // Generate audience-specific document (with AI if configured)
    const document = await generateDocument(audience, analysisData);

    // Return analysis and document
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
        generatedBy: document.generatedBy || 'template',
        model: document.model || 'Built-in templates',
      },
    });
  } catch (err) {
    console.error('Public analysis error:', err);
    const status = err.status === 404 ? 404 : err.status || 500;
    res.status(status).json({
      error:
        status === 404
          ? 'Repository not found.'
          : status === 403
          ? 'GitHub API rate limit exceeded. Try again later or connect GitHub for higher limits.'
          : err.message || 'Failed to analyze repository',
    });
  }
});

export default router;

// Made with Bob
