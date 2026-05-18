// L4: Metacognition - predicts, warns, self-improves
const META_KEY = 'hermes_meta_v1';

export const metacognition = {
  getStats(tasks) {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const completedThisWeek = tasks.filter(t => 
      t.completed && t.updatedAt && new Date(t.updatedAt) >= weekAgo
    );
    const overdue = tasks.filter(t => 
      !t.completed && t.dueDate && new Date(t.dueDate) < now
    );
    
    return {
      totalTasks: tasks.length,
      completedCount: tasks.filter(t => t.completed).length,
      overdueCount: overdue.length,
      thisWeekCompleted: completedThisWeek.length,
      completionRate: tasks.length > 0 ? 
        (tasks.filter(t => t.completed).length / tasks.length).toFixed(2) : 0,
    };
  },
  
  predictDueDate(taskTitle, history = []) {
    // Simple prediction: if task recurs, use average of past due dates
    const matching = history.filter(t => 
      t.title.toLowerCase().includes(taskTitle.toLowerCase()) && t.dueDate
    );
    if (matching.length === 0) return null;
    
    const dueDates = matching.map(t => new Date(t.dueDate)).filter(d => !isNaN(d));
    if (dueDates.length === 0) return null;
    
    // Average interval between due dates
    const intervals = [];
    for (let i = 1; i < dueDates.length; i++) {
      intervals.push(dueDates[i-1] - dueDates[i]);
    }
    const avgInterval = intervals.length > 0 ? 
      intervals.reduce((a, b) => a + b, 0) / intervals.length : 7 * 24 * 60 * 60 * 1000;
    
    const lastDue = dueDates[0];
    const predicted = new Date(lastDue.getTime() + avgInterval);
    return predicted.toISOString().split('T')[0];
  },
  
  getStreakDays(tasks) {
    // Calculate consecutive days with completed tasks
    const completed = tasks
      .filter(t => t.completed && t.updatedAt)
      .map(t => t.updatedAt.split('T')[0])
      .sort()
      .reverse();
    
    if (completed.length === 0) return 0;
    
    const uniqueDays = [...new Set(completed)];
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < uniqueDays.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split('T')[0];
      if (uniqueDays.includes(expectedStr)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  },
  
  sendReminderNotification(task) {
    if (Notification.permission === 'granted') {
      new Notification(`🔔 任务提醒: ${task.title}`, {
        body: task.dueDate ? `截止日期: ${task.dueDate}` : '请尽快处理',
      });
    }
  }
};