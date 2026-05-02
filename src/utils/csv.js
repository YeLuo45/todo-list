// CSV 解析和生成工具

// 解析 CSV 文本 → tasks 数组
export function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const tasks = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 1 || !values[0].trim()) continue;

    const task = {
      title: values[headers.indexOf('title')]?.trim() || '',
      content: values[headers.indexOf('content')]?.trim() || '',
      tags: (values[headers.indexOf('tags')] || '').split(';').map(t => t.trim()).filter(Boolean),
      priority: normalizePriority(values[headers.indexOf('priority')]?.trim() || 'P1'),
      status: normalizeStatus(values[headers.indexOf('status')]?.trim() || 'todo'),
      dueDate: normalizeDate(values[headers.indexOf('duedate')]?.trim() || ''),
      recurrence: null,
      recurrenceEndDate: null,
      generatedDate: new Date().toISOString(),
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reminded: false,
    };

    if (task.title) tasks.push(task);
  }

  return tasks;
}

// 解析一行 CSV（处理引号包裹的字段）
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function normalizePriority(val) {
  const map = { high: 'P0', medium: 'P1', low: 'P2', p0: 'P0', p1: 'P1', p2: 'P2' };
  return map[val?.toLowerCase()] || 'P1';
}

function normalizeStatus(val) {
  const map = { todo: 'todo', 'in-progress': 'in-progress', done: 'done', 'in progress': 'in-progress', 'inprogress': 'in-progress' };
  return map[val?.toLowerCase()] || 'todo';
}

function normalizeDate(val) {
  if (!val) return null;
  // 接受 YYYY-MM-DD 或 YYYY/MM/DD
  const normalized = val.replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return null;
}

// 生成 CSV 文本
export function generateCSV(tasks) {
  const headers = ['title', 'content', 'tags', 'priority', 'status', 'dueDate'];
  const headerLine = headers.join(',');
  const lines = tasks.map(task => {
    const row = [
      escapeCSV(task.title),
      escapeCSV(task.content),
      escapeCSV((task.tags || []).join(';')),
      task.priority || 'P1',
      task.status || 'todo',
      task.dueDate || '',
    ];
    return row.join(',');
  });
  return [headerLine, ...lines].join('\n');
}

function escapeCSV(val) {
  if (!val) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// 生成 JSON 导出
export function generateJSON(tasks) {
  return JSON.stringify(tasks, null, 2);
}

// 下载文件
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
