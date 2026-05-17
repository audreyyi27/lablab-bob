import express from 'express';
import { watsonxClient } from '../watsonx.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { githubFetch } from '../github.js';
import { isVercelConfigured } from '../vercel.js';

const router = express.Router();

/**
 * Report watsonx Orchestrate connection status (auth + workspace probe).
 * GET /api/deployment/connection
 */
router.get('/connection', async (_req, res) => {
  try {
    const status = await watsonxClient.verifyConnection();
    const vercelReady = isVercelConfigured();
    res.json({
      success: true,
      connection: status,
      vercel: {
        configured: vercelReady,
        message: vercelReady
          ? 'Vercel CD active — deploys run via GitHub (your repos) or tarball upload (any public repo). Does not require Orchestrate workspace role.'
          : 'Set VERCEL_TOKEN in .env to enable real deployments.',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to verify watsonx connection',
      message: error.message,
    });
  }
});

/**
 * Trigger a deployment for a repository
 * POST /api/deployment/trigger
 */
router.post('/trigger', async (req, res) => {
  try {
    const { owner, repo, branch, environment, deploymentType } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({ error: 'Owner and repo are required' });
    }

    const ghToken = req.session?.githubAccessToken || null;

    let defaultBranch = null;
    try {
      const repoData = await githubFetch(`/repos/${owner}/${repo}`, ghToken);
      defaultBranch = repoData?.default_branch || null;
    } catch (err) {
      console.warn(
        `[deployment] could not resolve default branch for ${owner}/${repo}: ${err.message}`
      );
    }

    const resolvedBranch = branch || defaultBranch || 'main';
    const resolvedEnv = environment || 'production';

    const deployment = await watsonxClient.triggerDeployment({
      repository: repo,
      owner,
      branch: resolvedBranch,
      environment: resolvedEnv,
      deploymentType: deploymentType || 'auto',
      triggeredBy: req.session?.user?.login || 'engineer',
      accessToken: ghToken,
    });

    res.json({
      success: true,
      deployment: {
        id: deployment.execution_id || deployment.id,
        status: deployment.status || 'initiated',
        repository: `${owner}/${repo}`,
        branch: resolvedBranch,
        environment: resolvedEnv,
        triggeredAt: new Date().toISOString(),
        triggeredBy: req.session.user?.login || 'engineer',
        provider: deployment.provider || 'simulated',
        deployMethod: deployment.deployMethod || null,
        url: deployment.publicUrl || deployment.url || null,
        publicUrl: deployment.publicUrl || deployment.url || null,
        isPublic: deployment.isPublic ?? false,
        siteHealthy: deployment.siteHealthy ?? null,
        inspectorUrl: deployment.inspectorUrl || null,
        project: deployment.project || null,
        orchestrate: deployment.orchestrate || null,
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
router.get('/status/:executionId', async (req, res) => {
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
        logs: (status.logs || []).slice(-30),
        result: status.result,
        provider: status.provider || 'simulated',
        url: status.publicUrl || status.url || null,
        publicUrl: status.publicUrl || status.url || null,
        isPublic: status.isPublic ?? null,
        siteHealthy: status.siteHealthy ?? null,
        inspectorUrl: status.inspectorUrl || null,
        project: status.project || null,
        attempts: status.attempts || null,
        autoHealActive: status.autoHealActive || false,
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
