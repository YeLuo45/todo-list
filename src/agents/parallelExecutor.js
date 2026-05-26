/**
 * Parallel Executor — chatdev parallel agent execution pattern
 * Executes multiple agents in parallel and aggregates results
 */

import { mcpOrchestrator } from '../mcp/orchestrator.js';

// Agent instances registry
const AGENT_INSTANCES = {
  CreatorAgent: null,
  ReviewAgent: null,
  ReminderAgent: null,
};

export const parallelExecutor = {
  /**
   * Execute multiple agents in parallel
   * @param {string[]} agentIds - Array of agent IDs to execute
   * @param {object} taskData - Task data to pass to each agent
   * @returns {Promise<object[]>} - Array of results from each agent
   */
  async executeParallel(agentIds, taskData) {
    const promises = agentIds.map(agentId => {
      return this._executeAgent(agentId, taskData);
    });
    return Promise.all(promises);
  },

  /**
   * Execute a single agent and return result
   */
  async _executeAgent(agentId, taskData) {
    const agent = AGENT_INSTANCES[agentId];
    if (!agent) {
      return { agentId, success: false, error: `Agent ${agentId} not found` };
    }

    try {
      const startTime = Date.now();
      let result;

      // Handle different agent types
      if (agentId === 'CreatorAgent') {
        const task = agent.handleInput(taskData.input || taskData.title || '');
        result = { success: true, task, action: 'created' };
      } else if (agentId === 'ReviewAgent') {
        // ReviewAgent needs existing tasks context
        const existingTasks = window.__appStore?.getState?.()?.tasks || [];
        const reviewResult = agent.reviewTask({ task: taskData, source: 'parallel' });
        result = { success: true, review: reviewResult, action: 'reviewed' };
      } else if (agentId === 'ReminderAgent') {
        agent.scheduleReminder({ task: taskData });
        result = { success: true, action: 'reminder-set' };
      } else {
        result = { success: false, error: `Unknown agent type: ${agentId}` };
      }

      const duration = Date.now() - startTime;
      return {
        agentId,
        success: true,
        result,
        duration,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        agentId,
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  },

  /**
   * Register an agent instance
   */
  registerAgent(agentId, instance) {
    AGENT_INSTANCES[agentId] = instance;
  },

  /**
   * Aggregate results from multiple agents
   * @param {object[]} results - Array of results from executeParallel
   * @param {string} strategy - 'vote' | 'priority' | 'all'
   */
  aggregateResults(results, strategy = 'all') {
    const successful = results.filter(r => r.success);

    if (strategy === 'all') {
      return {
        strategy: 'all',
        total: results.length,
        successful: successful.length,
        results: successful,
      };
    }

    if (strategy === 'priority') {
      // Return first successful result (Creator > Review > Reminder)
      const priorityOrder = ['CreatorAgent', 'ReviewAgent', 'ReminderAgent'];
      const sorted = successful.sort((a, b) => {
        return priorityOrder.indexOf(a.agentId) - priorityOrder.indexOf(b.agentId);
      });
      return {
        strategy: 'priority',
        winner: sorted[0] || null,
        results: successful,
      };
    }

    if (strategy === 'vote') {
      // For voting, delegate to voting engine
      return {
        strategy: 'vote',
        results: successful,
        // Voting results need to be collected separately
      };
    }

    return { strategy: 'unknown', results: successful };
  },
};

// Auto-register built-in agents if available
if (typeof window !== 'undefined') {
  // Will be called after agent instances are created
}
