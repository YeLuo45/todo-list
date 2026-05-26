import { BaseAgent } from './baseAgent.js';
import { mcpOrchestrator } from '../mcp/orchestrator.js';

// Simple edit distance for similarity
function editDistance(a, b) {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      matrix[j][i] = Math.min(matrix[j][i-1] + 1, matrix[j-1][i] + 1, matrix[j-1][i-1] + cost);
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a, b) {
  const dist = editDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

export class ReviewAgent extends BaseAgent {
  constructor() {
    super('ReviewAgent', 'Checks for duplicate tasks and suggests priority');
    this.messageLog = [];
    
    // Subscribe to task creation
    mcpOrchestrator.subscribe('task:create', (data) => this.reviewTask(data));
  }
  
  reviewTask({ task, source }) {
    this.messageLog.push({ event: 'review-start', task: task.title, time: Date.now() });
    
    const issues = [];
    const existingTasks = this.getExistingTasks();
    
    // Check for duplicates
    for (const existing of existingTasks) {
      if (similarity(existing.title, task.title) > 0.8) {
        issues.push({ type: 'duplicate', message: `Similar task exists: "${existing.title}"`, existingTask: existing });
      }
    }
    
    // Suggest priority based on due date
    if (task.dueDate) {
      const daysUntilDue = Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue <= 1 && task.priority !== 'high') {
        issues.push({ type: 'priority', message: `Due soon (${daysUntilDue} days), suggest high priority` });
      }
    }
    
    const reviewResult = { taskId: task.id, issues, approved: issues.filter(i => i.type === 'duplicate').length === 0 };
    this.messageLog.push({ event: 'review-complete', result: reviewResult, time: Date.now() });
    
    this.publish('task:review-complete', { task, review: reviewResult });
    return reviewResult;
  }
  
  getExistingTasks() {
    // Get tasks from TaskContext - will be injected via props
    return window.__appStore ? window.__appStore.getState().tasks || [] : [];
  }
}
