/**
 * Voting Engine — chatdev multi-agent voting pattern
 * Handles voting when multiple agents need to reach consensus
 */

const VOTING_KEY = 'hermes_voting_state';

export const votingEngine = {
  _currentVote: null,

  /**
   * Start a new voting session
   */
  startVoting(question, options) {
    this._currentVote = {
      question,
      options: options.map(opt => ({ id: opt.id || opt, label: opt.label || opt, votes: [] })),
      voters: new Set(),
      startTime: Date.now(),
      status: 'open',
    };
    this._saveVote();
    return this._currentVote;
  },

  /**
   * Cast a vote from an agent
   */
  castVote(agentId, optionId) {
    if (!this._currentVote || this._currentVote.status !== 'open') {
      return { success: false, error: 'No active voting session' };
    }

    if (this._currentVote.voters.has(agentId)) {
      return { success: false, error: `${agentId} has already voted` };
    }

    const option = this._currentVote.options.find(o => o.id === optionId);
    if (!option) {
      return { success: false, error: `Invalid option: ${optionId}` };
    }

    option.votes.push({ agentId, timestamp: Date.now() });
    this._currentVote.voters.add(agentId);
    this._saveVote();

    return { success: true, optionId, totalVotes: option.votes.length };
  },

  /**
   * Get current vote status
   */
  getCurrentVote() {
    return this._currentVote;
  },

  /**
   * Tally votes for all options
   */
  tallyVotes() {
    if (!this._currentVote) return null;

    return this._currentVote.options.map(opt => ({
      id: opt.id,
      label: opt.label,
      votes: opt.votes.length,
      voters: opt.votes.map(v => v.agentId),
    }));
  },

  /**
   * Get the winning option(s)
   */
  getWinner() {
    if (!this._currentVote) return null;

    const tallied = this.tallyVotes();
    const maxVotes = Math.max(...tallied.map(o => o.votes));

    if (maxVotes === 0) return null;

    return tallied.filter(o => o.votes === maxVotes);
  },

  /**
   * Close voting and get results
   */
  closeVoting() {
    if (!this._currentVote) return null;

    this._currentVote.status = 'closed';
    this._currentVote.endTime = Date.now();
    const results = {
      question: this._currentVote.question,
      winner: this.getWinner(),
      tallied: this.tallyVotes(),
      totalVoters: this._currentVote.voters.size,
    };
    this._saveVote();
    return results;
  },

  /**
   * Get voting history from localStorage
   */
  getHistory(limit = 10) {
    try {
      const raw = localStorage.getItem(VOTING_KEY + '_history');
      if (!raw) return [];
      const history = JSON.parse(raw);
      return history.slice(0, limit);
    } catch (e) {
      return [];
    }
  },

  /**
   * Save current vote to localStorage
   */
  _saveVote() {
    if (!this._currentVote) return;
    try {
      // Save current vote state
      localStorage.setItem(VOTING_KEY, JSON.stringify(this._currentVote));

      // Update history
      const historyKey = VOTING_KEY + '_history';
      const raw = localStorage.getItem(historyKey);
      const history = raw ? JSON.parse(raw) : [];
      history.unshift({
        question: this._currentVote.question,
        status: this._currentVote.status,
        voters: Array.from(this._currentVote.voters),
        startTime: this._currentVote.startTime,
      });
      // Keep last 50 voting sessions
      if (history.length > 50) history.splice(50);
      localStorage.setItem(historyKey, JSON.stringify(history));
    } catch (e) {
      console.warn('[votingEngine] Failed to save vote:', e);
    }
  },
};
