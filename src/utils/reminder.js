const CHECK_INTERVAL = 60000; // 1 minute

// Detect if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI;
};

// Import slack notifier dynamically to avoid circular dependency
let slackNotifier = null;
const getSlackNotifier = () => {
  if (!slackNotifier) {
    slackNotifier = import('./slackNotifier').then(m => m).catch(() => null);
  }
  return slackNotifier;
};

/**
 * Get reminder urgency level for visual highlighting
 * @param {object} task
 * @returns 'overdue' | 'urgent' | 'today' | 'upcoming' | null
 */
export function getReminderUrgency(task) {
  if (task.status === 'done' || !task.dueDate) return null;

  const now = new Date();
  const due = new Date(task.dueDate);
  const msPerHour = 3600000;
  const msPerDay = 86400000;

  // Overdue: past due date
  if (due < now) return 'overdue';

  // Urgent: within 1 hour
  if (due - now < msPerHour) return 'urgent';

  // Today: due today
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dueDay.getTime() === today.getTime()) return 'today';

  // Upcoming: within 24 hours
  if (due - now < msPerDay) return 'upcoming';

  return null;
}

/**
 * Check if a specific remindAt time has passed
 */
function isRemindAtDue(task) {
  if (!task.remindAt || task.reminded || task.status === 'done') return false;
  return new Date(task.remindAt) <= new Date();
}

/**
 * Check if remindBefore (1h/1d before) threshold is crossed
 */
function isRemindBeforeDue(task) {
  if (!task.remindBefore || task.reminded || task.status === 'done' || !task.dueDate) return false;
  const now = new Date();
  const due = new Date(task.dueDate);
  const msPerHour = 3600000;
  const msPerDay = 86400000;

  let threshold;
  if (task.remindBefore === '1h') threshold = msPerHour;
  else if (task.remindBefore === '1d') threshold = msPerDay;
  else return false;

  return (due - now) <= threshold && due > now;
}

export function checkReminders(tasks, onRemind) {
  tasks.forEach((task) => {
    if (task.status === 'done' || task.reminded) return;

    // Check exact remindAt
    if (isRemindAtDue(task)) {
      onRemind(task);
      return;
    }

    // Check remindBefore
    if (isRemindBeforeDue(task)) {
      onRemind(task);
      return;
    }
  });
}

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function sendNotification(task, reason = 'due') {
  let body = '';
  if (reason === '1h') body = `"${task.title}" 将在 1 小时后到期`;
  else if (reason === '1d') body = `"${task.title}" 将在 1 天后到期`;
  else if (reason === 'overdue') body = `"${task.title}" 已超期！`;
  else body = `"${task.title}" 到期了`;

  const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleString('zh-CN') : '';

  // Use Electron native notification if available
  if (isElectron() && window.electronAPI.showNotification) {
    window.electronAPI.showNotification({ title: '任务提醒', body });
    // Also send Slack notification
    getSlackNotifier().then(slack => {
      if (slack && slack.getSlackWebhookUrl()) {
        slack.sendSlackNotification(task, reason);
      }
    });
    return;
  }

  // Fallback to web notifications
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('任务提醒', { body, icon: '/vite.svg' });
  }

  // Also send Slack notification for web
  getSlackNotifier().then(slack => {
    if (slack && slack.getSlackWebhookUrl()) {
      slack.sendSlackNotification(task, reason);
    }
  });
}

export function startReminderLoop(tasks, markAsRead, checkInterval = CHECK_INTERVAL) {
  return setInterval(() => {
    checkReminders(tasks, (task) => {
      sendNotification(task);
      markAsRead(task.id);
    });
  }, checkInterval);
}
