// Base Agent class - all agents inherit from this
const AGENT_STATE_KEY = 'hermes_agent_state_';

export class BaseAgent {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.tools = [];
    this.subscriptions = [];
    this.messageLog = [];
    this.lastActive = Date.now();
    this.stateKey = AGENT_STATE_KEY + name;
  }

  subscribe(event, callback) {
    this.subscriptions.push({ event, callback });
  }

  publish(event, data) {
    this.lastActive = Date.now();
    mcpOrchestrator.publish(event, data);
  }

  setTools(tools) {
    this.tools = tools;
  }

  // State persistence - ruflo state machine pattern
  saveState() {
    const state = {
      messageLog: this.messageLog,
      lastActive: this.lastActive,
      subscriptions: this.subscriptions.map(s => s.event),
    };
    try {
      localStorage.setItem(this.stateKey, JSON.stringify(state));
    } catch (e) {
      console.warn(`[${this.name}] Failed to save state:`, e);
    }
  }

  loadState() {
    try {
      const raw = localStorage.getItem(this.stateKey);
      if (!raw) return false;
      const state = JSON.parse(raw);
      this.messageLog = state.messageLog || [];
      this.lastActive = state.lastActive || Date.now();
      return true;
    } catch (e) {
      console.warn(`[${this.name}] Failed to load state:`, e);
      return false;
    }
  }

  clearState() {
    try {
      localStorage.removeItem(this.stateKey);
      this.messageLog = [];
    } catch (e) {
      console.warn(`[${this.name}] Failed to clear state:`, e);
    }
  }
}
