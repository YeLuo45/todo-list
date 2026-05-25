/**
 * KanbanSettings Utility Tests
 * Tests for kanban lane/column settings with mocked store
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock state
const mockLaneColors = {};
const mockColumnOrder = ['todo', 'in-progress', 'done'];

const mockState = {
  laneColors: mockLaneColors,
  columnOrder: mockColumnOrder,
  setLaneColors: (c) => { Object.keys(mockLaneColors).forEach(k => delete mockLaneColors[k]); Object.assign(mockLaneColors, c); },
  setLaneColor: (k, v) => { mockLaneColors[k] = v; },
  setColumnOrder: (o) => { mockColumnOrder.length = 0; mockColumnOrder.push(...o); },
};

function getState() {
  return mockState;
}

// Constants (from source)
const DEFAULT_COLUMNS = [
  { id: 'todo', label: '待办', color: '#06b6d4' },
  { id: 'in-progress', label: '进行中', color: '#f59e0b' },
  { id: 'done', label: '已完成', color: '#22c55e' },
];

const LANE_COLOR_PRESETS = [
  { value: '#ef4444', label: '红' },
  { value: '#f59e0b', label: '橙' },
  { value: '#eab308', label: '黄' },
  { value: '#22c55e', label: '绿' },
  { value: '#3b82f6', label: '蓝' },
  { value: '#a855f7', label: '紫' },
  { value: '#6b7280', label: '灰' },
];

// Functions (inlined from source)
function getLaneColors() {
  return getState().laneColors;
}

function saveLaneColors(colors) {
  getState().setLaneColors(colors);
}

function getColumnOrder() {
  return getState().columnOrder;
}

function getOrderedColumns() {
  const order = getState().columnOrder;
  return order.map(id => DEFAULT_COLUMNS.find(c => c.id === id)).filter(Boolean);
}

function saveColumnOrder(order) {
  getState().setColumnOrder(order);
}

function getLaneColor(laneKey) {
  const colors = getState().laneColors;
  return colors[laneKey] || null;
}

function setLaneColor(laneKey, color) {
  getState().setLaneColor(laneKey, color);
}

function autoAssignProjectColor(projectId) {
  const store = getState();
  const colors = store.laneColors;

  if (colors[projectId]) {
    return colors[projectId];
  }

  const usedSet = new Set(Object.values(colors));
  for (const preset of LANE_COLOR_PRESETS) {
    if (!usedSet.has(preset.value)) {
      store.setLaneColor(projectId, preset.value);
      return preset.value;
    }
  }

  store.setLaneColor(projectId, LANE_COLOR_PRESETS[0].value);
  return LANE_COLOR_PRESETS[0].value;
}

describe('KanbanSettings Module - Constants', () => {
  it('should export DEFAULT_COLUMNS', () => {
    assert.ok(Array.isArray(DEFAULT_COLUMNS));
    assert.strictEqual(DEFAULT_COLUMNS.length, 3);
    assert.deepStrictEqual(DEFAULT_COLUMNS[0], { id: 'todo', label: '待办', color: '#06b6d4' });
    assert.deepStrictEqual(DEFAULT_COLUMNS[1], { id: 'in-progress', label: '进行中', color: '#f59e0b' });
    assert.deepStrictEqual(DEFAULT_COLUMNS[2], { id: 'done', label: '已完成', color: '#22c55e' });
  });

  it('should export LANE_COLOR_PRESETS', () => {
    assert.ok(Array.isArray(LANE_COLOR_PRESETS));
    assert.strictEqual(LANE_COLOR_PRESETS.length, 7);
    assert.ok(LANE_COLOR_PRESETS.find(p => p.value === '#ef4444' && p.label === '红'));
    assert.ok(LANE_COLOR_PRESETS.find(p => p.value === '#22c55e' && p.label === '绿'));
  });
});

describe('KanbanSettings Module - Lane Color Functions', () => {
  beforeEach(() => {
    Object.keys(mockLaneColors).forEach(k => delete mockLaneColors[k]);
    mockColumnOrder.length = 0;
    mockColumnOrder.push('todo', 'in-progress', 'done');
  });

  it('should get lane colors', () => {
    mockLaneColors['project-1'] = '#ff0000';

    const result = getLaneColors();

    assert.deepStrictEqual(result, mockLaneColors);
  });

  it('should save lane colors', () => {
    const colors = { 'project-1': '#ff0000', 'project-2': '#00ff00' };

    saveLaneColors(colors);

    assert.deepStrictEqual(mockLaneColors, colors);
  });

  it('should get lane color for specific key', () => {
    mockLaneColors['project-1'] = '#ff0000';

    const result = getLaneColor('project-1');

    assert.strictEqual(result, '#ff0000');
  });

  it('should return null for non-existent lane color', () => {
    const result = getLaneColor('non-existent');

    assert.strictEqual(result, null);
  });

  it('should set lane color', () => {
    setLaneColor('project-1', '#ff0000');

    assert.strictEqual(mockLaneColors['project-1'], '#ff0000');
  });

  it('should update existing lane color', () => {
    mockLaneColors['project-1'] = '#ff0000';

    setLaneColor('project-1', '#00ff00');

    assert.strictEqual(mockLaneColors['project-1'], '#00ff00');
  });
});

describe('KanbanSettings Module - Column Order Functions', () => {
  beforeEach(() => {
    Object.keys(mockLaneColors).forEach(k => delete mockLaneColors[k]);
    mockColumnOrder.length = 0;
    mockColumnOrder.push('todo', 'in-progress', 'done');
  });

  it('should get column order', () => {
    const result = getColumnOrder();

    assert.deepStrictEqual(result, ['todo', 'in-progress', 'done']);
  });

  it('should get ordered columns', () => {
    const result = getOrderedColumns();

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].id, 'todo');
    assert.strictEqual(result[1].id, 'in-progress');
    assert.strictEqual(result[2].id, 'done');
  });

  it('should filter out unknown column ids in getOrderedColumns', () => {
    mockColumnOrder.length = 0;
    mockColumnOrder.push('todo', 'unknown-col', 'done');

    const result = getOrderedColumns();

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, 'todo');
    assert.strictEqual(result[1].id, 'done');
  });

  it('should save column order', () => {
    saveColumnOrder(['done', 'todo', 'in-progress']);

    assert.deepStrictEqual(mockColumnOrder, ['done', 'todo', 'in-progress']);
  });
});

describe('KanbanSettings Module - Auto Assign Color', () => {
  beforeEach(() => {
    Object.keys(mockLaneColors).forEach(k => delete mockLaneColors[k]);
    mockColumnOrder.length = 0;
    mockColumnOrder.push('todo', 'in-progress', 'done');
  });

  it('should auto-assign color to project with no existing color', () => {
    const result = autoAssignProjectColor('project-1');

    assert.strictEqual(mockLaneColors['project-1'], '#ef4444'); // First preset color
  });

  it('should return existing color if project already has one', () => {
    mockLaneColors['project-1'] = '#00ff00';

    const result = autoAssignProjectColor('project-1');

    assert.strictEqual(result, '#00ff00');
    // Should NOT reassign
    assert.strictEqual(mockLaneColors['project-1'], '#00ff00');
  });

  it('should use next available preset color', () => {
    mockLaneColors['project-0'] = '#ef4444'; // Red already used

    const result = autoAssignProjectColor('project-1');

    assert.strictEqual(result, '#f59e0b'); // Orange (second preset)
  });

  it('should cycle to first color when all presets are used', () => {
    // Fill all preset colors
    LANE_COLOR_PRESETS.forEach((preset, i) => {
      mockLaneColors[`project-${i}`] = preset.value;
    });

    const result = autoAssignProjectColor('project-overflow');

    assert.strictEqual(result, LANE_COLOR_PRESETS[0].value); // Back to first
  });

  it('should handle empty laneColors object', () => {
    Object.keys(mockLaneColors).forEach(k => delete mockLaneColors[k]);

    const result = autoAssignProjectColor('first-project');

    assert.strictEqual(result, '#ef4444');
  });
});
