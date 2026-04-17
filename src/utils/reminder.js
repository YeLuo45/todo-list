const CHECK_INTERVAL = 60000; // 1 minute

// Detect if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI;
};

export function checkReminders(tasks, onRemind) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  tasks.forEach((task) => {
    if (task.status === 'done' || !task.dueDate || task.reminded) return;

    const dueDate = new Date(task.dueDate);
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    // Check if due today or overdue (yesterday or before)
    if (dueDay <= today) {
      onRemind(task);
    }
  });
}

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function sendNotification(task) {
  const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';
  
  // Use Electron native notification if available
  if (isElectron() && window.electronAPI.showNotification) {
    window.electronAPI.showNotification({
      title: 'Task Reminder',
      body: `"${task.title}" is due on ${dueDate}`
    });
    return;
  }
  
  // Fallback to web notifications
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Task Reminder', {
      body: `"${task.title}" is due on ${dueDate}`,
      icon: '/vite.svg',
    });
  }
}

export function startReminderLoop(tasks, markAsRead, checkInterval = CHECK_INTERVAL) {
  return setInterval(() => {
    checkReminders(tasks, (task) => {
      sendNotification(task);
      markAsRead(task.id);
    });
  }, checkInterval);
}
