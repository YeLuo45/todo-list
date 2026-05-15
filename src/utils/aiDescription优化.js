/**
 * AI Description Optimization using MiniMax API
 */

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
const MODEL = 'MiniMax-Text-01';
const AI_TOKEN_KEY = 'hermes_ai_token';

/**
 * Get API token from storage
 */
function getAPIToken() {
  return localStorage.getItem(AI_TOKEN_KEY) || null;
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
 * Improve task description using AI
 * @param {Object} task - The task with title and content
 * @returns {Promise<{ original: string, improved: string, diff: string }>}
 */
export async function improveDescription(task) {
  const apiToken = getAPIToken();
  if (!apiToken) {
    throw new Error('NO_TOKEN');
  }

  const originalDescription = task.content || task.title;
  if (!originalDescription.trim()) {
    throw new Error('任务描述为空，无法优化');
  }

  const prompt = `你是一个任务描述优化专家。请优化以下任务描述，使其更加清晰、具体、详细。

原始任务标题：${task.title}
原始描述：${task.content || '(无描述)'}

优化要求：
1. 补充缺失的细节和背景信息
2. 使描述更加清晰、具体、可执行
3. 保持原意但提升可读性和完整性
4. 使用专业但易懂的语言
5. 如果原描述有模糊不清的地方，明确化

请直接返回优化后的描述，不要有前缀说明，不要使用引号包裹。`;

  try {
    const improved = await callMiniMaxAPI(prompt, apiToken);
    
    // Generate simple diff (highlight additions)
    const diff = generateSimpleDiff(originalDescription, improved.trim());

    return {
      original: originalDescription,
      improved: improved.trim(),
      diff
    };
  } catch (error) {
    if (error.message === 'NO_TOKEN') {
      throw error;
    }
    console.error('AI Description Optimization Error:', error);
    throw new Error(`AI 优化失败: ${error.message}`);
  }
}

/**
 * Generate a simple visual diff between original and improved
 */
function generateSimpleDiff(original, improved) {
  if (original === improved) {
    return { type: 'unchanged', lines: [{ original, improved }] };
  }

  const origLines = original.split('\n');
  const improvedLines = improved.split('\n');
  const diffLines = [];

  const maxLen = Math.max(origLines.length, improvedLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const origLine = origLines[i] || '';
    const improvedLine = improvedLines[i] || '';
    
    if (origLine === improvedLine) {
      diffLines.push({ type: 'unchanged', text: origLine });
    } else if (!origLine && improvedLine) {
      diffLines.push({ type: 'add', text: improvedLine });
    } else if (origLine && !improvedLine) {
      diffLines.push({ type: 'remove', text: origLine });
    } else {
      diffLines.push({ type: 'replace', original: origLine, improved: improvedLine });
    }
  }

  return { type: 'modified', lines: diffLines };
}

/**
 * Format diff for display
 */
export function formatDiff(diff) {
  if (diff.type === 'unchanged') {
    return diff.lines[0].original;
  }

  return diff.lines.map(line => {
    switch (line.type) {
      case 'add':
        return `+ ${line.text}`;
      case 'remove':
        return `- ${line.text}`;
      case 'replace':
        return `- ${line.original}\n+ ${line.improved}`;
      default:
        return line.text;
    }
  }).join('\n');
}
