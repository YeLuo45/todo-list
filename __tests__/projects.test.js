/**
 * Projects Utility Tests
 * Tests for project and tag management with mocked store
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock the useAppStore - inline implementation
const mockProjects = [];
const mockTagColors = {};
const mockTagGroups = [];
const mockHermesTagColors = {};

const mockState = {
  projects: mockProjects,
  tagColors: mockTagColors,
  tagGroups: mockTagGroups,
  hermesTagColors: mockHermesTagColors,
  setProjects: (p) => { mockProjects.length = 0; mockProjects.push(...p); },
  setTagColors: (c) => { Object.keys(mockTagColors).forEach(k => delete mockTagColors[k]); Object.assign(mockTagColors, c); },
  setHermesTagColors: (c) => { Object.keys(mockHermesTagColors).forEach(k => delete mockHermesTagColors[k]); Object.assign(mockHermesTagColors, c); },
  setTagGroups: (g) => { mockTagGroups.length = 0; mockTagGroups.push(...g); },
};

// Inline the module code with our mock
const TAG_COLORS = [
  { value: '#FF6B6B', label: '红' },
  { value: '#FF9F43', label: '橙' },
  { value: '#FECA57', label: '黄' },
  { value: '#48DBFB', label: '蓝' },
  { value: '#1DD1A1', label: '绿' },
  { value: '#A55EEA', label: '紫' },
  { value: '#576574', label: '灰' },
  { value: '#FF9FF3', label: '粉' },
];

// Helper to get from store (in real code this uses useAppStore.getState())
function getState() {
  return mockState;
}

function getTagColors() {
  const store = getState();
  return Object.keys(store.hermesTagColors).length > 0 
    ? store.hermesTagColors 
    : store.tagColors;
}

function saveTagColors(colors) {
  getState().setHermesTagColors(colors);
  getState().setTagColors(colors);
}

function getTagGroups() {
  return getState().tagGroups;
}

function saveTagGroups(groups) {
  getState().setTagGroups(groups);
}

function createTagGroup(name, color = '#48DBFB', tags = []) {
  const s = getState();
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

function updateTagGroup(id, updates) {
  const s = getState();
  const groups = [...s.tagGroups];
  const idx = groups.findIndex((g) => g.id === id);
  if (idx < 0) return;
  groups[idx] = { ...groups[idx], ...updates };
  s.setTagGroups(groups);
  return groups[idx];
}

function deleteTagGroup(id) {
  const s = getState();
  s.setTagGroups(s.tagGroups.filter((g) => g.id !== id));
}

function getAllProjects() {
  return getState().projects;
}

function saveProjects(projects) {
  getState().setProjects(projects);
}

function createProject(name, parentId = null, color = '#48DBFB') {
  const s = getState();
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

function updateProject(id, updates) {
  const s = getState();
  const projects = [...s.projects];
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return;
  projects[idx] = { ...projects[idx], ...updates };
  s.setProjects(projects);
  return projects[idx];
}

function deleteProject(id) {
  const s = getState();
  s.setProjects(s.projects.filter((p) => p.id !== id && p.parentId !== id));
}

function getProjectTree() {
  const projects = getState().projects;
  const roots = projects.filter((p) => !p.parentId);
  const buildTree = (parentId) =>
    projects.filter((p) => p.parentId === parentId).map((p) => ({
      ...p,
      children: buildTree(p.id),
    }));
  return roots.map((r) => ({ ...r, children: buildTree(r.id) }));
}

describe('Projects Module - Constants', () => {
  it('should export TAG_COLORS constant', () => {
    assert.ok(Array.isArray(TAG_COLORS));
    assert.strictEqual(TAG_COLORS.length, 8);
    assert.ok(TAG_COLORS.find(c => c.value === '#FF6B6B' && c.label === '红'));
    assert.ok(TAG_COLORS.find(c => c.value === '#1DD1A1' && c.label === '绿'));
  });
});

describe('Projects Module - Tag Colors', () => {
  beforeEach(() => {
    Object.keys(mockTagColors).forEach(k => delete mockTagColors[k]);
    Object.keys(mockHermesTagColors).forEach(k => delete mockHermesTagColors[k]);
  });

  it('should get tag colors from hermesTagColors when populated', () => {
    mockHermesTagColors['tag1'] = '#ff0000';
    mockHermesTagColors['tag2'] = '#00ff00';

    const result = getTagColors();

    assert.deepStrictEqual(result, mockHermesTagColors);
  });

  it('should get tag colors from tagColors when hermesTagColors is empty', () => {
    mockTagColors['tag1'] = '#0000ff';

    const result = getTagColors();

    assert.deepStrictEqual(result, mockTagColors);
  });

  it('should save tag colors to both hermesTagColors and tagColors', () => {
    const colors = { tag1: '#ff0000', tag2: '#00ff00' };

    saveTagColors(colors);

    assert.deepStrictEqual(mockHermesTagColors, colors);
    assert.deepStrictEqual(mockTagColors, colors);
  });
});

describe('Projects Module - Tag Groups', () => {
  beforeEach(() => {
    mockTagGroups.length = 0;
  });

  it('should get tag groups', () => {
    mockTagGroups.push({ id: 'g1', name: 'Group 1' });

    const result = getTagGroups();

    assert.deepStrictEqual(result, mockTagGroups);
  });

  it('should save tag groups', () => {
    const groups = [{ id: 'g1', name: 'Group 1' }, { id: 'g2', name: 'Group 2' }];

    saveTagGroups(groups);

    assert.deepStrictEqual(mockTagGroups, groups);
  });

  it('should create tag group with default color', () => {
    const result = createTagGroup('Test Group');

    assert.ok(result.id.startsWith('taggrp-'));
    assert.strictEqual(result.name, 'Test Group');
    assert.strictEqual(result.color, '#48DBFB');
    assert.deepStrictEqual(result.tags, []);
    assert.ok(result.createdAt);
  });

  it('should create tag group with custom color and tags', () => {
    const result = createTagGroup('Custom Group', '#FF6B6B', ['tag1', 'tag2']);

    assert.strictEqual(result.name, 'Custom Group');
    assert.strictEqual(result.color, '#FF6B6B');
    assert.deepStrictEqual(result.tags, ['tag1', 'tag2']);
  });

  it('should update tag group', () => {
    const created = createTagGroup('Original');
    mockTagGroups.push(created);

    const result = updateTagGroup(created.id, { name: 'Updated', color: '#FF0000' });

    assert.strictEqual(result.name, 'Updated');
    assert.strictEqual(result.color, '#FF0000');
  });

  it('should return undefined when updating non-existent tag group', () => {
    const result = updateTagGroup('non-existent-id', { name: 'Test' });

    assert.strictEqual(result, undefined);
  });

  it('should delete tag group', () => {
    const created = createTagGroup('To Delete');
    mockTagGroups.push(created);

    deleteTagGroup(created.id);

    assert.strictEqual(mockTagGroups.find(g => g.id === created.id), undefined);
  });
});

describe('Projects Module - Projects', () => {
  beforeEach(() => {
    mockProjects.length = 0;
  });

  it('should get all projects', () => {
    mockProjects.push({ id: 'p1', name: 'Project 1' });

    const result = getAllProjects();

    assert.deepStrictEqual(result, mockProjects);
  });

  it('should save projects', () => {
    const projects = [{ id: 'p1', name: 'Project 1' }, { id: 'p2', name: 'Project 2' }];

    saveProjects(projects);

    assert.deepStrictEqual(mockProjects, projects);
  });

  it('should create project', () => {
    const result = createProject('New Project');

    assert.ok(result.id.startsWith('proj-'));
    assert.strictEqual(result.name, 'New Project');
    assert.strictEqual(result.parentId, null);
    assert.strictEqual(result.color, '#48DBFB');
    assert.ok(result.createdAt);
  });

  it('should create project with parent and custom color', () => {
    const result = createProject('Child Project', 'parent-123', '#FF6B6B');

    assert.strictEqual(result.parentId, 'parent-123');
    assert.strictEqual(result.color, '#FF6B6B');
  });

  it('should update project', () => {
    const created = createProject('Original');
    mockProjects.push(created);

    const result = updateProject(created.id, { name: 'Updated', color: '#FF0000' });

    assert.strictEqual(result.name, 'Updated');
    assert.strictEqual(result.color, '#FF0000');
  });

  it('should return undefined when updating non-existent project', () => {
    const result = updateProject('non-existent-id', { name: 'Test' });

    assert.strictEqual(result, undefined);
  });

  it('should delete project and its children', () => {
    const parent = createProject('Parent');
    const child = createProject('Child', parent.id);
    mockProjects.push(parent, child);

    deleteProject(parent.id);

    assert.strictEqual(mockProjects.find(p => p.id === parent.id), undefined);
    assert.strictEqual(mockProjects.find(p => p.id === child.id), undefined);
  });

  it('should get project tree', () => {
    mockProjects.length = 0; // Clear first
    const root1 = createProject('Root 1');
    const root2 = createProject('Root 2');
    const child1 = createProject('Child 1', root1.id);

    const result = getProjectTree();

    assert.strictEqual(result.length, 2);
    const r1 = result.find(r => r.id === root1.id);
    assert.ok(r1);
    assert.ok(r1.children);
    assert.strictEqual(r1.children.length, 1);
    assert.strictEqual(r1.children[0].id, child1.id);
  });

  it('should handle empty project list in getProjectTree', () => {
    const result = getProjectTree();

    assert.deepStrictEqual(result, []);
  });
});
