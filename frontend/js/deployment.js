// Deployment Management for Engineers
// Handles CD automation via Watsonx Orchestrate

class DeploymentManager {
  constructor() {
    this.currentDeployments = new Map();
    this.pollingIntervals = new Map();
  }

  apiBase() {
    return window.REPOTALK_API_BASE || '';
  }

  /**
   * Trigger a deployment
   */
  async triggerDeployment(owner, repo, options = {}) {
    try {
      const response = await fetch(`${this.apiBase()}/api/deployment/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          owner,
          repo,
          branch: options.branch || 'main',
          environment: options.environment || 'production',
          deploymentType: options.deploymentType || 'manual',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to trigger deployment');
      }

      const data = await response.json();
      
      if (data.success) {
        this.currentDeployments.set(data.deployment.id, data.deployment);
        this.startPolling(data.deployment.id);
        return data.deployment;
      }

      throw new Error('Deployment trigger failed');
    } catch (error) {
      console.error('Trigger deployment error:', error);
      throw error;
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(executionId) {
    try {
      const response = await fetch(
        `${this.apiBase()}/api/deployment/status/${executionId}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get deployment status');
      }

      const data = await response.json();
      return data.deployment;
    } catch (error) {
      console.error('Get deployment status error:', error);
      throw error;
    }
  }

  /**
   * List deployments for a repository
   */
  async listDeployments(owner, repo, limit = 10) {
    try {
      const response = await fetch(
        `${this.apiBase()}/api/deployment/list/${owner}/${repo}?limit=${limit}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to list deployments');
      }

      const data = await response.json();
      return data.deployments || [];
    } catch (error) {
      console.error('List deployments error:', error);
      return [];
    }
  }

  /**
   * Cancel a running deployment
   */
  async cancelDeployment(executionId) {
    try {
      const response = await fetch(
        `${this.apiBase()}/api/deployment/cancel/${executionId}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to cancel deployment');
      }

      this.stopPolling(executionId);
      const data = await response.json();
      return data.deployment;
    } catch (error) {
      console.error('Cancel deployment error:', error);
      throw error;
    }
  }

  /**
   * Start polling for deployment status
   */
  startPolling(executionId, interval = 5000) {
    if (this.pollingIntervals.has(executionId)) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const status = await this.getDeploymentStatus(executionId);
        
        // Update UI
        this.updateDeploymentUI(executionId, status);

        // Stop polling if deployment is complete
        if (
          status.status === 'completed' ||
          status.status === 'failed' ||
          status.status === 'cancelled'
        ) {
          this.stopPolling(executionId);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, interval);

    this.pollingIntervals.set(executionId, intervalId);
  }

  /**
   * Stop polling for deployment status
   */
  stopPolling(executionId) {
    const intervalId = this.pollingIntervals.get(executionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(executionId);
    }
  }

  /**
   * Update deployment UI
   */
  updateDeploymentUI(executionId, status) {
    const event = new CustomEvent('deploymentStatusUpdate', {
      detail: { executionId, status },
    });
    window.dispatchEvent(event);
  }

  /**
   * Format deployment status for display
   */
  formatStatus(status) {
    const statusMap = {
      initiated: { text: 'Initiated', color: 'blue', icon: '🚀' },
      running: { text: 'Running', color: 'yellow', icon: '⚙️' },
      completed: { text: 'Completed', color: 'green', icon: '✅' },
      failed: { text: 'Failed', color: 'red', icon: '❌' },
      cancelled: { text: 'Cancelled', color: 'gray', icon: '🚫' },
      unknown: { text: 'Unknown', color: 'gray', icon: '❓' },
    };

    return statusMap[status] || statusMap.unknown;
  }

  /**
   * Format duration
   */
  formatDuration(seconds) {
    if (!seconds) return 'N/A';
    
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  /**
   * Clean up all polling intervals
   */
  cleanup() {
    this.pollingIntervals.forEach((intervalId) => clearInterval(intervalId));
    this.pollingIntervals.clear();
    this.currentDeployments.clear();
  }
}

// Global deployment manager instance
window.deploymentManager = new DeploymentManager();

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  window.deploymentManager.cleanup();
});

// Made with Bob
