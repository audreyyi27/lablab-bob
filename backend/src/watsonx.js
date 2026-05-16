// IBM watsonx.ai Service
// Handles AI-powered document generation using watsonx.ai Runtime / WML

import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { config } from './config.js';

let watsonxClient = null;

/**
 * Initialize watsonx.ai client
 */
function getWatsonxClient() {
  if (!watsonxClient) {
    if (!config.watsonx.apiKey || !config.watsonx.projectId) {
      throw new Error(
        'watsonx.ai is not configured. Set WATSONX_API_KEY and WATSONX_PROJECT_ID in .env'
      );
    }

    watsonxClient = WatsonXAI.newInstance({
      version: '2024-05-31',
      serviceUrl: `https://${config.watsonx.region}.ml.cloud.ibm.com`,
    });
  }
  return watsonxClient;
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
      readme.features.forEach(feature => {
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
    context += `- **Top-level Folders**: ${architecture.folders.join(', ')}\n`;
  }
  context += `\n`;

  // Important files
  if (importantFiles && importantFiles.length > 0) {
    context += `## Important Files\n`;
    importantFiles.forEach(file => {
      context += `- ${file.path} (${file.category})\n`;
    });
    context += `\n`;
  }

  return context;
}

/**
 * Build audience-specific prompt
 */
function buildAudiencePrompt(audience, context) {
  const audienceProfiles = {
    ceo: {
      name: 'CEO / C-Level Executive',
      focus: 'business value, strategic insights, ROI, market position, and high-level technical capabilities',
      tone: 'executive, strategic, business-focused',
      sections: [
        'Business Overview',
        'Strategic Value',
        'Key Metrics',
        'Recommendations'
      ]
    },
    product_manager: {
      name: 'Product Manager',
      focus: 'product features, user value, market fit, roadmap insights, and competitive advantages',
      tone: 'product-focused, user-centric, analytical',
      sections: [
        'Product Overview',
        'Key Features',
        'Architecture & Capabilities',
        'Market Traction',
        'Product Roadmap Insights'
      ]
    },
    engineering_manager: {
      name: 'Engineering Manager',
      focus: 'technical stack, engineering practices, team metrics, code quality, and infrastructure',
      tone: 'technical leadership, process-oriented, quality-focused',
      sections: [
        'Technical Stack',
        'Architecture Assessment',
        'Engineering Practices',
        'Team & Collaboration',
        'Engineering Recommendations'
      ]
    },
    software_engineer: {
      name: 'Software Engineer',
      focus: 'code structure, development setup, technical implementation, and hands-on details',
      tone: 'technical, practical, developer-friendly',
      sections: [
        'Tech Stack',
        'Project Structure',
        'Development Setup',
        'Deployment',
        'Resources'
      ]
    },
    designer: {
      name: 'Designer',
      focus: 'UI/UX components, design system, user experience, and visual assets',
      tone: 'design-focused, user experience oriented, creative',
      sections: [
        'Project Overview',
        'UI/UX Components',
        'User Experience',
        'Design Assets',
        'Design Tools & Workflow'
      ]
    },
    beginner: {
      name: 'Beginner / Intern',
      focus: 'simple explanations, learning resources, getting started guide, and foundational concepts',
      tone: 'educational, encouraging, beginner-friendly',
      sections: [
        'Welcome',
        'What You Will Learn',
        'Project Structure (Simplified)',
        'How to Get Started',
        'Learning Resources'
      ]
    },
    investor: {
      name: 'Investor',
      focus: 'market validation, growth metrics, technical risk assessment, and investment potential',
      tone: 'investment-focused, analytical, risk-aware',
      sections: [
        'Executive Summary',
        'Market Validation',
        'Technology Assessment',
        'Business Model Potential',
        'Risk Analysis',
        'Investment Recommendation'
      ]
    }
  };

  const profile = audienceProfiles[audience] || audienceProfiles.beginner;

  const prompt = `You are an expert technical writer creating documentation for a ${profile.name}.

REPOSITORY CONTEXT:
${context}

TASK:
Generate a comprehensive, well-structured document about this repository tailored for a ${profile.name}.

FOCUS AREAS:
${profile.focus}

TONE:
${profile.tone}

REQUIRED SECTIONS:
${profile.sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

INSTRUCTIONS:
1. Create a compelling title that reflects the repository and audience
2. For each section, provide:
   - A clear heading with an appropriate emoji
   - Detailed, insightful content based on the repository context
   - Specific examples and data points from the analysis
   - Actionable insights and recommendations where appropriate
3. Use markdown formatting (bold, lists, code blocks)
4. Be specific and reference actual data from the repository
5. Maintain the appropriate tone for the target audience
6. Make the content engaging and valuable

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "title": "Document title here",
  "sections": [
    {
      "heading": "Section heading with emoji",
      "content": "Section content with markdown formatting"
    }
  ]
}

Generate the document now:`;

  return prompt;
}

/**
 * Generate audience-specific document using watsonx.ai
 */
export async function generateDocumentWithAI(audience, analysisData) {
  try {
    const client = getWatsonxClient();
    
    // Build context and prompt
    const context = buildRepositoryContext(analysisData);
    const prompt = buildAudiencePrompt(audience, context);

    // Call watsonx.ai for text generation
    const params = {
      input: prompt,
      modelId: config.watsonx.modelId,
      projectId: config.watsonx.projectId,
      parameters: {
        max_new_tokens: 2000,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 50,
        repetition_penalty: 1.1,
      },
    };

    console.log('Calling watsonx.ai for document generation...');
    const response = await client.generateText(params);
    
    if (!response.result || !response.result.results || response.result.results.length === 0) {
      throw new Error('No response from watsonx.ai');
    }

    const generatedText = response.result.results[0].generated_text;
    
    // Try to parse as JSON
    let document;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        document = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, using fallback structure');
      // Fallback: create a simple document structure
      document = {
        title: `AI-Generated Analysis for ${analysisData.repo.name}`,
        sections: [
          {
            heading: '📄 Generated Content',
            content: generatedText
          }
        ]
      };
    }

    // Validate document structure
    if (!document.title || !Array.isArray(document.sections)) {
      throw new Error('Invalid document structure from AI');
    }

    console.log('Document generated successfully with watsonx.ai');
    return document;

  } catch (error) {
    console.error('watsonx.ai generation error:', error);
    throw new Error(`Failed to generate document with watsonx.ai: ${error.message}`);
  }
}

/**
 * Check if watsonx.ai is configured
 */
export function isWatsonxConfigured() {
  return Boolean(config.watsonx.apiKey && config.watsonx.projectId);
}

// Made with Bob
