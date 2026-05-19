// Script templates for common task types
export const scriptTemplates = {
  reminder: {
    name: '⏰ 提醒任务',
    description: '计算距离到期时间',
    script: `// Reminder script
const dueDate = new Date(input.dueDate);
const now = new Date();
const diff = dueDate - now;
return {
  daysUntil: Math.ceil(diff / (1000 * 60 * 60 * 24)),
  hoursUntil: Math.ceil(diff / (1000 * 60 * 60)),
  isOverdue: diff < 0
};`
  },
  
  counter: {
    name: '🔢 计数器',
    description: '递增/递减数字',
    script: `// Counter script
let count = input.start || 0;
const step = input.step || 1;
count += step;
return { count, step, timestamp: new Date().toISOString() };`
  },
  
  apiCall: {
    name: '🌐 API调用',
    description: '获取外部数据',
    script: `// API call script
const url = input.url;
try {
  const response = await fetch(url);
  const data = await response.json();
  return { success: true, data, status: response.status };
} catch (err) {
  return { success: false, error: err.message };
}`
  },
  
  dataProcess: {
    name: '📊 数据处理',
    description: '处理和分析数据',
    script: `// Data processing script
const items = input.items || [];
const operation = input.operation || 'count';
switch(operation) {
  case 'count': return { result: items.length };
  case 'sum': return { result: items.reduce((a,b) => a + b, 0) };
  case 'avg': return { result: items.reduce((a,b) => a + b, 0) / items.length };
  case 'filter': return { result: items.filter(x => x > (input.threshold || 0)) };
  default: return { result: items.length };
}`
  }
};

export function getTemplateNames() {
  return Object.keys(scriptTemplates).map(key => ({
    key,
    name: scriptTemplates[key].name,
    description: scriptTemplates[key].description
  }));
}

export function getTemplate(key) {
  return scriptTemplates[key] || null;
}
