import { Router } from 'express';
import crypto from 'crypto';
import { assertOAuthConfigured, config } from '../config.js';
import { fetchUserRepos, githubFetch } from '../github.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/github/login', (req, res) => {
  try {
    assertOAuthConfigured();
  } catch (err) {
    const msg = encodeURIComponent(err.message);
    return res.redirect(`${config.frontendUrl}/analysis.html?auth_error=${msg}`);
  }

  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: 'repo read:user',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/github/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  const redirectBase = `${config.frontendUrl}/analysis.html`;

  if (error) {
    const msg = errorDescription || error;
    return res.redirect(`${redirectBase}?auth_error=${encodeURIComponent(msg)}`);
  }

  if (!code || !state || state !== req.session.oauthState) {
    return res.redirect(`${redirectBase}?auth_error=${encodeURIComponent('Invalid OAuth state')}`);
  }

  delete req.session.oauthState;

  try {
    assertOAuthConfigured();

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        redirect_uri: config.github.callbackUrl,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      const msg = tokenData.error_description || tokenData.error || 'Token exchange failed';
      return res.redirect(`${redirectBase}?auth_error=${encodeURIComponent(msg)}`);
    }

    req.session.githubAccessToken = tokenData.access_token;
    res.redirect(`${redirectBase}?connected=1`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(
      `${redirectBase}?auth_error=${encodeURIComponent('Could not complete GitHub login')}`
    );
  }
});

router.get('/session', async (req, res) => {
  const token = req.session?.githubAccessToken;
  if (!token) {
    return res.json({ authenticated: false });
  }

  try {
    const user = await githubFetch('/user', token);
    res.json({
      authenticated: true,
      user: {
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    delete req.session.githubAccessToken;
    res.json({ authenticated: false });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((destroyErr) => {
    if (destroyErr) {
      return res.status(500).json({ error: 'Could not end session' });
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/repos', requireAuth, async (req, res) => {
  try {
    const repos = await fetchUserRepos(req.session.githubAccessToken);
    res.json({
      repos: repos.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        name: r.name,
        owner: r.owner?.login,
        private: r.private,
        description: r.description,
        html_url: r.html_url,
        language: r.language,
        updated_at: r.updated_at,
        stargazers_count: r.stargazers_count,
        default_branch: r.default_branch,
      })),
    });
  } catch (err) {
    console.error('List repos error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to load repositories' });
  }
});

export default router;
