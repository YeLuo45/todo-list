/**
 * AI Task Completion Time Prediction
 * Analyzes historical tasks and subtask estimates to predict completion time
 */

import { getAPIToken } from './aiSubtask';

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
const MODEL = 'MiniMax-Text-01';

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
 * Find similar tasks in the same project
 */
function findSimilarTasks(task, allTasks) {
  const taskProject = task.projectId;
  const taskTags = new Set(task.tags || []);
  
  return allTasks.filter(t => {
    if (t.id === task.id) return false;
    if (t.status !== 'done') return false;
    if (!t.endTime || !t.startTime) return false;
    
    // Same project is highly relevant
    if (taskProject && t.projectId === taskProject) return true;
    
    // Shared tags indicate similarity
    const tTags = new Set(t.tags || []);
    const sharedTags = [...taskTags].filter(tag => tTags.has(tag));
    if (sharedTags.length >= 1) return true;
    
    // Similar title keywords
    const taskWords = task.title.toLowerCase().split(/\s+/);
    const tWords = t.title.toLowerCase().split(/\s+/);
    const commonWords = taskWords.filter(w => w.length > 2 && tWords.includes(w));
    if (commonWords.length >= 2) return true;
    
    return false;
  });
}

/**
 * Calculate completion time from historical tasks
 */
function analyzeHistoricalData(similarTasks) {
  if (similarTasks.length === 0) return null;

  const completionTimes = similarTasks.map(t => {
    const start = new Date(t.startTime);
    const end = new Date(t.endTime);
    return (end - start) / (1000 * 60 * 60 * 24); // Convert to days
  }).filter(days => days > 0 && days < 365); // Filter reasonable values

  if (completionTimes.length === 0) return null;

  const avgDays = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;
  const variance = completionTimes.reduce((sum, days) => sum + Math.pow(days - avgDays, 2), 0) / completionTimes.length;
  const stdDev = Math.sqrt(variance);

  // Determine confidence based on sample size and variance
  let confidence = 'low';
  if (similarTasks.length >= 5 && stdDev < avgDays * 0.3) {
    confidence = 'high';
  } else if (similarTasks.length >= 2 && stdDev < avgDays * 0.5) {
    confidence = 'medium';
  }

  return {
    estimatedDays: Math.round(avgDays * 10) / 10,
    confidence,
    sampleSize: similarTasks.length,
    stdDev: Math.round(stdDev * 10) / 10
  };
}

/**
 * Calculate based on subtask estimates
 */
function calculateFromSubtasks(task) {
  const subtasks = task.subtasks || [];
  if (subtasks.length === 0) return null;

  const totalMinutes = subtasks.reduce((sum, st) => {
    if (st.done) return sum;
    return sum + (st.estimatedMinutes || 30);
  }, 0);

  // Assume 6 working hours per day
  const workingHoursPerDay = 6;
  const estimatedDays = Math.ceil((totalMinutes / 60) / workingHoursPerDay);

  return {
    estimatedDays: Math.max(1, estimatedDays),
    confidence: subtasks.length >= 3 ? 'high' : 'medium',
    basedOn: `基于 ${subtasks.length} 个子任务预估`
  };
}

/**
 * Predict completion time for a task using AI
 * @param {Object} task - The task to predict
 * @param {Array} allTasks - All tasks for historical analysis
 * @returns {Promise<{ estimatedDays: number, confidence: string, basedOn: string }>}
 */
export async function predictCompletionTime(task, allTasks) {
  // First check if task has subtasks - use subtask estimates as primary
  const subtaskResult = calculateFromSubtasks(task);
  
  // Find similar completed tasks
  const similarTasks = findSimilarTasks(task, allTasks);
  const historicalResult = analyzeHistoricalData(similarTasks);

  // Use historical data if available and has good confidence
  if (historicalResult && historicalResult.confidence === 'high' && similarTasks.length >= 5) {
    return {
      estimatedDays: historicalResult.estimatedDays,
      confidence: historicalResult.confidence,
      basedOn: `基于 ${historicalResult.sampleSize} 个相似任务历史数据`
    };
  }

  // Fall back to subtask-based estimate
  if (subtaskResult) {
    return {
      estimatedDays: subtaskResult.estimatedDays,
      confidence: subtaskResult.confidence,
      basedOn: subtaskResult.basedOn || '基于子任务预估'
    };
  }

  // Use AI to analyze and predict
  const apiToken = getAPIToken();
  if (apiToken && similarTasks.length > 0) {
    try {
      const similarTaskInfo = similarTasks.slice(0, 5).map(t => ({
        title: t.title,
        duration: t.endTime && t.startTime 
          ? `${Math.round((new Date(t.endTime) - new Date(t.startTime)) / (1000 * 60 * 60 * 24))} 天`
          : '未知'
      }));

      const prompt = `分析以下任务的完成时间预测：

任务信息：
- 标题：${task.title}
- 描述：${task.content || '无'}
- 优先级：${task.priority}
- 子任务数：${task.subtasks?.length || 0}

${similarTasks.length > 0 ? `相似历史任务：
${similarTaskInfo.map(t => `- ${t.title}：完成时长 ${t.duration}`).join('\n')}` : '无历史相似任务'}

请预测完成这个任务需要多少天。考虑以下因素：
1. 相似任务的完成时长
2. 子任务数量（如果有）
3. 任务复杂度

请以 JSON 格式返回：
{
  "estimatedDays": 数字（天数）,
  "confidence": "high" | "medium" | "low",
  "reasoning": "简短的理由"
}

只返回 JSON，不要有其他文字。`;

      const content = await callMiniMaxAPI(prompt, apiToken);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          estimatedDays: Math.max(1, Math.round(result.estimatedDays)),
          confidence: ['high', 'medium', 'low'].includes(result.confidence) ? result.confidence : 'low',
          basedOn: result.reasoning || 'AI 智能预测'
        };
      }
    } catch (error) {
      console.error('AI Prediction Error:', error);
    }
  }

  // Ultimate fallback - rough estimate based on priority and complexity
  if (historicalResult) {
    return {
      estimatedDays: Math.max(1, historicalResult.estimatedDays),
      confidence: 'low',
      basedOn: `基于 ${historicalResult.sampleSize} 个相似任务（置信度较低）`
    };
  }

  // No data available - use priority-based default
  const priorityDays = { P0: 2, P1: 5, P2: 10 };
  return {
    estimatedDays: priorityDays[task.priority] || 5,
    confidence: 'low',
    basedOn: '基于优先级估算（无历史数据）'
  };
}

/**
 * Synchronous version that returns immediate estimate based on subtasks
 * Used for quick display without API call
 */
export function getQuickEstimate(task) {
  const subtaskResult = calculateFromSubtasks(task);
  if (subtaskResult) {
    return {
      estimatedDays: subtaskResult.estimatedDays,
      confidence: subtaskResult.confidence,
      basedOn: '基于子任务预估'
    };
  }
  return null;
}
