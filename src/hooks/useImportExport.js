import { useCallback } from 'react';
import { parseCSV, generateCSV, generateJSON, downloadFile, downloadBlob, generateEPUB, generateICal } from '../utils/csv';

export function useImportExport(tasks) {
  // 导出 JSON
  const exportJSON = useCallback(() => {
    const json = generateJSON(tasks);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(json, `hermes-todos-${date}.json`, 'application/json');
  }, [tasks]);

  // 导出 CSV
  const exportCSV = useCallback(() => {
    const csv = generateCSV(tasks);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(csv, `hermes-todos-${date}.csv`, 'text/csv');
  }, [tasks]);

  // 导出 iCal
  const exportICal = useCallback(() => {
    const ical = generateICal(tasks);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(ical, `hermes-todos-${date}.ics`, 'text/calendar');
  }, [tasks]);

  // 导出 EPUB
  const exportEPUB = useCallback(async () => {
    const blob = await generateEPUB(tasks);
    const date = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `hermes-todos-${date}.epub`);
  }, [tasks]);

  // 检测是否为 Todoist CSV（Todoist 的 header 行包含特定字段）
  const isTodoistCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return false;
    const header = lines[0].toLowerCase();
    return header.includes('content') && (header.includes('priority') || header.includes('due_date'));
  };

  // 解析 Todoist CSV
  const parseTodoistCSV = (text) => {
    const lines = text.trim().split('\n');
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const tasks = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.replace(/^"|"$/g, '').trim());
      const row = {};
      header.forEach((h, idx) => { row[h] = values[idx] || ''; });
      if (!row.content) continue;
      const priorityMap = { 'p1': 'P0', 'p2': 'P1', 'p3': 'P2', 'p4': 'P2' };
      const task = {
        id: `imported-${Date.now()}-${i}`,
        title: row.content || '',
        content: row.description || '',
        tags: row.labels ? row.labels.split(';').map((t) => t.trim()).filter(Boolean) : [],
        priority: priorityMap[row.priority] || 'P1',
        status: 'todo',
        dueDate: row.due_date_utc ? row.due_date_utc.split(' ')[0] : (row.due_date || null),
        subtasks: [],
        dependsOn: [],
        isRecurring: false,
        importance: 3,
        urgency: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminded: false,
      };
      tasks.push(task);
    }
    return tasks;
  };

  // 解析通用 CSV
  const parseGenericCSV = (text) => {
    const lines = text.trim().split('\n');
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const findCol = (candidates) => {
      for (const c of candidates) {
        const idx = header.findIndex((h) => h.includes(c));
        if (idx >= 0) return idx;
      }
      return -1;
    };
    const titleIdx = findCol(['title', '任务', '名称', 'name']);
    const contentIdx = findCol(['content', 'description', '详情', '描述', 'desc']);
    const priorityIdx = findCol(['priority', '优先级', '重要程度']);
    const statusIdx = findCol(['status', '状态']);
    const dueDateIdx = findCol(['duedate', 'due', '截止', '截止日期', 'end']);
    const tagsIdx = findCol(['tags', '标签', 'labels', 'tag']);

    if (titleIdx < 0) throw new Error('CSV 格式错误：未找到 title/任务 列');

    const tasks = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.replace(/^"|"$/g, '').trim());
      const title = values[titleIdx] || '';
      if (!title) continue;
      const priorityMap = { 'p0': 'P0', 'p1': 'P1', 'p2': 'P2', '高': 'P0', '中': 'P1', '低': 'P2' };
      const statusMap = { 'todo': 'todo', '待办': 'todo', 'in-progress': 'in-progress', '进行中': 'in-progress', 'done': 'done', '已完成': 'done' };
      const task = {
        id: `imported-${Date.now()}-${i}`,
        title,
        content: contentIdx >= 0 ? values[contentIdx] : '',
        tags: tagsIdx >= 0 ? (values[tagsIdx] ? values[tagsIdx].split(/[;，,]/).map((t) => t.trim()).filter(Boolean) : []) : [],
        priority: priorityIdx >= 0 ? (priorityMap[values[priorityIdx].toLowerCase()] || 'P1') : 'P1',
        status: statusIdx >= 0 ? (statusMap[values[statusIdx]] || 'todo') : 'todo',
        dueDate: dueDateIdx >= 0 ? values[dueDateIdx] : null,
        subtasks: [],
        dependsOn: [],
        isRecurring: false,
        importance: 3,
        urgency: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminded: false,
      };
      tasks.push(task);
    }
    return tasks;
  };

  // Notion API 导入
  const importFromNotion = useCallback(async (databaseId, token) => {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: 100 }),
    });
    if (!res.ok) throw new Error(`Notion API 错误: ${res.status}`);
    const data = await res.json();
    const tasks = (data.results || []).map((page, i) => {
      const props = page.properties || {};
      const titleProp = Object.values(props).find((p) => p.type === 'title') || {};
      const title = titleProp.title?.map((t) => t.plain_text).join('') || '无标题';
      const descProp = props.Description || props.content || props.Content || {};
      const content = descProp.rich_text?.map((t) => t.plain_text).join('') || '';
      const statusProp = props.Status || props.状态 || {};
      const statusMap = { 'todo': 'todo', 'in-progress': 'in-progress', 'done': 'done', '未开始': 'todo', '进行中': 'in-progress', '已完成': 'done' };
      const status = statusProp.select?.name ? (statusMap[statusProp.select.name] || 'todo') : 'todo';
      const priorityProp = props.Priority || props.优先级 || {};
      const priorityMap = { 'High': 'P0', 'Medium': 'P1', 'Low': 'P2', '高': 'P0', '中': 'P1', '低': 'P2' };
      const priority = priorityProp.select?.name ? (priorityMap[priorityProp.select.name] || 'P1') : 'P1';
      const dueProp = props['Due Date'] || props['截止日期'] || props.due || {};
      const dueDate = dueProp.date?.start || null;
      const tagsProp = props.Tags || props.标签 || {};
      const tags = tagsProp.multi_select?.map((t) => t.name) || [];
      return {
        id: `notion-${Date.now()}-${i}`,
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
      };
    });
    return tasks;
  }, []);

  // 解析文件
  const parseFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const ext = file.name.split('.').pop().toLowerCase();
          if (ext === 'csv') {
            if (isTodoistCSV(text)) {
              resolve({ type: 'todoist-csv', tasks: parseTodoistCSV(text) });
            } else {
              resolve({ type: 'csv', tasks: parseGenericCSV(text) });
            }
          } else if (ext === 'json') {
            const data = JSON.parse(text);
            const arr = Array.isArray(data) ? data : (data.tasks || []);
            resolve({ type: 'json', tasks: arr });
          } else {
            reject(new Error('不支持的文件格式，请使用 CSV 或 JSON'));
          }
        } catch (err) {
          reject(new Error(`解析失败: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
  }, []);

  // 合并导入
  const mergeImport = useCallback((targetTasks, importedTasks) => {
    return [...targetTasks, ...importedTasks];
  }, []);

  // 覆盖导入
  const replaceImport = useCallback((importedTasks) => {
    return importedTasks;
  }, []);

  return {
    exportJSON,
    exportCSV,
    exportICal,
    exportEPUB,
    parseFile,
    mergeImport,
    replaceImport,
    importFromNotion,
  };
}
