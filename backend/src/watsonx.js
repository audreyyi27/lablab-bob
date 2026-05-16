// IBM watsonx.ai Service
// Handles AI-powered document generation using watsonx.ai Runtime / WML

import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { IamAuthenticator } from 'ibm-cloud-sdk-core';
import { config } from './config.js';

let watsonxAiInstance = null;

export class WatsonxError extends Error {
  constructor(message, { status = 502, details } = {}) {
    super(message);
    this.name = 'WatsonxError';
    this.status = status;
    if (details) this.details = details;
  }
}

/**
 * Check if watsonx.ai is configured
 */
export function isWatsonxConfigured() {
  return Boolean(config.watsonx.apiKey && config.watsonx.projectId);
}

function assertWatsonxConfigured() {
  if (!isWatsonxConfigured()) {
    throw new WatsonxError(
      'IBM watsonx.ai is not configured. Set WATSONX_API_KEY and WATSONX_PROJECT_ID in .env, then restart the server.',
      { status: 503 }
    );
  }
}

/**
 * Initialize watsonx.ai client
 */
function getWatsonxClient() {
<<<<<<< HEAD
  assertWatsonxConfigured();

  if (!watsonxClient) {
    watsonxClient = WatsonXAI.newInstance({
=======
  if (!watsonxAiInstance) {
    if (!config.watsonx.apiKey || !config.watsonx.projectId) {
      throw new Error(
        'watsonx.ai is not configured. Set WATSONX_API_KEY and WATSONX_PROJECT_ID in .env'
      );
    }

    watsonxAiInstance = WatsonXAI.newInstance({
>>>>>>> b91571c (Vercel deployment CD)
      version: '2024-05-31',
      serviceUrl: `https://${config.watsonx.region}.ml.cloud.ibm.com`,
      authenticator: new IamAuthenticator({ apikey: config.watsonx.apiKey }),
    });
  }
  return watsonxAiInstance;
}

function extractApiErrorMessage(error) {
  const apiErrors =
    error?.result?.errors ||
    error?.response?.result?.errors ||
    error?.response?.data?.errors;
  if (Array.isArray(apiErrors) && apiErrors.length > 0) {
    return apiErrors.map((e) => e.message || e.code).filter(Boolean).join('; ');
  }
  return error?.message || 'Unknown watsonx.ai error';
}

/** JSON schema passed to watsonx guidedJSON for structured document output. */
const DOCUMENT_JSON_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    title: { type: 'string' },
    sections: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['heading', 'content'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'sections'],
  additionalProperties: false,
});

const JSON_SYSTEM_PROMPT = `You are RepoTalk, an AI repository interpreter powered by IBM watsonx.ai.

Your job is NOT to write a generic repository summary.
Your job is to TRANSLATE the same GitHub repository into a useful explanation for ONE specific audience.

Each audience cares about different things. The selected audience must strongly change:
- what you emphasize and de-emphasize
- tone and vocabulary
- section structure and headings
- recommendations and metrics cited

Do NOT reuse the same section outline across audiences.
Do NOT write interchangeable "overview + tech stack + recommendations" documents with different titles.

Output rules:
- Respond with exactly one JSON object and nothing else
- No markdown code fences, no text before or after the JSON
- Shape: {"title":"string","sections":[{"heading":"string","content":"string"}]}
- Use only facts from the repository context provided
- Each section needs substantive, audience-specific content (not one-line placeholders)`;

/**
 * Audience-specific briefs: priorities, forbidden overlap, required sections.
 */
const AUDIENCE_BRIEFS = {
  investor: {
    role: 'Investor / VC analyst',
    tone: 'analytical, financial, risk-aware, concise',
    emphasize:
      'money, market size signals, traction proxies (stars/forks/issues), monetization paths, competitive moat, scalability, technical risk to returns, exit potential',
    deemphasize:
      'code tutorials, folder tours, API signatures, CSS details, sprint mechanics',
    titleHint: 'Investment Lens',
    requiredSections: [
      '💰 Investment Thesis',
      '📈 Market & Traction Signals',
      '🏦 Monetization & Business Model Potential',
      '⚖️ Risk Factors (Technical & Market)',
      '📊 Scalability & Defensibility',
      '✅ Verdict: Risk / Reward & Next Diligence Steps',
    ],
    forbiddenSectionThemes: [
      'how to clone and run',
      'folder structure for beginners',
      'component CSS',
    ],
  },
  ceo: {
    role: 'CEO / C-Level Executive',
    tone: 'strategic, decisive, business-outcome focused, minimal jargon',
    emphasize:
      'strategic value, business impact, operational efficiency, competitive positioning, growth levers, build-vs-buy implications, executive-level technology risk',
    deemphasize:
      'dependency version lists, line-by-line code, investor cap tables, intern learning paths',
    titleHint: 'Executive Brief',
    requiredSections: [
      '🎯 Strategic Summary',
      '💼 Business Impact & Operational Value',
      '🏆 Competitive Position & Market Narrative',
      '⚙️ Technology at Executive Level (Capabilities, Not Code)',
      '🚀 Growth & Investment Priorities',
      '📋 C-Suite Actions (Next 90 Days)',
    ],
    forbiddenSectionThemes: [
      'npm install steps',
      'refactoring specific modules',
      'VC diligence checklist',
    ],
  },
  product_manager: {
    role: 'Product Manager',
    tone: 'user-centric, outcome-driven, roadmap-oriented',
    emphasize:
      'user problems solved, feature completeness, user flows, personas, gaps vs expectations, release readiness, roadmap and prioritization',
    deemphasize:
      'investment returns, low-level security patches, detailed class diagrams unless they affect shipping',
    titleHint: 'Product Brief',
    requiredSections: [
      '📱 Product Snapshot',
      '👥 Users & Problems Addressed',
      '✨ Feature Map & Product Gaps',
      '🧭 User Journey & Experience Implications',
      '🚢 Release Readiness & Dependencies',
      '🗺️ Roadmap Recommendations (Now / Next / Later)',
    ],
    forbiddenSectionThemes: [
      'IRR or valuation',
      'docker layer caching',
      'intern study plan',
    ],
  },
  engineering_manager: {
    role: 'Engineering Manager',
    tone: 'practical leadership, delivery-focused, risk-aware',
    emphasize:
      'architecture health, maintainability, testing/CI maturity, delivery risk, team scalability, on-call/ops burden, engineering process signals',
    deemphasize:
      'investor pitch language, beginner explanations, pixel-level design critique',
    titleHint: 'Engineering Leadership Review',
    requiredSections: [
      '📊 Engineering Health Scorecard',
      '🏗️ Architecture & Modularity Assessment',
      '✅ Quality, Testing & CI/CD Maturity',
      '⚠️ Delivery Risks & Bottlenecks',
      '👥 Team Scaling & Ownership Implications',
      '🔧 Recommended Engineering Actions',
    ],
    forbiddenSectionThemes: [
      'monetization strategy',
      'what is a repository',
      'color palette choices',
    ],
  },
  software_engineer: {
    role: 'Software Engineer',
    tone: 'technical, precise, implementation-focused',
    emphasize:
      'code structure, modules, APIs, dependencies, data flow, config, security surface, performance hotspots, how to build/run/test/deploy, refactoring opportunities',
    deemphasize:
      'investor thesis, executive strategy essays, simplified analogies for non-technical readers',
    titleHint: 'Technical Deep Dive',
    requiredSections: [
      '🏗️ Architecture & Code Layout',
      '💻 Stack, Dependencies & Tooling',
      '🔌 APIs, Data Flow & Integration Points',
      '🛠️ Local Setup & Development Workflow',
      '🧪 Testing, CI/CD & Deployment',
      '🔒 Security, Performance & Refactoring Notes',
    ],
    forbiddenSectionThemes: [
      'market TAM',
      'board-level strategy',
      'learning path for interns',
    ],
  },
  designer: {
    role: 'UI/UX Designer',
    tone: 'visual, experiential, collaborative',
    emphasize:
      'UI structure, UX flows, design system signals, components, assets, accessibility, consistency, designer-developer handoff',
    deemphasize:
      'database indexing, investor metrics, backend queue topology unless it affects UX latency',
    titleHint: 'Design & UX Review',
    requiredSections: [
      '🎨 Experience Overview',
      '🖼️ UI Structure & Component Patterns',
      '📐 Design System & Asset Signals',
      '🧭 UX Flow & Interaction Notes',
      '♿ Accessibility & Visual Consistency',
      '🤝 Designer Handoff & Collaboration Tips',
    ],
    forbiddenSectionThemes: [
      'cap table',
      'kubernetes helm charts',
      'unit test mocking patterns',
    ],
  },
  beginner: {
    role: 'Beginner / Intern',
    tone: 'friendly, encouraging, plain language, educational',
    emphasize:
      'what the project does in simple terms, why it matters, folder meanings, what to read first, learning path, safe first tasks, glossary of jargon used',
    deemphasize:
      'investment analysis, executive strategy, advanced performance tuning, architecture politics',
    titleHint: "Beginner's Guide",
    requiredSections: [
      '👋 What Is This Project? (Plain English)',
      '🌟 Why People Care About It',
      '📁 Folder Map: What Lives Where',
      '📖 Files to Read First (In Order)',
      '🎓 Learning Path & Skills to Pick Up',
      '✅ Your First Week: Safe Tasks to Try',
    ],
    forbiddenSectionThemes: [
      'ROI and valuation',
      'enterprise procurement',
      'microservice circuit breakers',
    ],
  },
};

function getAudienceBrief(audience) {
  return AUDIENCE_BRIEFS[audience] ?? AUDIENCE_BRIEFS.beginner;
}

function buildAudienceUserPrompt(audience, context) {
  const brief = getAudienceBrief(audience);
  const sectionList = brief.requiredSections.map((h) => `  - "${h}"`).join('\n');

  return `AUDIENCE MODE: ${audience}
READER ROLE: ${brief.role}
DOCUMENT TITLE PATTERN: Include "${brief.titleHint}" and the repository name in "title".

TONE: ${brief.tone}

PRIORITIZE discussing:
${brief.emphasize}

DE-EMPHASIZE or OMIT (unless directly required for this audience):
${brief.deemphasize}

REQUIRED SECTION HEADINGS (use these exact headings in this order; 6 sections):
${sectionList}

ANTI-GENERIC RULES:
- Do not copy a generic "Tech Stack Overview" unless this audience truly needs it framed their way
- Do not mention topics listed as forbidden themes: ${brief.forbiddenSectionThemes.join(', ')}
- Use different metrics and angles than other audiences would (e.g. investors: traction/ROI; engineers: build/test/security; beginners: learning order)
- At least 2 sections must contain actionable bullets specific to ${brief.role}

REPOSITORY CONTEXT (facts only — interpret through the ${brief.role} lens):
${context}

Return JSON only with "title" and "sections" (exactly 6 sections matching the required headings). Use markdown in "content" (bold, bullets).`;
}

function stripCodeFences(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Extract the first balanced {...} object, respecting strings and escapes.
 */
function extractBalancedJsonObject(text) {
  const source = stripCodeFences(text);
  const start = source.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  return null;
}

function repairJson(jsonText) {
  return jsonText
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'");
}

function normalizeDocument(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  let sections = parsed.sections;

  if (!Array.isArray(sections) && Array.isArray(parsed.document?.sections)) {
    sections = parsed.document.sections;
  }
  if (!Array.isArray(sections) && typeof parsed.content === 'string') {
    sections = [{ heading: '📄 Analysis', content: parsed.content }];
  }

  if (!title || !Array.isArray(sections)) return null;

  const normalizedSections = sections
    .filter((s) => s && typeof s === 'object')
    .map((s) => ({
      heading: String(s.heading ?? s.title ?? 'Section').trim(),
      content: String(s.content ?? s.body ?? s.text ?? '').trim(),
    }))
    .filter((s) => s.heading && s.content);

  if (!normalizedSections.length) return null;

  return { title, sections: normalizedSections };
}

function parseDocumentFromModelText(text) {
  if (!text || !String(text).trim()) {
    throw new Error('Empty model output');
  }

  const candidates = [text, stripCodeFences(text), extractBalancedJsonObject(text)].filter(
    Boolean
  );

  const uniqueCandidates = [...new Set(candidates)];
  let lastError = null;

  for (const candidate of uniqueCandidates) {
    for (const attempt of [candidate, repairJson(candidate)]) {
      try {
        const parsed = JSON.parse(attempt);
        const document = normalizeDocument(parsed);
        if (document) return document;
        lastError = new Error('JSON parsed but document structure is invalid');
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('No JSON object found in model output');
}

function extractChatMessageText(response) {
  const choice = response?.result?.choices?.[0];
  const message = choice?.message;
  if (!message) return '';

  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text ?? '';
        return part?.text ?? '';
      })
      .join('');
  }

  return '';
}

async function requestWatsonxDocument(client, { modelId, audience, context, useGuidedJson }) {
  const userContent = buildAudienceUserPrompt(audience, context);

  const params = {
    modelId,
    projectId: config.watsonx.projectId,
    messages: [
      { role: 'system', content: JSON_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.35,
    maxTokens: 3200,
    topP: 0.9,
    repetitionPenalty: 1.05,
    responseFormat: { type: 'json_object' },
  };

  if (useGuidedJson) {
    params.guidedJSON = DOCUMENT_JSON_SCHEMA;
  }

  return client.textChat(params);
}

/**
 * Build a comprehensive context from repository analysis data
 */
function buildRepositoryContext(analysisData) {
  const { repo, readme, tech, architecture, importantFiles } = analysisData;

  let context = `# Repository Analysis Context\n\n`;

  // Repository metadata
  context += `## Repository Information\n`;
  context += `- **Name**: ${repo.full_name}\n`;
  context += `- **Description**: ${repo.description || 'No description provided'}\n`;
  context += `- **Primary Language**: ${repo.language || 'Not specified'}\n`;
  context += `- **Stars**: ${repo.stargazers_count.toLocaleString()}\n`;
  context += `- **Forks**: ${repo.forks_count.toLocaleString()}\n`;
  context += `- **Watchers**: ${repo.watchers_count.toLocaleString()}\n`;
  context += `- **Open Issues**: ${repo.open_issues_count || 0}\n`;
  context += `- **License**: ${repo.license?.name || 'Not specified'}\n`;
  context += `- **Last Updated**: ${new Date(repo.updated_at).toLocaleDateString()}\n`;
  context += `- **Visibility**: ${repo.private ? 'Private' : 'Public'}\n\n`;

  // README information
  if (readme) {
    context += `## README Summary\n`;
    context += `- **Title**: ${readme.title}\n`;
    context += `- **Description**: ${readme.description}\n`;
    if (readme.features && readme.features.length > 0) {
      context += `- **Key Features**:\n`;
      readme.features.forEach((feature) => {
        context += `  - ${feature}\n`;
      });
    }
    context += `\n`;
  }

  // Technology stack
  context += `## Technology Stack\n`;
  if (tech.technologies.length > 0) {
    context += `- **Technologies**: ${tech.technologies.join(', ')}\n`;
  }
  if (tech.frameworks.length > 0) {
    context += `- **Frameworks**: ${tech.frameworks.join(', ')}\n`;
  }
  if (tech.tools.length > 0) {
    context += `- **Tools**: ${tech.tools.join(', ')}\n`;
  }
  context += `\n`;

  // Architecture
  context += `## Architecture\n`;
  context += `- **Type**: ${architecture.isMonorepo ? 'Monorepo' : 'Standard repository'}\n`;
  context += `- **Has Frontend**: ${architecture.hasFrontend ? 'Yes' : 'No'}\n`;
  context += `- **Has Backend**: ${architecture.hasBackend ? 'Yes' : 'No'}\n`;
  context += `- **Has Database**: ${architecture.hasDatabase ? 'Yes' : 'No'}\n`;
  context += `- **Has Tests**: ${architecture.hasTests ? 'Yes' : 'No'}\n`;
  context += `- **Has CI/CD**: ${architecture.hasCI ? 'Yes' : 'No'}\n`;
  context += `- **Has Docker**: ${architecture.hasDocker ? 'Yes' : 'No'}\n`;
  context += `- **Has Documentation**: ${architecture.hasDocs ? 'Yes' : 'No'}\n`;
  if (architecture.folders.length > 0) {
    context += `- **Main Folders**: ${architecture.folders.join(', ')}\n`;
  }
  context += `\n`;

  // Important files
  if (importantFiles.length > 0) {
    context += `## Important Files\n`;
    importantFiles.forEach((file) => {
      context += `- \`${file.path}\` (${file.category})\n`;
    });
    context += `\n`;
  }

  return context;
}

/**
 * Generate audience-specific document using watsonx.ai
 */
export async function generateDocumentWithAI(audience, analysisData) {
  assertWatsonxConfigured();

  const client = getWatsonxClient();
  const modelId = config.watsonx.modelId;
  const context = buildRepositoryContext(analysisData);

  const attempts = [
    { label: 'textChat+json_object', useGuidedJson: false },
    { label: 'textChat+guidedJSON', useGuidedJson: true },
  ];

  let lastParseError = null;
  let lastRawSnippet = '';

  for (const attempt of attempts) {
    let response;
    try {
      console.log(
        `Calling watsonx.ai (${modelId}, ${attempt.label}) for audience: ${audience}`
      );
      response = await requestWatsonxDocument(client, {
        modelId,
        audience,
        context,
        useGuidedJson: attempt.useGuidedJson,
      });
    } catch (error) {
      const apiMessage = extractApiErrorMessage(error);
      const status = error?.status === 404 ? 404 : 502;
      console.error('watsonx.ai API error:', apiMessage);
      throw new WatsonxError(`IBM watsonx.ai request failed: ${apiMessage}`, {
        status,
        details: error?.code || undefined,
      });
    }

    const generatedText = extractChatMessageText(response);
    lastRawSnippet = generatedText.slice(0, 300);

    if (!generatedText.trim()) {
      lastParseError = new Error('Empty model output');
      console.warn(`watsonx.ai ${attempt.label}: empty message content`);
      continue;
    }

    try {
      const document = parseDocumentFromModelText(generatedText);
      console.log(`Document generated successfully with watsonx.ai (${attempt.label})`);
      return {
        ...document,
        generatedBy: 'watsonx.ai',
        model: modelId,
      };
    } catch (parseError) {
      lastParseError = parseError;
      console.warn(
        `watsonx.ai ${attempt.label} JSON parse failed:`,
        parseError.message,
        '\nOutput preview:',
        lastRawSnippet
      );
    }
  }

  console.error('watsonx.ai JSON parse error after retries:', lastParseError?.message);
  throw new WatsonxError(
    'IBM watsonx.ai returned a response that could not be parsed as JSON. The model must return a JSON object with "title" and "sections".',
    {
      status: 502,
      details: lastParseError?.message || 'Unknown parse error',
    }
  );
}
<<<<<<< HEAD
<<<<<<< HEAD
=======
=======
import { config } from './config.js';
=======

import {
  isVercelConfigured,
  deployFromGithub,
  getDeployment as getVercelDeployment,
  getDeploymentEvents as getVercelDeploymentEvents,
  summarizeBuildError,
  getProject as getVercelProject,
  updateProject as updateVercelProject,
  redeployProject as redeployVercelProject,
  mapState as mapVercelState,
  productionUrl as vercelProductionUrl,
  inspectorUrl as vercelInspectorUrl,
  deploymentId as vercelDeploymentId,
} from './vercel.js';
import { fetchRepoWithTree } from './github.js';
import { proposeFix } from './autoheal.js';

const MAX_AUTOHEAL_ATTEMPTS = 4;
const VERCEL_POLL_MS = 4000;
>>>>>>> b91571c (Vercel deployment CD)

const WATSONX_API_BASE = config.watsonx.url;
const WATSONX_API_KEY = config.watsonx.apikey;

// In-memory mirror of live deployments (both Vercel and simulated). Vercel
// status is refreshed on demand; simulated ones progress on a timer.
const vercelDeployments = new Map(); // uid -> normalized record

// Log each unique Orchestrate fallback message only once per process to
// avoid spamming the terminal on every status / list poll.
const loggedOnce = new Set();
function warnOnce(key, message) {
  if (loggedOnce.has(key)) return;
  loggedOnce.add(key);
  console.warn(message);
}

// In-memory store for simulated deployments. Used as a graceful fallback
// when Watsonx Orchestrate is not configured or the workflow endpoint
// rejects the request — so the CD UI works out of the box.
const simulatedDeployments = new Map();

function nowIso() {
  return new Date().toISOString();
}

function stamp() {
  return new Date().toLocaleTimeString();
}

function regionFromUrl(url) {
  const m = url && url.match(/api\.([a-z0-9-]+)\.watson-orchestrate/i);
  return m ? m[1] : null;
}

function instanceIdFromUrl(url) {
  const m = url && url.match(/\/instances\/([a-z0-9-]+)/i);
  return m ? m[1] : null;
}

function makeSimulatedDeployment(cfg, connection) {
  const id = `wxo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = nowIso();

  const deployment = {
    execution_id: id,
    id,
    status: 'initiated',
    started_at: startedAt,
    completed_at: null,
    duration: null,
    result: null,
    parameters: {
      repository: cfg.repository,
      owner: cfg.owner,
      branch: cfg.branch || 'main',
      environment: cfg.environment || 'production',
      deployment_type: cfg.deploymentType || 'auto',
      triggered_by: cfg.triggeredBy || 'engineer',
      timestamp: startedAt,
    },
    orchestrate: connection || null,
    logs: [],
    simulated: true,
  };

  if (connection?.authenticated) {
    deployment.logs.push(
      `[${stamp()}] Authenticated with IBM Cloud IAM (region ${connection.region || 'unknown'})`
    );
    deployment.logs.push(
      `[${stamp()}] watsonx Orchestrate instance ${connection.instanceId || 'unknown'} reached`
    );
    if (!connection.workflowAccessible && connection.message) {
      deployment.logs.push(`[${stamp()}] Note: ${connection.message}`);
    }
  } else {
    deployment.logs.push(`[${stamp()}] watsonx Orchestrate not configured — running in local mode`);
  }
  deployment.logs.push(`[${stamp()}] CD pipeline accepted`);

  simulatedDeployments.set(id, deployment);

  const tick = (status, log, finished = false) => {
    const d = simulatedDeployments.get(id);
    if (!d || d.status === 'cancelled') return;
    d.status = status;
    d.logs.push(`[${stamp()}] ${log}`);
    if (finished) {
      d.completed_at = nowIso();
      d.duration = Math.max(
        1,
        Math.round((new Date(d.completed_at) - new Date(d.started_at)) / 1000)
      );
      d.result = { success: status === 'completed' };
    }
  };

  setTimeout(() => tick('running', 'Building application artifact'), 1500);
  setTimeout(() => tick('running', 'Running automated tests'), 3500);
  setTimeout(
    () => tick('running', `Deploying to ${deployment.parameters.environment}`),
    5500
  );
  setTimeout(
    () =>
      tick(
        'completed',
        `Deployment to ${deployment.parameters.environment} succeeded`,
        true
      ),
    7500
  );

  return deployment;
}

/**
 * Watsonx Orchestrate API client for CD automation.
 *
 * Behavior:
 *   - If Watsonx Orchestrate is configured (apikey + URL) the real
 *     workflow endpoint is called.
 *   - If it is not configured, or the real call fails (auth / forbidden /
 *     workflow not found), it transparently falls back to an in-memory
 *     simulated workflow so the UI keeps working with zero setup.
 */
async function runAutoHealLoop(client, record) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let attemptIdx = 0;

  let tree = null;
  try {
    const fetched = await fetchRepoWithTree(
      record.accessToken,
      record.parameters.owner,
      record.parameters.repository
    );
    tree = fetched.tree;
  } catch (err) {
    record.logs.push(`[${stamp()}] could not read repo tree: ${err.message}`);
  }

  while (record.autoHealActive) {
    let fresh;
    try {
      fresh = await getVercelDeployment(record.currentVercelUid);
    } catch (err) {
      record.logs.push(`[${stamp()}] status fetch error: ${err.message}`);
      await sleep(VERCEL_POLL_MS);
      continue;
    }

    record.status = mapVercelState(fresh.readyState);
    if (fresh.url) record.url = `https://${fresh.url}`;
    if (fresh.inspectorUrl) record.inspectorUrl = fresh.inspectorUrl;

    if (record.status === 'completed') {
      record.completed_at = nowIso();
      record.duration = Math.max(
        1,
        Math.round((new Date(record.completed_at) - new Date(record.started_at)) / 1000)
      );
      record.result = { success: true };
      record.autoHealActive = false;
      record.logs.push(`[${stamp()}] ✅ Deployment READY at ${record.url}`);
      return;
    }

    if (record.status === 'cancelled') {
      record.completed_at = nowIso();
      record.result = { success: false };
      record.autoHealActive = false;
      record.logs.push(`[${stamp()}] Deployment cancelled`);
      return;
    }

    if (record.status === 'failed') {
      attemptIdx = record.attempts.length;
      if (attemptIdx >= MAX_AUTOHEAL_ATTEMPTS) {
        record.autoHealActive = false;
        record.logs.push(`[${stamp()}] ❌ Reached max attempts (${MAX_AUTOHEAL_ATTEMPTS}). Giving up.`);
        record.completed_at = nowIso();
        record.result = { success: false };
        return;
      }

      record.logs.push(`[${stamp()}] Build failed — analyzing logs…`);
      let errorText = null;
      try {
        const events = await getVercelDeploymentEvents(record.currentVercelUid);
        errorText = summarizeBuildError(events);
      } catch (err) {
        record.logs.push(`[${stamp()}] could not fetch build events: ${err.message}`);
      }

      if (errorText) {
        record.logs.push(`[${stamp()}] Error: ${errorText.split('\n')[0].slice(0, 180)}`);
      }

      const triedSet = new Set(record.triedFixes);
      const proj = await getVercelProject(record.project.name).catch(() => null);
      const fix = proposeFix({
        errorText: errorText || '',
        tree,
        project: proj || { rootDirectory: null, framework: null },
        triedFixes: triedSet,
      });

      if (!fix) {
        record.autoHealActive = false;
        record.logs.push(`[${stamp()}] No known auto-fix for this error. Giving up.`);
        record.completed_at = nowIso();
        record.result = { success: false };
        return;
      }

      record.triedFixes.push(fix.kind);
      record.logs.push(`[${stamp()}] 🔧 Applying fix: ${fix.message}`);

      try {
        await updateVercelProject(record.project.name, fix.patch);
      } catch (err) {
        record.logs.push(`[${stamp()}] patch failed: ${err.message}`);
        record.autoHealActive = false;
        record.completed_at = nowIso();
        record.result = { success: false };
        return;
      }

      let next;
      try {
        next = await redeployVercelProject({
          project: record.project,
          owner: record.parameters.owner,
          repo: record.parameters.repository,
          branch: record.parameters.branch,
          repoId: record.repoInfo.repoId,
        });
      } catch (err) {
        record.logs.push(`[${stamp()}] redeploy failed: ${err.message}`);
        record.autoHealActive = false;
        record.completed_at = nowIso();
        record.result = { success: false };
        return;
      }

      const nextUid = vercelDeploymentId(next);
      record.currentVercelUid = nextUid;
      record.status = mapVercelState(next.readyState);
      if (next.url) record.url = `https://${next.url}`;
      if (next.inspectorUrl) record.inspectorUrl = next.inspectorUrl;
      record.attempts.push({
        uid: nextUid,
        status: 'initiated',
        kind: fix.kind,
        message: fix.message,
      });
      vercelDeployments.set(`uid:${nextUid}`, record.id);
      record.logs.push(
        `[${stamp()}] Attempt ${record.attempts.length}: re-deploy ${nextUid} queued`
      );
    }

    await sleep(VERCEL_POLL_MS);
  }
}

export class WatsonxOrchestrate {
  constructor() {
    this.apiKey = WATSONX_API_KEY;
    this.baseUrl = (WATSONX_API_BASE || '').replace(/\/$/, '');
    this.region = regionFromUrl(this.baseUrl);
    this.instanceId = instanceIdFromUrl(this.baseUrl);

    this._tokenCache = null; // { token, expiresAt }
  }

  isConfigured() {
    return Boolean(this.apiKey && this.baseUrl);
  }

  async getAuthToken() {
    const now = Date.now();
    if (this._tokenCache && this._tokenCache.expiresAt > now + 30_000) {
      return this._tokenCache.token;
    }

    const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: this.apiKey,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`IAM token request failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const ttlMs = (data.expires_in || 3600) * 1000;
    this._tokenCache = { token: data.access_token, expiresAt: now + ttlMs };
    return data.access_token;
  }

  /**
   * Verify the credentials reach IBM Cloud and the Watsonx Orchestrate
   * instance. Returns a structured status object that is safe to surface
   * to the UI (no secrets).
   */
  async verifyConnection() {
    if (!this.isConfigured()) {
      return {
        configured: false,
        authenticated: false,
        workflowAccessible: false,
        message: 'WATSONX_API_KEY / WATSONX_URL not set in .env',
      };
    }

    let token;
    try {
      token = await this.getAuthToken();
    } catch (err) {
      return {
        configured: true,
        authenticated: false,
        workflowAccessible: false,
        region: this.region,
        instanceId: this.instanceId,
        message: `IBM Cloud IAM authentication failed: ${err.message}`,
      };
    }

    let workflowAccessible = false;
    let probeMessage = 'Connected to watsonx Orchestrate.';
    try {
      const probe = await fetch(`${this.baseUrl}/v1/agents`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (probe.ok) {
        workflowAccessible = true;
      } else {
        const body = await probe.text().catch(() => '');
        if (probe.status === 403 && /does not have roles/i.test(body)) {
          probeMessage =
            'Authenticated, but this Service ID has no role in the Orchestrate workspace. ' +
            'Grant it the "User" role in Orchestrate → Manage Access.';
        } else {
          probeMessage = `watsonx Orchestrate probe responded ${probe.status} ${probe.statusText}`;
        }
      }
    } catch (err) {
      probeMessage = `watsonx Orchestrate probe failed: ${err.message}`;
    }

    return {
      configured: true,
      authenticated: true,
      workflowAccessible,
      region: this.region,
      instanceId: this.instanceId,
      message: probeMessage,
    };
  }

  async triggerDeployment(deploymentConfig) {
    const connection = await this.verifyConnection();

    // Preferred path: real production deploy on Vercel.
    if (isVercelConfigured()) {
      try {
        const { deployment, project, repoInfo } = await deployFromGithub({
          owner: deploymentConfig.owner,
          repo: deploymentConfig.repository,
          branch: deploymentConfig.branch,
          target: 'production',
        });

        const url = vercelProductionUrl(deployment, project);
        const inspector = vercelInspectorUrl(deployment);
        const depId = vercelDeploymentId(deployment);

        const record = {
          execution_id: depId,
          id: depId,
          currentVercelUid: depId,
          status: mapVercelState(deployment.readyState),
          started_at: deployment.createdAt
            ? new Date(deployment.createdAt).toISOString()
            : nowIso(),
          completed_at: null,
          duration: null,
          result: null,
          parameters: {
            repository: deploymentConfig.repository,
            owner: deploymentConfig.owner,
            branch:
              deployment.meta?.githubCommitRef ||
              deploymentConfig.branch ||
              repoInfo.defaultBranch ||
              'main',
            environment: deploymentConfig.environment || 'production',
            deployment_type: deploymentConfig.deploymentType || 'auto',
            triggered_by: deploymentConfig.triggeredBy || 'engineer',
            timestamp: nowIso(),
          },
          orchestrate: connection,
          provider: 'vercel',
          project: { id: project.id, name: project.name },
          repoInfo: { repoId: repoInfo.repoId, defaultBranch: repoInfo.defaultBranch },
          url,
          inspectorUrl: inspector,
          attempts: [
            { uid: depId, status: 'initiated', kind: 'initial', message: 'Initial production deploy' },
          ],
          triedFixes: [],
          autoHealActive: true,
          accessToken: deploymentConfig.accessToken || null,
          logs: [
            `[${stamp()}] Authenticated with IBM Cloud IAM (region ${connection.region || 'unknown'})`,
            `[${stamp()}] Vercel project ${project.name} (${project.id}) selected`,
            `[${stamp()}] Attempt 1: production deployment ${depId} queued (ref ${deployment.meta?.githubCommitRef || 'main'})`,
          ],
        };

        vercelDeployments.set(record.id, record);
        // Track the live Vercel uid → task id mapping so getDeploymentStatus
        // can route lookups even when retries spawn new uids.
        vercelDeployments.set(`uid:${depId}`, record.id);

        // Kick off the watch/auto-heal loop in the background.
        runAutoHealLoop(this, record).catch((err) => {
          record.logs.push(`[${stamp()}] auto-heal loop crashed: ${err.message}`);
          record.autoHealActive = false;
        });

        return record;
      } catch (err) {
        console.warn(`[vercel] real deploy failed, falling back to simulation: ${err.message}`);
      }
    }

    // Fallback: simulated workflow so the UI still works.
    return makeSimulatedDeployment(deploymentConfig, connection);
  }

  async getDeploymentStatus(executionId) {
    if (simulatedDeployments.has(executionId)) {
      return simulatedDeployments.get(executionId);
    }

    // Map a live Vercel uid (from a retry) back to its task id.
    const aliased = vercelDeployments.get(`uid:${executionId}`);
    const lookupId = typeof aliased === 'string' ? aliased : executionId;
    const record = vercelDeployments.get(lookupId);

    if (record && typeof record === 'object') {
      // Auto-heal loop continually updates the record; just return it.
      return record;
    }

    if (this.isConfigured()) {
      try {
        const token = await this.getAuthToken();
        const response = await fetch(
          `${this.baseUrl}/v1/workflows/executions/${executionId}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          return response.json();
        }
        warnOnce(
          `status:${response.status}`,
          `[watsonx-orchestrate] status fell back: ${response.status} ${response.statusText}`
        );
      } catch (err) {
        warnOnce(`status:err`, `[watsonx-orchestrate] status fell back: ${err.message}`);
      }
    }

    return { status: 'unknown', logs: [] };
  }

  async listDeployments(owner, repo, limit = 10) {
    let realExecutions = [];

    if (this.isConfigured()) {
      try {
        const token = await this.getAuthToken();
        const response = await fetch(
          `${this.baseUrl}/v1/workflows/executions?workflow_id=cd_deployment&limit=${limit}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          realExecutions = (data.executions || []).filter(
            (exec) =>
              exec.parameters?.owner === owner &&
              exec.parameters?.repository === repo
          );
        } else {
          warnOnce(
            `list:${response.status}`,
            `[watsonx-orchestrate] list fell back: ${response.status} ${response.statusText}`
          );
        }
      } catch (err) {
        warnOnce(`list:err`, `[watsonx-orchestrate] list fell back: ${err.message}`);
      }
    }

    const simulated = Array.from(simulatedDeployments.values()).filter(
      (d) => d.parameters.owner === owner && d.parameters.repository === repo
    );

    const vercel = Array.from(vercelDeployments.values()).filter(
      (d) =>
        d &&
        typeof d === 'object' &&
        d.parameters?.owner === owner &&
        d.parameters?.repository === repo
    );

    const executions = [...vercel, ...simulated, ...realExecutions]
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .slice(0, limit);

    return { executions, total: executions.length };
  }

  async cancelDeployment(executionId) {
    if (simulatedDeployments.has(executionId)) {
      const d = simulatedDeployments.get(executionId);
      d.status = 'cancelled';
      d.completed_at = nowIso();
      d.logs.push(`[${stamp()}] Cancelled by user`);
      return d;
    }

    if (this.isConfigured()) {
      try {
        const token = await this.getAuthToken();
        const response = await fetch(
          `${this.baseUrl}/v1/workflows/executions/${executionId}/cancel`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          return response.json();
        }
        warnOnce(
          `cancel:${response.status}`,
          `[watsonx-orchestrate] cancel fell back: ${response.status} ${response.statusText}`
        );
      } catch (err) {
        warnOnce(`cancel:err`, `[watsonx-orchestrate] cancel fell back: ${err.message}`);
      }
    }

    return { status: 'cancelled' };
  }
}

export const watsonxClient = new WatsonxOrchestrate();
<<<<<<< HEAD
>>>>>>> 30845ee (Watsonz Orchestrate CD)

// Made with Bob
>>>>>>> 92066e7 (rebased)
=======
>>>>>>> b91571c (Vercel deployment CD)
