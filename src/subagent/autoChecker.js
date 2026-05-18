import { cronScheduler } from './cronScheduler.js';
import { metacognition } from '../memory/metacognition.js';

class AutoChecker {
  constructor() {
    this.checkInterval = null;
    this.lastWeeklyReport = null;
  }
  
  start() {
    // Check every minute for due/overdue tasks
    this.checkInterval = setInterval(() => this.checkTasks(), 60000);
    // Weekly report check (every hour)
    setInterval(() => this.checkWeeklyReport(), 3600000);
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
      
      // Overdue > 24 hours: auto-escalate priority
      if (timeDiff < -24 * 60 && task.priority !== 'high') {
        this.escalatePriority(task.id);
      }
    });
    
    // Check for duplicate recurring tasks
    this.detectDuplicatePatterns(tasks);
  }
  
  escalatePriority(taskId) {
    const store = window.__taskStore;
    if (!store) return;
    const tasks = store.getState().tasks;
    const task = tasks.find(t => t.id === taskId);
    if (task && task.priority !== 'high') {
      // Update priority to high
      store.setState({ 
        tasks: tasks.map(t => t.id === taskId ? { ...t, priority: 'high', updatedAt: new Date().toISOString() } : t)
      });
      metacognition.sendReminderNotification({ ...task, title: `🔺 优先级提升: ${task.title}` });
    }
  }
  
  detectDuplicatePatterns(tasks) {
    // Simple duplicate detection based on title similarity
    const titles = tasks.map(t => t.title.toLowerCase());
    const duplicates = [];
    
    for (let i = 0; i < titles.length; i++) {
      for (let j = i + 1; j < titles.length; j++) {
        if (this.similarity(titles[i], titles[j]) > 0.8) {
          duplicates.push([tasks[i].id, tasks[j].id]);
        }
      }
    }
    
    if (duplicates.length > 0 && Notification.permission === 'granted') {
      new Notification('🔄 检测到重复任务', {
        body: `发现 ${duplicates.length} 对相似任务，请检查是否重复创建`
      });
    }
  }
  
  similarity(a, b) {
    // Simple word overlap similarity
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union > 0 ? intersection / union : 0;
  }
  
  checkWeeklyReport() {
    const now = new Date();
    // Send report on Sunday at 20:00
    if (now.getDay() === 0 && now.getHours() === 20) {
      const lastReport = localStorage.getItem('last_weekly_report');
      if (lastReport !== now.toDateString()) {
        this.sendWeeklyReport();
        localStorage.setItem('last_weekly_report', now.toDateString());
      }
    }
  }
  
  sendWeeklyReport() {
    const tasks = window.__taskStore ? window.__taskStore.getState().tasks : [];
    const stats = metacognition.getStats(tasks);
    
    if (Notification.permission === 'granted') {
      new Notification('📊 本周任务报告', {
        body: `完成 ${stats.thisWeekCompleted} 个任务，连续 ${metacognition.getStreakDays(tasks)} 天 🎯`
      });
    }
  }
}

export const autoChecker = new AutoChecker();
