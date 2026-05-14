/**
 * Google Calendar Sync Utility
 * Uses Google Calendar API v3 (public API, no OAuth needed)
 */

const GCAL_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GCAL_API_KEY_STORAGE = 'hermes_gcal_api_key';

/**
 * Get stored API Key
 */
export function getGoogleCalendarApiKey() {
  return localStorage.getItem(GCAL_API_KEY_STORAGE) || '';
}

/**
 * Set API Key
 */
export function setGoogleCalendarApiKey(apiKey) {
  if (apiKey && apiKey.trim()) {
    localStorage.setItem(GCAL_API_KEY_STORAGE, apiKey.trim());
  } else {
    localStorage.removeItem(GCAL_API_KEY_STORAGE);
  }
}

/**
 * Create a Google Calendar event for a single task
 * @param {object} task - Task object with title, dueDate, content, etc.
 * @returns {Promise<object>} - Created event data
 */
export async function exportToGoogleCalendar(task) {
  const apiKey = getGoogleCalendarApiKey();
  if (!apiKey) {
    throw new Error('Google Calendar API Key 未配置，请在设置中配置');
  }

  if (!task.dueDate) {
    throw new Error('任务没有截止日期，无法导出到日历');
  }

  const dueDate = new Date(task.dueDate);
  // Set event time to 9 AM on the due date
  const startDateTime = new Date(dueDate);
  startDateTime.setHours(9, 0, 0, 0);
  const endDateTime = new Date(dueDate);
  endDateTime.setHours(10, 0, 0, 0);

  // Build description with task link if available
  let description = task.content || '';
  if (task.content) {
    description += '\n\n';
  }
  description += `任务链接: ${window.location.href}`;

  const event = {
    summary: task.title,
    description: description,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 }, // 1 hour before
        { method: 'popup', minutes: 1440 }, // 1 day before
      ],
    },
  };

  const response = await fetch(`${GCAL_API_BASE}/calendars/primary/events?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Google Calendar API 错误: ${error.error?.message || response.status}`);
  }

  return await response.json();
}

/**
 * Export all tasks with deadlines to Google Calendar
 * @param {array} tasks - Array of task objects
 * @returns {Promise<object>} - Results with success and failure counts
 */
export async function exportAllToGoogleCalendar(tasks) {
  const tasksWithDeadline = tasks.filter(t => t.dueDate && t.status !== 'done');
  
  const results = {
    total: tasksWithDeadline.length,
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const task of tasksWithDeadline) {
    try {
      await exportToGoogleCalendar(task);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({ taskId: task.id, taskTitle: task.title, error: error.message });
    }
  }

  return results;
}
