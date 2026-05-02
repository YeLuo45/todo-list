const PROJECTS_KEY = 'hermes-projects-v1';

export const TAG_COLORS = [
  { value: '#FF6B6B', label: '红' },
  { value: '#FF9F43', label: '橙' },
  { value: '#FECA57', label: '黄' },
  { value: '#48DBFB', label: '蓝' },
  { value: '#1DD1A1', label: '绿' },
  { value: '#A55EEA', label: '紫' },
  { value: '#576574', label: '灰' },
  { value: '#FF9FF3', label: '粉' },
];

export function getTagColors() {
  try {
    return JSON.parse(localStorage.getItem('hermes-tag-colors-v1') || '{}');
  } catch { return {}; }
}

export function saveTagColors(colors) {
  localStorage.setItem('hermes-tag-colors-v1', JSON.stringify(colors));
}

export function getAllProjects() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
  } catch { return []; }
}

export function saveProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function createProject(name, parentId = null, color = '#48DBFB') {
  const projects = getAllProjects();
  const project = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    parentId,
    color,
    createdAt: new Date().toISOString(),
  };
  projects.push(project);
  saveProjects(projects);
  return project;
}

export function updateProject(id, updates) {
  const projects = getAllProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return;
  projects[idx] = { ...projects[idx], ...updates };
  saveProjects(projects);
  return projects[idx];
}

export function deleteProject(id) {
  const projects = getAllProjects().filter((p) => p.id !== id && p.parentId !== id);
  saveProjects(projects);
}

export function getProjectTree() {
  const projects = getAllProjects();
  const roots = projects.filter((p) => !p.parentId);
  const buildTree = (parentId) =>
    projects.filter((p) => p.parentId === parentId).map((p) => ({
      ...p,
      children: buildTree(p.id),
    }));
  return roots.map((r) => ({ ...r, children: buildTree(r.id) }));
}
