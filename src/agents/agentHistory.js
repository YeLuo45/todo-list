/**
 * Agent Execution History — ruflo state machine pattern
 * Persists agent events to localStorage for audit/debug
 */

const HISTORY_KEY = 'hermes_agent_history';
const MAX_HISTORY = 500;

export const agentHistory = {
  _cache: null,

  _load() {
    if (this._cache !== null) return this._cache;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      this._cache = raw ? JSON.parse(raw) : [];
    } catch (e) {
      this._cache = [];
    }
    return this._cache;
  },

  _save() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this._cache));
    } catch (e) {
      console.warn('[agentHistory] Failed to save:', e);
    }
  },

  addRecord(agentId, event, data = {}) {
    const history = this._load();
    const record = {
      id: crypto.randomUUID(),
      agentId,
      event,
      data,
      timestamp: Date.now(),
    };
    history.unshift(record); // newest first
    if (history.length > MAX_HISTORY) {
      history.splice(MAX_HISTORY);
    }
    this._cache = history;
    this._save();
    return record;
  },

  getHistory(agentId = null, limit = 100) {
    const history = this._load();
    const filtered = agentId ? history.filter(r => r.agentId === agentId) : history;
    return filtered.slice(0, limit);
  },

  getAgents() {
    const history = this._load();
    const agents = [...new Set(history.map(r => r.agentId))];
    return agents;
  },

  clearHistory(agentId = null) {
    if (agentId) {
      this._cache = this._load().filter(r => r.agentId !== agentId);
    } else {
      this._cache = [];
    }
    this._save();
  },
};
