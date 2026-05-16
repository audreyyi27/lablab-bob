import express from 'express';
import { watsonxClient } from '../watsonx.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { githubFetch } from '../github.js';

const router = express.Router();

/**
 * Trigger a deployment for a repository
 * POST /api/deployment/trigger
 */
router.post('/trigger', requireAuth, async (req, res) => {
  try {
    const { owner, repo, branch, environment, deploymentType } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({ error: 'Owner and repo are required' });
    }

    // Get repository information from GitHub
    const repoData = await githubFetch(
      `/repos/${owner}/${repo}`,
      req.session.accessToken
    );

    // Trigger deployment via Watsonx Orchestrate
    const deployment = await watsonxClient.triggerDeployment({
      repository: repo,
      owner,
      branch: branch || repoData.default_branch || 'main',
      environment: environment || 'production',
      deploymentType: deploymentType || 'auto',
    });

    res.json({
      success: true,
      deployment: {
        id: deployment.execution_id || deployment.id,
        status: deployment.status || 'initiated',
        repository: `${owner}/${repo}`,
        branch: branch || repoData.default_branch || 'main',
        environment: environment || 'production',
        triggeredAt: new Date().toISOString(),
        triggeredBy: req.session.user?.login || 'engineer',
      },
    });
  } catch (error) {
    console.error('Deployment trigger error:', error);
    res.status(500).json({
      error: 'Failed to trigger deployment',
      message: error.message,
    });
  }
});

/**
 * Get deployment status
 * GET /api/deployment/status/:executionId
 */
router.get('/status/:executionId', requireAuth, async (req, res) => {
  try {
    const { executionId } = req.params;

    const status = await watsonxClient.getDeploymentStatus(executionId);

    res.json({
      success: true,
      deployment: {
        id: executionId,
        status: status.status || 'unknown',
        startedAt: status.started_at,
        completedAt: status.completed_at,
        duration: status.duration,
        logs: status.logs || [],
        result: status.result,
      },
    });
  } catch (error) {
    console.error('Get deployment status error:', error);
    res.status(500).json({
      error: 'Failed to get deployment status',
      message: error.message,
    });
  }
});

/**
 * List deployments for a repository
 * GET /api/deployment/list/:owner/:repo
 */
router.get('/list/:owner/:repo', requireAuth, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const deployments = await watsonxClient.listDeployments(owner, repo, limit);

    res.json({
      success: true,
      deployments: deployments.executions || [],
      total: deployments.total || 0,
    });
  } catch (error) {
    console.error('List deployments error:', error);
    res.status(500).json({
      error: 'Failed to list deployments',
      message: error.message,
    });
  }
});

/**
 * Cancel a running deployment
 * POST /api/deployment/cancel/:executionId
 */
router.post('/cancel/:executionId', requireAuth, async (req, res) => {
  try {
    const { executionId } = req.params;

    const result = await watsonxClient.cancelDeployment(executionId);

    res.json({
      success: true,
      message: 'Deployment cancelled successfully',
      deployment: {
        id: executionId,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Cancel deployment error:', error);
    res.status(500).json({
      error: 'Failed to cancel deployment',
      message: error.message,
    });
  }
});

/**
 * AI-powered deployment analysis
 * POST /api/deployment/analyze
 */
router.post('/analyze', requireAuth, async (req, res) => {
  try {
    const { owner, repo } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({ error: 'Owner and repo are required' });
    }

    // Get repository data
    const repoData = await githubFetch(
      `/repos/${owner}/${repo}`,
      req.session.accessToken
    );

    // Get recent commits
    const commits = await githubFetch(
      `/repos/${owner}/${repo}/commits?per_page=10`,
      req.session.accessToken
    );

    // Analyze deployment readiness
    const analysis = await watsonxClient.analyzeDeploymentReadiness({
      name: repo,
      owner,
      commits: commits.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author.name,
        date: c.commit.author.date,
      })),
    });

    res.json({
      success: true,
      analysis: {
        ready: analysis.ready !== false,
        confidence: analysis.confidence || 0.8,
        recommendations: analysis.recommendations || [],
        risks: analysis.risks || [],
        estimatedDuration: analysis.estimated_duration || '5-10 minutes',
      },
    });
  } catch (error) {
    console.error('Deployment analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze deployment',
      message: error.message,
    });
  }
});

/**
 * Webhook handler for GitHub events
 * POST /api/deployment/webhook
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    const payload = req.body;

    // Handle push events for auto-deployment
    if (event === 'push') {
      const { repository, ref, pusher } = payload;
      const branch = ref.replace('refs/heads/', '');

      // Only auto-deploy on main/master branch
      if (branch === 'main' || branch === 'master') {
        console.log(`Auto-deployment triggered for ${repository.full_name}`);

        // Trigger deployment asynchronously
        watsonxClient
          .triggerDeployment({
            repository: repository.name,
            owner: repository.owner.login,
            branch,
            environment: 'production',
            deploymentType: 'webhook',
          })
          .then((deployment) => {
            console.log(`Deployment initiated: ${deployment.execution_id}`);
          })
          .catch((error) => {
            console.error('Webhook deployment error:', error);
          });
      }
    }

    res.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message,
    });
  }
});

export default router;

// Made with Bob
