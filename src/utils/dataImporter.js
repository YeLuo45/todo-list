/**
 * Data Importer Utility
 * Imports tasks from Notion CSV export and Linear JSON format
 */

/**
 * Detect format of imported data
 * @param {string} jsonString - JSON string to parse
 * @returns {string} - Format type: 'notion-csv', 'linear-json', 'unknown'
 */
function detectFormat(jsonString) {
  const trimmed = jsonString.trim();
  
  // Check for Notion CSV (contains "Name,..." or similar header)
  if (trimmed.includes('"Name"') || trimmed.includes(',Name,') || 
      (trimmed.includes('title') && trimmed.includes('status') && trimmed.includes('Tags'))) {
    return 'notion-csv';
  }
  
  // Check for Linear JSON (has identifier, team, project structure)
  try {
    const obj = JSON.parse(trimmed);
    if (obj.data || obj.nodes || (obj.items && Array.isArray(obj.items))) {
      return 'linear-json';
    }
    if (Array.isArray(obj) && obj.length > 0) {
      const first = obj[0];
      if (first.identifier || first.title || first.state) {
        return 'linear-json';
      }
    }
  } catch (e) {
    // Not valid JSON, might be CSV
    if (trimmed.includes(',') && trimmed.includes('\n')) {
      return 'notion-csv';
    }
  }
  
  return 'unknown';
}

/**
 * Parse Notion CSV format
 * Notion CSV typically has headers like: Name, Status, Priority, Due Date, Tags, Description
 * @param {string} csvText - CSV text content
 * @returns {array} - Array of parsed tasks
 */
function parseNotionCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Parse header - handle quoted fields
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };
  
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, ''));
  
  // Find column indices
  const titleIdx = headers.findIndex(h => h.includes('name') || h.includes('标题'));
  const statusIdx = headers.findIndex(h => h.includes('status') || h.includes('状态'));
  const priorityIdx = headers.findIndex(h => h.includes('priority') || h.includes('优先级'));
  const dueDateIdx = headers.findIndex(h => h.includes('due') || h.includes('截止'));
  const tagsIdx = headers.findIndex(h => h.includes('tag') || h.includes('标签'));
  const descIdx = headers.findIndex(h => h.includes('description') || h.includes('描述') || h.includes('content'));
  
  if (titleIdx < 0) {
    throw new Error('Notion CSV 格式错误：未找到标题列');
  }
  
  const tasks = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length <= titleIdx || !values[titleIdx]) continue;
    
    const title = values[titleIdx]?.replace(/"/g, '') || '';
    if (!title) continue;
    
    // Map status
    const statusMap = {
      'todo': 'todo', 'not started': 'todo', '未开始': 'todo',
      'in progress': 'in-progress', 'in-progress': 'in-progress', '进行中': 'in-progress',
      'done': 'done', 'completed': 'done', '已完成': 'done',
    };
    const rawStatus = statusIdx >= 0 ? values[statusIdx]?.toLowerCase() : '';
    const status = statusMap[rawStatus] || 'todo';
    
    // Map priority
    const priorityMap = {
      'high': 'P0', 'urgent': 'P0', '高': 'P0',
      'medium': 'P1', '中': 'P1',
      'low': 'P2', '低': 'P2',
    };
    const rawPriority = priorityIdx >= 0 ? values[priorityIdx]?.toLowerCase() : '';
    const priority = priorityMap[rawPriority] || 'P1';
    
    // Parse due date
    let dueDate = null;
    if (dueDateIdx >= 0 && values[dueDateIdx]) {
      const dateStr = values[dueDateIdx].replace(/"/g, '');
      // Handle various date formats
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        dueDate = parsed.toISOString().split('T')[0];
      }
    }
    
    // Parse tags
    const tags = tagsIdx >= 0 && values[tagsIdx]
      ? values[tagsIdx].replace(/"/g, '').split(/[,;]/).map(t => t.trim()).filter(Boolean)
      : [];
    
    // Description
    const content = descIdx >= 0 ? values[descIdx]?.replace(/"/g, '') || '' : '';
    
    tasks.push({
      id: `imported-notion-${Date.now()}-${i}`,
      title,
      content,
      tags,
      priority,
      status,
      dueDate,
      subtasks: [],
      dependsOn: [],
      isRecurring: false,
      importance: 3,
      urgency: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reminded: false,
    });
  }
  
  return tasks;
}

/**
 * Parse Linear JSON format
 * Linear exports have identifier, title, state, dueDate, project structure
 * @param {string} jsonText - JSON text content
 * @returns {array} - Array of parsed tasks
 */
function parseLinearJSON(jsonText) {
  const data = JSON.parse(jsonText);
  
  // Handle different Linear export formats
  let items = [];
  
  if (Array.isArray(data)) {
    items = data;
  } else if (data.data && Array.isArray(data.data)) {
    items = data.data;
  } else if (data.nodes && Array.isArray(data.nodes)) {
    items = data.nodes;
  } else if (data.items && Array.isArray(data.items)) {
    items = data.items;
  } else if (typeof data === 'object') {
    // Try to find an array property
    const arrayProp = Object.values(data).find(v => Array.isArray(v));
    if (arrayProp) items = arrayProp;
  }
  
  if (!items.length) {
    throw new Error('Linear JSON 格式错误：未找到任务数据');
  }
  
  const tasks = items.map((item, i) => {
    // Linear structure: identifier, title, state, dueDate, project, description
    const title = item.title || item.name || item.summary || '无标题';
    
    // Map state to status
    const stateMap = {
      'backlog': 'todo', 'todo': 'todo', 'unstarted': 'todo',
      'started': 'in-progress', 'in_progress': 'in-progress', 'in-progress': 'in-progress',
      'completed': 'done', 'done': 'done', 'canceled': 'done',
    };
    const rawState = (item.state || item.status || item.stateInfo || '').toLowerCase();
    const state = stateMap[rawState] || 'todo';
    
    // Map priority
    const priorityMap = {
      'urgent': 'P0', 'high': 'P0',
      'medium': 'P1', 'normal': 'P1',
      'low': 'P2', 'none': 'P2',
    };
    const rawPriority = (item.priority || item.priorityLabel || '').toLowerCase();
    const priority = priorityMap[rawPriority] || 'P1';
    
    // Parse due date
    let dueDate = null;
    if (item.dueDate || item.targetDate || item.due) {
      const dateStr = item.dueDate || item.targetDate || item.due;
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        dueDate = parsed.toISOString().split('T')[0];
      }
    }
    
    // Description
    const content = item.description || item.body || item.content || '';
    
    // Tags
    const tags = [];
    if (item.labels && Array.isArray(item.labels)) {
      tags.push(...item.labels.map(l => l.name || l));
    }
    if (item.project) {
      tags.push(typeof item.project === 'string' ? item.project : (item.project.name || ''));
    }
    
    return {
      id: `imported-linear-${Date.now()}-${i}`,
      title,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      tags: tags.filter(Boolean),
      priority,
      status: state,
      dueDate,
      subtasks: [],
      dependsOn: [],
      isRecurring: false,
      importance: 3,
      urgency: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reminded: false,
    };
  });
  
  return tasks;
}

/**
 * Import tasks from JSON string (handles both Notion CSV and Linear JSON)
 * @param {string} jsonString - JSON or CSV string to parse
 * @returns {Promise<object>} - { format: string, tasks: array }
 */
export async function importFromJSON(jsonString) {
  const format = detectFormat(jsonString);
  
  if (format === 'unknown') {
    throw new Error('无法识别数据格式，请确保是 Notion CSV 或 Linear JSON 格式');
  }
  
  let tasks = [];
  
  if (format === 'notion-csv') {
    tasks = parseNotionCSV(jsonString);
  } else if (format === 'linear-json') {
    tasks = parseLinearJSON(jsonString);
  }
  
  if (tasks.length === 0) {
    throw new Error('未解析到任何任务');
  }
  
  return {
    format,
    tasks,
  };
}
