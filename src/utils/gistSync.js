const GIST_CONFIG_KEY = 'gist-sync-config';
const BACKUP_HISTORY_KEY = 'gist-backup-history';
const LAST_BACKUP_KEY = 'gist-last-backup';

export function getGistConfig() {
  try {
    return JSON.parse(localStorage.getItem(GIST_CONFIG_KEY) || 'null');
  } catch { return null; }
}

export function saveGistConfig(config) {
  localStorage.setItem(GIST_CONFIG_KEY, JSON.stringify(config));
}

export function getBackupHistory() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || '[]');
  } catch { return []; }
}

export function saveBackupHistory(history) {
  // 只保留最近 7 份
  const trimmed = history.slice(0, 7);
  localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(trimmed));
}

export function getLastBackupTime() {
  return localStorage.getItem(LAST_BACKUP_KEY) || null;
}

export function setLastBackupTime(time) {
  localStorage.setItem(LAST_BACKUP_KEY, time);
}

export async function fetchGist(gistId, pat) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`Gist fetch failed: ${res.status}`);
  const data = await res.json();
  const file = data.files['tasks.json'];
  if (!file) throw new Error('tasks.json not found in Gist');
  return JSON.parse(file.content);
}

export async function pushGist(gistId, pat, tasks) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: { 'tasks.json': { content: JSON.stringify(tasks, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`Gist push failed: ${res.status}`);
  return res.json();
}

export async function createGist(pat, tasks) {
  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Hermes TodoList',
      public: false,
      files: { 'tasks.json': { content: JSON.stringify(tasks, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`Gist create failed: ${res.status}`);
  return res.json();
}

// 创建备份 Gist（独立gist，每份备份独立）
export async function createBackupGist(pat, tasks) {
  const now = new Date();
  const label = now.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: `Hermes TodoList Backup ${label}`,
      public: false,
      files: { 'tasks.json': { content: JSON.stringify(tasks, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`Backup Gist create failed: ${res.status}`);
  const data = await res.json();
  return {
    gistId: data.id,
    description: data.description,
    timestamp: now.toISOString(),
    taskCount: tasks.length,
  };
}

// 获取备份历史（通过查询用户的 gists，过滤 backup 开头的）
export async function fetchBackupList(pat, limit = 7) {
  const res = await fetch(`https://api.github.com/gists?per_page=100`, {
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`Gist list fetch failed: ${res.status}`);
  const data = await res.json();
  const backups = data
    .filter((g) => g.description && g.description.startsWith('Hermes TodoList Backup'))
    .slice(0, limit)
    .map((g) => ({
      gistId: g.id,
      description: g.description,
      timestamp: new Date(g.updated_at).toISOString(),
      taskCount: null, // 预览时再获取
    }));
  return backups;
}

// 获取某个备份的内容
export async function fetchBackupContent(gistId, pat) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`Backup fetch failed: ${res.status}`);
  const data = await res.json();
  const file = data.files['tasks.json'];
  if (!file) throw new Error('tasks.json not found in backup Gist');
  return JSON.parse(file.content);
}

export function mergeTasks(local, remote) {
  const merged = new Map();
  local.forEach((t) => merged.set(t.id, t));
  remote.forEach((t) => {
    const existing = merged.get(t.id);
    if (!existing || new Date(t.updatedAt) > new Date(existing.updatedAt)) {
      merged.set(t.id, t);
    }
  });
  return Array.from(merged.values());
}
