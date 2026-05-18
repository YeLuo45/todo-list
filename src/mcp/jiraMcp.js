import mcpClient from './mcpClient.js';
import { getServerConfig } from './serverManager.js';

/**
 * Jira MCP Wrapper
 * Provides convenient methods for Jira MCP operations
 */
class JiraMCP {
  constructor() {
    this.client = mcpClient;
    this.connected = false;
  }

  /**
   * Connect to Jira MCP server
   * @param {Object} options - Connection options (e.g., Jira URL, email, token)
   */
  async connect(options = {}) {
    const config = getServerConfig('jira');
    if (!config) {
      throw new Error('Jira MCP server not found in registry');
    }

    // Pass Jira credentials via environment variables
    if (options.url) {
      process.env.JIRA_URL = options.url;
    }
    if (options.email) {
      process.env.JIRA_EMAIL = options.email;
    }
    if (options.token) {
      process.env.JIRA_TOKEN = options.token;
    }

    await this.client.connect(config.command, config.args);
    this.connected = true;
  }

  /**
   * Disconnect from Jira MCP server
   */
  disconnect() {
    this.client.disconnect();
    this.connected = false;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return this.client.getStatus();
  }

  /**
   * Get Jira projects
   * @returns {Promise<Array>} List of projects
   */
  async getProjects() {
    if (!this.connected) {
      throw new Error('Not connected to Jira MCP');
    }

    const result = await this.client.callTool('getProjects', {});
    
    if (result && result.content) {
      const content = result.content;
      if (Array.isArray(content)) {
        const text = content.map(c => c.text || '').join('');
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
      return content;
    }
    
    return result;
  }

  /**
   * Get issues for a project
   * @param {string} projectKey - Jira project key (e.g., 'PROJ')
   * @returns {Promise<Array>} List of issues
   */
  async getIssues(projectKey) {
    if (!this.connected) {
      throw new Error('Not connected to Jira MCP');
    }

    const result = await this.client.callTool('getIssues', { projectKey });
    
    if (result && result.content) {
      const content = result.content;
      if (Array.isArray(content)) {
        const text = content.map(c => c.text || '').join('');
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
      return content;
    }
    
    return result;
  }

  /**
   * Create a new issue
   * @param {string} projectKey - Jira project key
   * @param {string} title - Issue title
   * @param {string} description - Issue description
   * @param {string} priority - Priority (e.g., 'High', 'Medium', 'Low')
   * @returns {Promise<Object>} Created issue
   */
  async createIssue(projectKey, title, description, priority = 'Medium') {
    if (!this.connected) {
      throw new Error('Not connected to Jira MCP');
    }

    const result = await this.client.callTool('createIssue', {
      projectKey,
      title,
      description,
      priority
    });
    
    if (result && result.content) {
      const content = result.content;
      if (Array.isArray(content)) {
        const text = content.map(c => c.text || '').join('');
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
      return content;
    }
    
    return result;
  }

  /**
   * Update an existing issue
   * @param {string} issueId - Jira issue ID or key
   * @param {Object} fields - Fields to update
   * @returns {Promise<Object>} Updated issue
   */
  async updateIssue(issueId, fields) {
    if (!this.connected) {
      throw new Error('Not connected to Jira MCP');
    }

    const result = await this.client.callTool('updateIssue', {
      issueId,
      ...fields
    });
    
    if (result && result.content) {
      const content = result.content;
      if (Array.isArray(content)) {
        const text = content.map(c => c.text || '').join('');
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
      return content;
    }
    
    return result;
  }
}

// Singleton instance
const jiraMCP = new JiraMCP();

export default jiraMCP;