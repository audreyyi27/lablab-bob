import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { isWatsonxConfigured } from './watsonx.js';
import authRouter from './routes/auth.js';
import githubRouter from './routes/github.js';
import analyzeRouter from './routes/analyze.js';
import deploymentRouter from './routes/deployment.js';
import { watsonxClient } from './watsonx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, '../../frontend');

const app = express();

app.set('trust proxy', 1);

app.use(
  session({
    name: 'repotalk.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/github', githubRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/deployment', deploymentRouter);

app.use(express.static(frontendRoot));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(config.port, async () => {
  console.log(`RepoTalk server running at ${config.frontendUrl}`);
  console.log(`GitHub OAuth callback: ${config.github.callbackUrl}`);
  if (!config.github.clientId || !config.github.clientSecret) {
    console.warn(
      'Warning: GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set — Connect GitHub will not work until configured.'
    );
  }
  if (!isWatsonxConfigured()) {
    console.warn(
      'Warning: WATSONX_WML_API_KEY / WATSONX_WML_PROJECT_ID not set — audience documents require IBM watsonx.ai WML.'
    );
  } else {
    console.log(
      `IBM watsonx.ai enabled (model: ${config.watsonx.modelId}, region: ${config.watsonx.region})`
    );
  }

  try {
    const status = await watsonxClient.verifyConnection();
    if (!status.configured) {
      console.log('[watsonx-orchestrate] not configured — CD will run in local simulation mode.');
    } else if (status.authenticated && status.workflowAccessible) {
      console.log(
        `[watsonx-orchestrate] connected (${status.region}/${status.instanceId}) — workflow API accessible.`
      );
    } else if (status.authenticated) {
      console.log(
        `[watsonx-orchestrate] authenticated (${status.region}/${status.instanceId}). ${status.message}`
      );
    } else {
      console.warn(`[watsonx-orchestrate] auth failed: ${status.message}`);
    }
  } catch (err) {
    console.warn(`[watsonx-orchestrate] startup probe failed: ${err.message}`);
  }
});
