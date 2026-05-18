import { BaseAgent } from './baseAgent.js';
import { mcpOrchestrator } from '../mcp/orchestrator.js';

export class ReminderAgent extends BaseAgent {
  constructor() {
    super('ReminderAgent', 'Sets up reminders for tasks with due dates');
    this.reminders = new Map();
    this.messageLog = [];
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    mcpOrchestrator.subscribe('task:create', (data) => this.scheduleReminder(data));
  }
  
  scheduleReminder({ task }) {
    if (!task.dueDate) return;
    
    const dueTime = new Date(task.dueDate).getTime();
    const now = Date.now();
    const notifyMinutesBefore = 30;
    const notifyTime = dueTime - (notifyMinutesBefore * 60 * 1000);
    
    if (notifyTime <= now) {
      this.messageLog.push({ event: 'reminder-skipped', reason: 'due time passed', task: task.title, time: Date.now() });
      return;
    }
    
    const timeoutId = setTimeout(() => {
      this.sendNotification(task);
      this.reminders.delete(task.id);
    }, notifyTime - now);
    
    this.reminders.set(task.id, { timeoutId, task, notifyTime });
    this.messageLog.push({ event: 'reminder-set', task: task.title, notifyAt: new Date(notifyTime).toLocaleString(), time: Date.now() });
  }
  
  sendNotification(task) {
    if (Notification.permission === 'granted') {
      new Notification(`Task Due Soon: ${task.title}`, {
        body: `Due at ${new Date(task.dueDate).toLocaleString()}`,
        icon: '/favicon.ico'
      });
    }
    this.messageLog.push({ event: 'notification-sent', task: task.title, time: Date.now() });
  }
  
  cancelReminder(taskId) {
    const reminder = this.reminders.get(taskId);
    if (reminder) {
      clearTimeout(reminder.timeoutId);
      this.reminders.delete(taskId);
    }
  }
}
