import mcpClient from './mcpClient.js';
import { getServerConfig } from './serverManager.js';

/**
 * Figma MCP Wrapper
 * Provides convenient methods for Figma MCP operations
 */
class FigmaMCP {
  constructor() {
    this.client = mcpClient;
    this.connected = false;
  }

  /**
   * Connect to Figma MCP server
   * @param {Object} options - Connection options (e.g., Figma access token)
   */
  async connect(options = {}) {
    const config = getServerConfig('figma');
    if (!config) {
      throw new Error('Figma MCP server not found in registry');
    }

    // Pass Figma token via environment variable
    if (options.token) {
      process.env.FIGMA_TOKEN = options.token;
    }

    await this.client.connect(config.command, config.args);
    this.connected = true;
  }

  /**
   * Disconnect from Figma MCP server
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
   * Get a Figma file
   * @param {string} fileKey - Figma file key (from URL)
   * @returns {Promise<Object>} File data
   */
  async getFile(fileKey) {
    if (!this.connected) {
      throw new Error('Not connected to Figma MCP');
    }

    const result = await this.client.callTool('getFile', { fileKey });
    
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
   * Get comments on a Figma file
   * @param {string} fileKey - Figma file key
   * @returns {Promise<Array>} List of comments
   */
  async getComments(fileKey) {
    if (!this.connected) {
      throw new Error('Not connected to Figma MCP');
    }

    const result = await this.client.callTool('getComments', { fileKey });
    
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
   * Post a comment on a Figma file
   * @param {string} fileKey - Figma file key
   * @param {string} message - Comment message
   * @returns {Promise<Object>} Created comment
   */
  async postComment(fileKey, message) {
    if (!this.connected) {
      throw new Error('Not connected to Figma MCP');
    }

    const result = await this.client.callTool('postComment', { fileKey, message });
    
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
const figmaMCP = new FigmaMCP();

export default figmaMCP;