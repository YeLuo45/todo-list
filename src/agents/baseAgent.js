// Base Agent class - all agents inherit from this
export class BaseAgent {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.tools = [];
    this.subscriptions = [];
  }
  
  subscribe(event, callback) {
    this.subscriptions.push({ event, callback });
  }
  
  publish(event, data) {
    mcpOrchestrator.publish(event, data);
  }
  
  setTools(tools) {
    this.tools = tools;
  }
}
