<<<<<<< HEAD
// IBM watsonx.ai Service
// Handles AI-powered document generation using watsonx.ai Runtime / WML

import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { IamAuthenticator } from 'ibm-cloud-sdk-core';
import { config } from './config.js';

let watsonxClient = null;

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
  assertWatsonxConfigured();

  if (!watsonxClient) {
    watsonxClient = WatsonXAI.newInstance({
      version: '2024-05-31',
      serviceUrl: `https://${config.watsonx.region}.ml.cloud.ibm.com`,
      authenticator: new IamAuthenticator({ apikey: config.watsonx.apiKey }),
    });
  }
  return watsonxClient;
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
=======
=======
import { config } from './config.js';

const WATSONX_API_BASE = config.watsonx.url;
const WATSONX_API_KEY = config.watsonx.apikey;

/**
 * Watsonx Orchestrate API client for CD automation
 */
export class WatsonxOrchestrate {
  constructor() {
    this.apiKey = WATSONX_API_KEY;
    this.baseUrl = WATSONX_API_BASE;
  }

  /**
   * Get authentication token for Watsonx API
   */
  async getAuthToken() {
    const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: this.apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get auth token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Trigger a deployment workflow in Watsonx Orchestrate
   */
  async triggerDeployment(deploymentConfig) {
    const token = await this.getAuthToken();
    
    const payload = {
      workflow_id: 'cd_deployment',
      parameters: {
        repository: deploymentConfig.repository,
        owner: deploymentConfig.owner,
        branch: deploymentConfig.branch || 'main',
        environment: deploymentConfig.environment || 'production',
        deployment_type: deploymentConfig.deploymentType || 'auto',
        triggered_by: 'engineer',
        timestamp: new Date().toISOString(),
      },
    };

    const response = await fetch(`${this.baseUrl}/v1/workflows/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Deployment trigger failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(executionId) {
    const token = await this.getAuthToken();

    const response = await fetch(`${this.baseUrl}/v1/workflows/executions/${executionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get deployment status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List all deployments for a repository
   */
  async listDeployments(owner, repo, limit = 10) {
    const token = await this.getAuthToken();

    const response = await fetch(
      `${this.baseUrl}/v1/workflows/executions?workflow_id=cd_deployment&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list deployments: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Filter by repository
    if (data.executions) {
      data.executions = data.executions.filter(
        (exec) =>
          exec.parameters?.owner === owner &&
          exec.parameters?.repository === repo
      );
    }

    return data;
  }

  /**
   * Cancel a running deployment
   */
  async cancelDeployment(executionId) {
    const token = await this.getAuthToken();

    const response = await fetch(
      `${this.baseUrl}/v1/workflows/executions/${executionId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to cancel deployment: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * AI-powered deployment decision
   * Analyzes repository changes and decides if deployment should proceed
   */
  async analyzeDeploymentReadiness(repoData) {
    const token = await this.getAuthToken();

    const analysisPayload = {
      workflow_id: 'deployment_analysis',
      parameters: {
        repository: repoData.name,
        owner: repoData.owner,
        recent_commits: repoData.commits || [],
        test_results: repoData.testResults || {},
        code_quality: repoData.codeQuality || {},
        dependencies: repoData.dependencies || [],
      },
    };

    const response = await fetch(`${this.baseUrl}/v1/workflows/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(analysisPayload),
    });

    if (!response.ok) {
      throw new Error(`Deployment analysis failed: ${response.statusText}`);
    }

    return response.json();
  }
}

export const watsonxClient = new WatsonxOrchestrate();
>>>>>>> 30845ee (Watsonz Orchestrate CD)

// Made with Bob
>>>>>>> 92066e7 (rebased)
