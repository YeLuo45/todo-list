/**
 * AI Subtask Breakdown using MiniMax API
 */

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
const MODEL = 'MiniMax-Text-01';

const AI_TOKEN_KEY = 'hermes_ai_token';
const GITHUB_TOKEN_KEY = 'hermes_github_token';

/**
 * Get API token from storage (prioritize aiToken, fallback to githubToken)
 */
export function getAPIToken() {
  return localStorage.getItem(AI_TOKEN_KEY) || localStorage.getItem(GITHUB_TOKEN_KEY) || null;
}

/**
 * Set AI API token
 */
export function setAPIToken(token) {
  if (token) {
    localStorage.setItem(AI_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AI_TOKEN_KEY);
  }
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
 * Parse JSON from AI response
 */
function parseJSONResponse(content) {
  // Try to extract JSON from markdown code blocks first
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                    content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      // Try to fix common JSON issues
      try {
        const fixed = jsonMatch[1]
          .replace(/,\s*([\]}])/g, '$1')  // Remove trailing commas
          .replace(/'/g, '"')             // Replace single quotes with double quotes
          .replace(/(\w+):/g, '"$1":');   // Quote property names
        return JSON.parse(fixed);
      } catch (e2) {
        console.error('Failed to parse JSON:', e2);
      }
    }
  }
  return null;
}

/**
 * Break a task into subtasks using AI
 * @param {Object} task - The parent task
 * @param {Array} allTasks - All tasks (for dependency context)
 * @returns {Promise<Array>} Array of subtask objects
 */
export async function breakIntoSubtasks(task, allTasks) {
  const apiToken = getAPIToken();
  if (!apiToken) {
    throw new Error('NO_TOKEN');
  }

  // Build context about existing tasks for dependency detection
  const taskContext = allTasks
    .filter(t => t.id !== task.id && t.status !== 'done')
    .slice(0, 20)
    .map(t => `- ${t.title} (${t.status})`)
    .join('\n');

  const prompt = `你是一个任务拆解专家。请将以下任务拆解成 3-8 个具体的子任务。

任务标题：${task.title}
${task.content ? `任务描述：${task.content}` : ''}
${task.dueDate ? `截止日期：${task.dueDate}` : ''}

请以 JSON 数组格式返回子任务，每个子任务包含以下字段：
- title: 子任务标题（简洁明了）
- estimatedMinutes: 预估完成时间（分钟）
- priority: 优先级 ("high" | "medium" | "low")
${taskContext ? `\n现有任务（可作为依赖参考）：\n${taskContext}` : ''}

返回格式要求：
1. 只返回 JSON 数组，不要有其他文字
2. 子任务应该逻辑清晰、有序
3. 如果有先后依赖关系，先完成的放前面
4. estimatedMinutes 应该是合理的估算值

请直接返回 JSON 数组，不要使用 markdown 代码块包裹。`;

  try {
    const content = await callMiniMaxAPI(prompt, apiToken);
    const result = parseJSONResponse(content);

    if (!result || !Array.isArray(result)) {
      throw new Error('Invalid response format from AI');
    }

    // Validate and normalize subtasks
    return result.map((st, index) => ({
      id: `ai-subtask-${Date.now()}-${index}`,
      title: st.title || `子任务 ${index + 1}`,
      estimatedMinutes: Math.max(5, Math.min(480, parseInt(st.estimatedMinutes) || 30)),
      priority: ['high', 'medium', 'low'].includes(st.priority) ? st.priority : 'medium',
      dependencyIds: [],
      done: false
    }));
  } catch (error) {
    if (error.message === 'NO_TOKEN') {
      throw error;
    }
    console.error('AI Subtask Error:', error);
    throw new Error(`AI 拆解失败: ${error.message}`);
  }
}
