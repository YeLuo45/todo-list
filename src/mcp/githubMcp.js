import MCPClient from './mcpClient.js';
import { getServerConfig } from './serverManager.js';

/**
 * GitHub MCP Wrapper
 * Provides convenient methods for GitHub MCP operations
 */
class GitHubMCP {
  constructor() {
    this.client = new MCPClient();
    this.connected = false;
  }

  /**
   * Connect to GitHub MCP server
   * @param {Object} options - Connection options (e.g., GitHub token)
   */
  async connect(options = {}) {
    const config = getServerConfig('github');
    if (!config) {
      throw new Error('GitHub MCP server not found in registry');
    }

    // Pass GitHub token via environment variable
    if (options.token) {
      process.env.GITHUB_TOKEN = options.token;
    }

    await this.client.connect(config.command, config.args);
    this.connected = true;
  }

  /**
   * Disconnect from GitHub MCP server
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
   * Get repository issues
   * @param {Object} options - Options containing repo (owner/repo format)
   * @returns {Promise<Array>} List of issues
   */
  async getIssues({ repo }) {
    if (!this.connected) {
      throw new Error('Not connected to GitHub MCP');
    }

    const result = await this.client.callTool('getIssues', { repo });
    
    // Parse the result content if it's a text format
    if (result && result.content) {
      const content = result.content;
      if (Array.isArray(content)) {
        // MCP returns content as array of text parts
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
   * @param {Object} options - Issue options (repo, title, body)
   * @returns {Promise<Object>} Created issue
   */
  async createIssue({ repo, title, body }) {
    if (!this.connected) {
      throw new Error('Not connected to GitHub MCP');
    }

    const result = await this.client.callTool('createIssue', { repo, title, body });
    
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
   * Search code in repositories
   * @param {Object} options - Search options (query)
   * @returns {Promise<Array>} Search results
   */
  async searchCode({ query }) {
    if (!this.connected) {
      throw new Error('Not connected to GitHub MCP');
    }

    const result = await this.client.callTool('searchCode', { query });
    
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
const githubMCP = new GitHubMCP();

export default githubMCP;
