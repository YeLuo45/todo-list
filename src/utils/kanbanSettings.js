// Kanban Settings Storage Utility

const COLUMN_ORDER_KEY = 'hermes_kanban_column_order';
const LANE_COLORS_KEY = 'hermes_lane_colors';

// Default column configuration
export const DEFAULT_COLUMNS = [
  { id: 'todo', label: '待办', color: '#06b6d4' },
  { id: 'in-progress', label: '进行中', color: '#f59e0b' },
  { id: 'done', label: '已完成', color: '#22c55e' },
];

// Preset colors for swimlane coloring
export const LANE_COLOR_PRESETS = [
  { value: '#ef4444', label: '红' },
  { value: '#f59e0b', label: '橙' },
  { value: '#eab308', label: '黄' },
  { value: '#22c55e', label: '绿' },
  { value: '#3b82f6', label: '蓝' },
  { value: '#a855f7', label: '紫' },
  { value: '#6b7280', label: '灰' },
];

// Get column order from storage
export function getColumnOrder() {
  try {
    const stored = localStorage.getItem(COLUMN_ORDER_KEY);
    if (stored) {
      const order = JSON.parse(stored);
      // Validate that all default columns are present
      const defaultIds = DEFAULT_COLUMNS.map(c => c.id);
      const storedIds = order.filter(id => defaultIds.includes(id));
      if (storedIds.length === defaultIds.length) {
        return order;
      }
    }
  } catch (e) {
    console.error('Failed to load column order:', e);
  }
  return DEFAULT_COLUMNS.map(c => c.id);
}

// Save column order to storage
export function saveColumnOrder(order) {
  localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order));
}

// Get ordered columns based on saved order
export function getOrderedColumns() {
  const order = getColumnOrder();
  return order.map(id => DEFAULT_COLUMNS.find(c => c.id === id)).filter(Boolean);
}

// Get lane colors from storage
export function getLaneColors() {
  try {
    const stored = localStorage.getItem(LANE_COLORS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load lane colors:', e);
  }
  return {};
}

// Save lane colors to storage
export function saveLaneColors(colors) {
  localStorage.setItem(LANE_COLORS_KEY, JSON.stringify(colors));
}

// Get a specific lane's color
export function getLaneColor(laneKey) {
  const colors = getLaneColors();
  return colors[laneKey] || null;
}

// Set a specific lane's color
export function setLaneColor(laneKey, color) {
  const colors = getLaneColors();
  colors[laneKey] = color;
  saveLaneColors(colors);
}

// Auto-assign color to a project that has no color set
// Returns the assigned color or null if no assignment needed
export function autoAssignProjectColor(projectId, usedColors = {}) {
  const colors = getLaneColors();
  
  // If project already has a color, return that
  if (colors[projectId]) {
    return colors[projectId];
  }
  
  // Find the first preset color not yet used
  const usedSet = new Set(Object.values(colors));
  for (const preset of LANE_COLOR_PRESETS) {
    if (!usedSet.has(preset.value)) {
      colors[projectId] = preset.value;
      saveLaneColors(colors);
      return preset.value;
    }
  }
  
  // All colors used, just use the first one
  colors[projectId] = LANE_COLOR_PRESETS[0].value;
  saveLaneColors(colors);
  return colors[projectId];
}
