// Cron Scheduler - schedules tasks to run at specific times
// Uses setTimeout-based scheduling (browser compatible)

const scheduledTasks = new Map(); // taskId -> { timeoutId, expression, nextRun }

export const cronScheduler = {
  // Parse simple cron-like expressions (not full cron, simplified)
  // "* * * * *" = every minute
  // "0 * * * *" = every hour
  // "0 9 * * *" = every day at 9am
  parse(expression) {
    const parts = expression.trim().split(' ');
    if (parts.length !== 5) return null;
    return { minute: parts[0], hour: parts[1], day: parts[2], month: parts[3], weekday: parts[4] };
  },
  
  getNextRun(expression) {
    const parsed = this.parse(expression);
    if (!parsed) return null;
    
    const now = new Date();
    const next = new Date(now);
    
    // Simplified: support "0 HH * * *" (daily at hour HH)
    // and "* * * * *" (every minute for testing)
    if (parsed.minute !== '*' && parsed.hour !== '*') {
      next.setHours(parseInt(parsed.hour), parseInt(parsed.minute), 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
    } else if (parsed.minute !== '*') {
      next.setMinutes(parseInt(parsed.minute), 0, 0);
      if (next <= now) next.setHours(next.getHours() + 1);
    }
    
    return next;
  },
  
  scheduleTask(taskId, cronExpression, callback) {
    // Cancel existing
    this.cancelScheduled(taskId);
    
    const delay = 60000; // check every minute
    const timeoutId = setInterval(() => {
      const nextRun = this.getNextRun(cronExpression);
      if (nextRun && Date.now() >= nextRun.getTime() - 60000) {
        callback(taskId);
      }
    }, delay);
    
    scheduledTasks.set(taskId, { timeoutId, expression: cronExpression, nextRun: this.getNextRun(cronExpression) });
    return true;
  },
  
  cancelScheduled(taskId) {
    const scheduled = scheduledTasks.get(taskId);
    if (scheduled) {
      clearInterval(scheduled.timeoutId);
      scheduledTasks.delete(taskId);
    }
  },
  
  getScheduledTasks() {
    return Array.from(scheduledTasks.entries()).map(([taskId, data]) => ({
      taskId,
      expression: data.expression,
      nextRun: data.nextRun
    }));
  }
};