// Event-driven tool orchestrator (nanobot MessageBus pattern)
class MCPOrchestrator {
  constructor() {
    this.tools = {};        // { toolId: handler }
    this.subscribers = {};  // { event: [callback] }
    this.executionLog = []; // { id, timestamp, chain, input, output, status }
  }
  
  registerTool(toolId, handler) {
    this.tools[toolId] = handler;
  }
  
  async executeChain(toolIds, initialInput) {
    // Chain execution: each tool output as next tool input
    let result = initialInput;
    const chain = toolIds;
    const logId = crypto.randomUUID();
    this.executionLog.push({ id: logId, timestamp: Date.now(), chain, input: initialInput, output: null, status: 'running' });
    
    for (const toolId of toolIds) {
      if (!this.tools[toolId]) throw new Error(`Tool ${toolId} not registered`);
      result = await this.tools[toolId](result);
    }
    
    const logEntry = this.executionLog.find(l => l.id === logId);
    logEntry.output = result;
    logEntry.status = 'completed';
    return result;
  }
  
  subscribe(event, callback) {
    if (!this.subscribers[event]) this.subscribers[event] = [];
    this.subscribers[event].push(callback);
    return () => this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
  }
  
  publish(event, data) {
    const callbacks = this.subscribers[event] || [];
    callbacks.forEach(cb => cb(data));
  }
  
  getExecutionLog() {
    return this.executionLog;
  }
}

export const mcpOrchestrator = new MCPOrchestrator();
