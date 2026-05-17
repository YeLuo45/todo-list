/**
 * Milestone Generation Logic
 * Automatically identifies deadline clusters as milestones
 */

import { v4 as uuidv4 } from 'uuid';

export const MILESTONE_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#eab308', // yellow
  '#6366f1', // indigo
  '#22c55e', // green
];

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
const MODEL = 'MiniMax-Text-01';
const AI_TOKEN_KEY = 'hermes_ai_token';

/**
 * Get AI API token
 */
function getAPIToken() {
  return localStorage.getItem(AI_TOKEN_KEY) || localStorage.getItem('hermes_github_token') || null;
}

/**
 * Call MiniMax API
 */
async function callMiniMaxAPI(prompt, apiToken) {
  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Generate AI-powered milestone name
 * @param {Array} clusterTasks - Tasks in this milestone cluster
 * @returns {Promise<string>} AI-generated milestone name
 */
async function generateAIMilestoneName(clusterTasks) {
  const token = getAPIToken();
  if (!token) {
    // Fallback to simple naming
    return generateSimpleMilestoneName(clusterTasks);
  }

  const taskList = clusterTasks.map(t => {
    const urgency = getTaskUrgency(t);
    return `- ${t.title} (${urgency})`;
  }).join('\n');

  const prompt = `分析以下任务，为这个里程碑生成一个简洁的中文名称（不超过20字）。

任务列表：
${taskList}

请分析：
1. 任务的共同主题或类型
2. 截止日期的紧急程度（如：本周、月结、季度末等）
3. 任务的整体规模

要求：
1. 名称要简洁，不超过20字
2. 使用表情符号增加可读性（如：📅、🎯、🔥、⚡等）
3. 格式示例："📅 本周紧急交付（3个任务）"、"🎯 月末冲刺阶段（5个任务）"
4. 只返回名称，不要有其他解释`;

  try {
    const content = await callMiniMaxAPI(prompt, token);
    // Clean up the response
    let name = content.trim();
    // Remove quotes if present
    if ((name.startsWith('"') && name.endsWith('"')) || 
        (name.startsWith('「') && name.endsWith('」'))) {
      name = name.slice(1, -1);
    }
    // Ensure it doesn't exceed 20 chars
    if (name.length > 20) {
      name = name.substring(0, 17) + '...';
    }
    if (name.length > 0) {
      return name;
    }
  } catch (error) {
    console.error('AI milestone naming error:', error);
  }

  return generateSimpleMilestoneName(clusterTasks);
}

/**
 * Get simple milestone name without AI
 */
function generateSimpleMilestoneName(clusterTasks) {
  if (clusterTasks.length === 0) return '📍 里程碑';
  
  if (clusterTasks.length === 1) {
    const t = clusterTasks[0];
    const urgency = getTaskUrgency(t);
    return `📍 ${urgency}${t.title.substring(0, 10)}${t.title.length > 10 ? '...' : ''}`;
  }

  // Analyze date range
  const dates = clusterTasks.map(t => new Date(t.dueDate));
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const daysUntilMin = Math.ceil((minDate - now) / (1000 * 60 * 60 * 24));
  
  let prefix = '📅 ';
  if (daysUntilMin <= 0) {
    prefix = '🔥 ';
  } else if (daysUntilMin <= 3) {
    prefix = '⚡ ';
  } else if (daysUntilMin <= 7) {
    prefix = '📆 ';
  } else if (daysUntilMin <= 14) {
    prefix = '🎯 ';
  } else {
    prefix = '📌 ';
  }

  const endStr = minDate.toDateString() === maxDate.toDateString() 
    ? '' 
    : '-' + maxDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

  return `${prefix}${minDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}${endStr}（${clusterTasks.length}个任务）`;
}

/**
 * Get task urgency label
 */
function getTaskUrgency(task) {
  if (!task.dueDate) return '';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadline = new Date(task.dueDate);
  deadline.setHours(0, 0, 0, 0);
  const days = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  
  if (days < 0) return '🔴 ';
  if (days === 0) return '🔥 ';
  if (days <= 3) return '⚡ ';
  if (days <= 7) return '📆 ';
  return '';
}

/**
 * Generate milestones from tasks with deadlines
 * Groups tasks with deadlines within 3 days of each other
 * @param {Array} tasks - All tasks
 * @returns {Promise<Array>} Array of milestone objects
 */
export async function generateMilestones(tasks) {
  // Filter tasks with deadlines that are not done
  const tasksWithDeadlines = tasks
    .filter(t => t.dueDate && t.status !== 'done')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  if (tasksWithDeadlines.length === 0) return [];

  const clusters = [];
  let currentCluster = [];
  let clusterStartDate = null;

  for (const task of tasksWithDeadlines) {
    const taskDate = new Date(task.dueDate);
    taskDate.setHours(0, 0, 0, 0);

    if (currentCluster.length === 0) {
      currentCluster = [task];
      clusterStartDate = taskDate;
    } else {
      const daysDiff = Math.ceil((taskDate - clusterStartDate) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 3) {
        currentCluster.push(task);
      } else {
        clusters.push(currentCluster);
        currentCluster = [task];
        clusterStartDate = taskDate;
      }
    }
  }
  
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Generate milestones with AI naming
  const milestones = [];
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const dates = cluster.map(t => new Date(t.dueDate));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    const milestone = {
      id: uuidv4(),
      title: await generateAIMilestoneName(cluster),
      deadline: minDate.toISOString().split('T')[0],
      taskIds: cluster.map(t => t.id),
      color: MILESTONE_COLORS[i % MILESTONE_COLORS.length],
      isAutoGenerated: true
    };

    milestones.push(milestone);
  }

  return milestones;
}

/**
 * Create a manual milestone
 */
export function createMilestone(title, deadline, taskIds = [], color = null) {
  return {
    id: uuidv4(),
    title,
    deadline,
    taskIds,
    color: color || MILESTONE_COLORS[Math.floor(Math.random() * MILESTONE_COLORS.length)],
    isAutoGenerated: false
  };
}
