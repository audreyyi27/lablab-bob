import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const port = Number(process.env.PORT) || 3000;
const frontendUrl = (process.env.FRONTEND_URL || `http://localhost:${port}`).replace(/\/$/, '');

export const config = {
  port,
  frontendUrl,
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-change-in-production',
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackUrl:
      process.env.GITHUB_CALLBACK_URL ||
      `http://localhost:${port}/api/auth/github/callback`,
  },
  watsonx: {
    apiKey: process.env.WATSONX_API_KEY || '',
    projectId: process.env.WATSONX_PROJECT_ID || '',
    region: process.env.WATSONX_REGION || 'us-south',
    modelId: process.env.WATSONX_MODEL_ID || 'ibm/granite-13b-chat-v2',
  },
  isProduction: process.env.NODE_ENV === 'production',
};

export function assertOAuthConfigured() {
  if (!config.github.clientId || !config.github.clientSecret) {
    throw new Error(
      'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env'
    );
  }
}
