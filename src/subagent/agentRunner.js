// Subagent Runner - spawns parallel task execution via Web Workers
class AgentRunner {
  constructor() {
    this.agents = new Map(); // id -> { status, worker, createdAt }
  }
  
  async spawnAgent(agentConfig) {
    const id = crypto.randomUUID();
    // Create inline worker for task execution
    const workerCode = `
      self.onmessage = async function(e) {
        const { taskId, taskData, action } = e.data;
        try {
          // Simulate task execution
          let result = { taskId, status: 'running', output: null };
          self.postMessage({ type: 'status', ...result });
          
          // Execute based on action
          await new Promise(r => setTimeout(r, 1000)); // simulate work
          result = { taskId, status: 'completed', output: 'done' };
          self.postMessage({ type: 'complete', ...result });
        } catch (err) {
          self.postMessage({ type: 'error', taskId, error: err.message });
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    
    const agent = {
      id,
      status: 'running',
      worker,
      createdAt: Date.now(),
      config: agentConfig
    };
    
    worker.onmessage = (e) => {
      if (e.data.type === 'complete' || e.data.type === 'error') {
        agent.status = e.data.type === 'complete' ? 'completed' : 'error';
      }
    };
    
    this.agents.set(id, agent);
    return id;
  }
  
  getAgentStatus(agentId) {
    const agent = this.agents.get(agentId);
    return agent ? { id: agent.id, status: agent.status, createdAt: agent.createdAt } : null;
  }
  
  getAllAgents() {
    return Array.from(this.agents.values()).map(a => ({
      id: a.id, status: a.status, createdAt: a.createdAt, config: a.config
    }));
  }
  
  terminateAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.worker.terminate();
      this.agents.delete(agentId);
    }
  }
  
  cleanup() {
    this.agents.forEach(a => a.worker.terminate());
    this.agents.clear();
  }
}

export const agentRunner = new AgentRunner();