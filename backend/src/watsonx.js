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

// Made with Bob
