import { cronScheduler } from './cronScheduler.js';
import { metacognition } from '../memory/metacognition.js';

class AutoChecker {
  constructor() {
    this.checkInterval = null;
  }
  
  start() {
    // Check every minute for due/overdue tasks
    this.checkInterval = setInterval(() => this.checkTasks(), 60000);
  }
  
  stop() {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }
  
  checkTasks() {
    const tasks = window.__taskStore ? window.__taskStore.getState().tasks : [];
    const now = new Date();
    
    tasks.forEach(task => {
      if (task.completed || !task.dueDate) return;
      
      const due = new Date(task.dueDate);
      const timeDiff = due - now;
      const minutes = timeDiff / (1000 * 60);
      
      // Due in 30 minutes
      if (minutes <= 30 && minutes > 0) {
        metacognition.sendReminderNotification({ ...task, title: `⏰ ${task.title}` });
      }
      
      // Overdue
      if (timeDiff < 0 && minutes > -60) {
        metacognition.sendReminderNotification({ ...task, title: `⚠️ 逾期: ${task.title}` });
      }
    });
  }
}

export const autoChecker = new AutoChecker();