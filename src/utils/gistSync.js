const GIST_CONFIG_KEY = 'gist-sync-config';

export function getGistConfig() {
  try {
    return JSON.parse(localStorage.getItem(GIST_CONFIG_KEY) || 'null');
  } catch { return null; }
}

export function saveGistConfig(config) {
  localStorage.setItem(GIST_CONFIG_KEY, JSON.stringify(config));
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
      description: 'Hermes TodoList Backup',
      public: false,
      files: { 'tasks.json': { content: JSON.stringify(tasks, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`Gist create failed: ${res.status}`);
  return res.json();
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
