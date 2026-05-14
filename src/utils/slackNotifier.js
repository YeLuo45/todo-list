/**
 * Slack Notifier Utility
 * Sends notifications via Slack Webhook
 */

const SLACK_WEBHOOK_STORAGE = 'hermes_slack_webhook_url';

/**
 * Get stored webhook URL
 */
export function getSlackWebhookUrl() {
  return localStorage.getItem(SLACK_WEBHOOK_STORAGE) || '';
}

/**
 * Set webhook URL
 */
export function setSlackWebhookUrl(url) {
  if (url && url.trim()) {
    localStorage.setItem(SLACK_WEBHOOK_STORAGE, url.trim());
  } else {
    localStorage.removeItem(SLACK_WEBHOOK_STORAGE);
  }
}

/**
 * Format deadline countdown
 * @param {string} dueDate - ISO date string
 * @returns {string} - Human readable countdown
 */
function formatCountdown(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due - now;

  if (diff < 0) {
    const overdue = Math.abs(diff);
    const hours = Math.floor(overdue / 3600000);
    const days = Math.floor(overdue / 86400000);
    if (days > 0) return `已超期 ${days} 天`;
    return `已超期 ${hours} 小时`;
  }

  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `剩余 ${days} 天 ${hours % 24} 小时`;
  if (hours > 0) return `剩余 ${hours} 小时`;
  const minutes = Math.floor(diff / 60000);
  return `剩余 ${minutes} 分钟`;
}

/**
 * Send a Slack notification for a task
 * @param {object} task - Task object with title, dueDate, content
 * @param {string} reason - Reason for notification: '1h', '1d', 'overdue', 'due'
 * @returns {Promise<boolean>} - Success status
 */
export async function sendSlackNotification(task, reason = 'due') {
  const webhookUrl = getSlackWebhookUrl();
  if (!webhookUrl) {
    console.warn('[SlackNotifier] Webhook URL not configured');
    return false;
  }

  let countdownText = '';
  if (task.dueDate) {
    countdownText = formatCountdown(task.dueDate);
  }

  // Build message based on reason
  let emoji = '📋';
  let title = '任务到期提醒';
  
  if (reason === '1h') {
    emoji = '⏰';
    title = '⏰ 任务即将到期（1小时后）';
  } else if (reason === '1d') {
    emoji = '📅';
    title = '📅 任务即将到期（1天后）';
  } else if (reason === 'overdue') {
    emoji = '🚨';
    title = '🚨 任务已超期！';
  }

  const taskLink = `${window.location.href}`;
  const dueDateStr = task.dueDate ? new Date(task.dueDate).toLocaleString('zh-CN') : '未设置';

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: emoji + ' ' + title,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*任务:*\n${task.title}`,
          },
          {
            type: 'mrkdwn',
            text: `*截止时间:*\n${dueDateStr}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*状态:*\n${countdownText}`,
          },
        ],
      },
    ],
  };

  if (task.content) {
    payload.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*描述:*\n${task.content.substring(0, 200)}${task.content.length > 200 ? '...' : ''}`,
      },
    });
  }

  payload.blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '查看任务',
          emoji: true,
        },
        url: taskLink,
        action_id: 'view_task',
      },
    ],
  });

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[SlackNotifier] Failed to send notification:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SlackNotifier] Error sending notification:', error);
    return false;
  }
}
