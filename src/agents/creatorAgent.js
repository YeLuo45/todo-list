import { BaseAgent } from './baseAgent.js';
import { mcpOrchestrator } from '../mcp/orchestrator.js';

export class CreatorAgent extends BaseAgent {
  constructor() {
    super('CreatorAgent', 'Parses natural language into structured tasks');
    this.messageLog = [];
  }
  
  // Parse natural language into task object
  parseNaturalLanguage(input) {
    // Simple regex-based parser
    const task = {
      id: crypto.randomUUID(),
      title: input.trim(),
      description: '',
      dueDate: null,
      priority: 'medium',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completed: false
    };
    
    // Detect due date patterns
    const tomorrowMatch = input.match(/明天/);
    const nextWeekMatch = input.match(/下周/);
    const todayMatch = input.match(/今天/);
    
    if (tomorrowMatch) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      task.dueDate = tomorrow.toISOString().split('T')[0];
    } else if (nextWeekMatch) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      task.dueDate = nextWeek.toISOString().split('T')[0];
    } else if (todayMatch) {
      task.dueDate = new Date().toISOString().split('T')[0];
    }
    
    // Detect priority
    if (input.match(/紧急|urgent|重要/)) task.priority = 'high';
    if (input.match(/低优先级|low/)) task.priority = 'low';
    
    // Extract tags from #hashtags
    const tagMatches = input.match(/#(\w+)/g) || [];
    task.tags = tagMatches.map(t => t.slice(1));
    
    return task;
  }
  
  // Handle natural language input
  handleInput(input) {
    this.messageLog.push({ from: 'user', text: input, time: Date.now() });
    const task = this.parseNaturalLanguage(input);
    this.messageLog.push({ from: 'agent', text: `Created: ${task.title}`, time: Date.now() });
    this.publish('task:create', { task, source: 'creator' });
    return task;
  }
}
