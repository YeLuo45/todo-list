import { spawn } from 'child_process';

/**
 * MCP Client implementing JSON-RPC 2.0 over stdio
 */
class MCPClient {
  constructor() {
    this.process = null;
    this.tools = [];
    this.status = 'disconnected';
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.messageBuffer = '';
  }

  /**
   * Connect to an MCP server
   * @param {string} command - The command to spawn
   * @param {string[]} args - Arguments for the command
   */
  connect(command, args = []) {
    if (this.process) {
      this.disconnect();
    }

    this.status = 'connecting';

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env }
        });

        this.process.stdout.on('data', (data) => {
          this.handleMessage(data.toString());
        });

        this.process.stderr.on('data', (data) => {
          console.error('[MCP Server Error]:', data.toString());
        });

        this.process.on('error', (err) => {
          this.status = 'error';
          this.pendingRequests.forEach(({ reject }) => reject(err));
          this.pendingRequests.clear();
        });

        this.process.on('close', (code) => {
          this.status = 'disconnected';
          this.tools = [];
          this.pendingRequests.forEach(({ reject }) => reject(new Error(`Process exited with code ${code}`)));
          this.pendingRequests.clear();
        });

        // Initialize and get tools
        this.initialize()
          .then(() => {
            this.status = 'connected';
            resolve();
          })
          .catch(reject);

      } catch (err) {
        this.status = 'error';
        reject(err);
      }
    });
  }

  /**
   * Disconnect from the MCP server
   */
  disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.status = 'disconnected';
    this.tools = [];
    this.pendingRequests.clear();
    this.messageBuffer = '';
  }

  /**
   * Get current connection status
   */
  getStatus() {
    return this.status;
  }

  /**
   * Handle incoming messages from stdout
   */
  handleMessage(data) {
    this.messageBuffer += data;
    
    // Try to parse complete JSON-RPC messages
    // MCP messages are newline-delimited JSON
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.processMessage(message);
        } catch (e) {
          console.error('[MCP] Failed to parse message:', line);
        }
      }
    }
  }

  /**
   * Process incoming JSON-RPC message
   */
  processMessage(message) {
    // Handle response to a request
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message || 'Unknown error'));
        } else {
          pending.resolve(message.result);
        }
      }
    }
    
    // Handle tool list notification
    if (message.method === 'notifications/tools_list_changed') {
      this.refreshTools();
    }
  }

  /**
   * Send JSON-RPC request
   */
  sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        reject(new Error('Not connected'));
        return;
      }

      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });

      this.process.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Initialize connection and get server info
   */
  async initialize() {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'hermes-todo-app',
        version: '1.0.0'
      }
    });
    
    // Send initialized notification
    this.process.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }) + '\n');

    // Get tools
    await this.refreshTools();
    
    return result;
  }

  /**
   * Refresh the tools list from server
   */
  async refreshTools() {
    try {
      const result = await this.listTools();
      this.tools = result.tools || [];
    } catch (e) {
      console.error('[MCP] Failed to refresh tools:', e);
    }
  }

  /**
   * List available tools
   */
  async listTools() {
    return this.sendRequest('tools/list');
  }

  /**
   * Call a tool by name with arguments
   */
  async callTool(name, args = {}) {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });
    return result;
  }
}

export default MCPClient;
