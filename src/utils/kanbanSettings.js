// Kanban Settings Storage Utility

import { useAppStore } from '../store/useAppStore';

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

// Hook for column order (React context)
export function useColumnOrder() {
  return useAppStore((s) => s.columnOrder);
}

// Hook for lane colors (React context)
export function useLaneColors() {
  return useAppStore((s) => s.laneColors);
}

// Get all lane colors (for non-React context)
export function getLaneColors() {
  return useAppStore.getState().laneColors;
}

// Save all lane colors (for non-React context)
export function saveLaneColors(colors) {
  useAppStore.getState().setLaneColors(colors);
}

// Get column order from store (for non-React context)
export function getColumnOrder() {
  return useAppStore.getState().columnOrder;
}

// Get ordered columns based on saved order
export function getOrderedColumns() {
  const order = useAppStore.getState().columnOrder;
  return order.map(id => DEFAULT_COLUMNS.find(c => c.id === id)).filter(Boolean);
}

// Save column order to store
export function saveColumnOrder(order) {
  useAppStore.getState().setColumnOrder(order);
}

// Get a specific lane's color (for non-React context)
export function getLaneColor(laneKey) {
  const colors = useAppStore.getState().laneColors;
  return colors[laneKey] || null;
}

// Hook for getting a specific lane's color (React context)
export function useLaneColor(laneKey) {
  return useAppStore((s) => s.laneColors[laneKey] || null);
}

// Set a specific lane's color
export function setLaneColor(laneKey, color) {
  useAppStore.getState().setLaneColor(laneKey, color);
}

// Auto-assign color to a project that has no color set
// Returns the assigned color or null if no assignment needed
export function autoAssignProjectColor(projectId) {
  const store = useAppStore.getState();
  const colors = store.laneColors;
  
  // If project already has a color, return that
  if (colors[projectId]) {
    return colors[projectId];
  }
  
  // Find the first preset color not yet used
  const usedSet = new Set(Object.values(colors));
  for (const preset of LANE_COLOR_PRESETS) {
    if (!usedSet.has(preset.value)) {
      store.setLaneColor(projectId, preset.value);
      return preset.value;
    }
  }
  
  // All colors used, just use the first one
  store.setLaneColor(projectId, LANE_COLOR_PRESETS[0].value);
  return LANE_COLOR_PRESETS[0].value;
}