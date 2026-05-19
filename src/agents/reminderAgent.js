import { BaseAgent } from './baseAgent.js';
import { mcpOrchestrator } from '../mcp/orchestrator.js';

export class ReminderAgent extends BaseAgent {
  constructor() {
    super('ReminderAgent', 'Sets up reminders for tasks with due dates');
    this.reminders = new Map();
    this.messageLog = [];
    this._reminderKey = 'hermes_reminder_agent_reminders';

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    mcpOrchestrator.subscribe('task:create', (data) => this.scheduleReminder(data));

    // Restore reminders from localStorage
    this._restoreReminders();
  }

  _restoreReminders() {
    try {
      const raw = localStorage.getItem(this._reminderKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const now = Date.now();
      for (const [taskId, reminder] of Object.entries(saved)) {
        if (reminder.notifyTime > now) {
          const task = { id: taskId, title: reminder.title, dueDate: reminder.dueDate };
          const timeoutId = setTimeout(() => {
            this.sendNotification(task);
            this.reminders.delete(taskId);
          }, reminder.notifyTime - now);
          this.reminders.set(taskId, { timeoutId, task, notifyTime: reminder.notifyTime });
          this.messageLog.push({ event: 'reminder-restored', task: reminder.title, notifyAt: new Date(reminder.notifyTime).toLocaleString(), time: Date.now() });
        }
      }
    } catch (e) {
      console.warn('[ReminderAgent] Failed to restore reminders:', e);
    }
  }

  _saveReminders() {
    try {
      const obj = {};
      for (const [taskId, reminder] of this.reminders) {
        obj[taskId] = { title: reminder.task.title, dueDate: reminder.task.dueDate, notifyTime: reminder.notifyTime };
      }
      localStorage.setItem(this._reminderKey, JSON.stringify(obj));
    } catch (e) {
      console.warn('[ReminderAgent] Failed to save reminders:', e);
    }
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
    this._saveReminders();
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
      this._saveReminders();
    }
  }
}
