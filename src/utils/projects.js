import { useAppStore } from '../store/useAppStore';

const PROJECTS_KEY = 'hermes-projects-v1';
const TAG_GROUPS_KEY = 'hermes-tag-groups-v1';

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

// 内部读取辅助
function getFromStore() {
  return useAppStore.getState();
}

export function getTagColors() {
  const store = useAppStore.getState();
  // 优先用 hermesTagColors（兼容新旧 key）
  return Object.keys(store.hermesTagColors).length > 0 
    ? store.hermesTagColors 
    : store.tagColors;
}

export function saveTagColors(colors) {
  useAppStore.getState().setHermesTagColors(colors);
  useAppStore.getState().setTagColors(colors);
}

export function getTagGroups() {
  return useAppStore.getState().tagGroups;
}

export function saveTagGroups(groups) {
  useAppStore.getState().setTagGroups(groups);
}

export function createTagGroup(name, color = '#48DBFB', tags = []) {
  const s = useAppStore.getState();
  const g = {
    id: `taggrp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name,
    color,
    tags,
    createdAt: new Date().toISOString(),
  };
  s.setTagGroups([...s.tagGroups, g]);
  return g;
}

export function updateTagGroup(id, updates) {
  const s = useAppStore.getState();
  const groups = [...s.tagGroups];
  const idx = groups.findIndex((g) => g.id === id);
  if (idx < 0) return;
  groups[idx] = { ...groups[idx], ...updates };
  s.setTagGroups(groups);
  return groups[idx];
}

export function deleteTagGroup(id) {
  const s = useAppStore.getState();
  s.setTagGroups(s.tagGroups.filter((g) => g.id !== id));
}

export function getAllProjects() {
  return useAppStore.getState().projects;
}

export function saveProjects(projects) {
  useAppStore.getState().setProjects(projects);
}

export function createProject(name, parentId = null, color = '#48DBFB') {
  const s = useAppStore.getState();
  const project = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    parentId,
    color,
    createdAt: new Date().toISOString(),
  };
  s.setProjects([...s.projects, project]);
  return project;
}

export function updateProject(id, updates) {
  const s = useAppStore.getState();
  const projects = [...s.projects];
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return;
  projects[idx] = { ...projects[idx], ...updates };
  s.setProjects(projects);
  return projects[idx];
}

export function deleteProject(id) {
  const s = useAppStore.getState();
  s.setProjects(s.projects.filter((p) => p.id !== id && p.parentId !== id));
}

export function getProjectTree() {
  const projects = useAppStore.getState().projects;
  const roots = projects.filter((p) => !p.parentId);
  const buildTree = (parentId) =>
    projects.filter((p) => p.parentId === parentId).map((p) => ({
      ...p,
      children: buildTree(p.id),
    }));
  return roots.map((r) => ({ ...r, children: buildTree(r.id) }));
}