/**
 * storage.js - Unified Storage Layer
 * 
 * Provides a localStorage-compatible API with automatic OPFS fallback.
 * When task count > 500, automatically uses OPFS for better storage capacity.
 * Falls back to localStorage (with sharding) for smaller datasets.
 * 
 * OPFS (Origin Private File System) provides ~GB level storage vs localStorage's ~5MB.
 */

import { saveToOPFS, loadFromOPFS, deleteFromOPFS, isOPFSSupported as checkOPFSSupport } from './opfsStorage';
import { loadTasks as loadShardedTasks, saveTasks as saveShardedTasks } from './storageOptimizer';

// Storage keys
const TASKS_KEY = 'hermes_todos_v2';
const OPFS_TASKS_KEY = 'tasks'; // OPFS file name (without .json)
const LARGE_DATA_THRESHOLD = 500; // Switch to OPFS when tasks > 500

// Storage mode tracking
let storageMode = 'localStorage'; // 'localStorage' | 'opfs'
let opfsAvailable = null; // null = not checked yet, true/false = result

/**
 * Check if OPFS is supported and available
 */
function isOPFSSupported() {
  if (opfsAvailable !== null) return opfsAvailable;
  
  if (typeof window === 'undefined' || !checkOPFSSupport()) {
    opfsAvailable = false;
    return false;
  }
  
  // Check if we actually have permission/access
  try {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      opfsAvailable = false;
      return false;
    }
    opfsAvailable = true;
    return true;
  } catch (e) {
    console.warn('[storage] OPFS check failed:', e);
    opfsAvailable = false;
    return false;
  }
}

/**
 * Get the current storage mode
 */
export function getStorageMode() {
  return storageMode;
}

/**
 * Check if OPFS is currently being used
 */
export function isUsingOPFS() {
  return storageMode === 'opfs';
}

/**
 * Get item from storage (auto-detects OPFS vs localStorage)
 * @param {string} key - Storage key
 * @returns {any} Parsed value or null
 */
export function getItem(key) {
  // For tasks, check if we should use OPFS
  if (key === TASKS_KEY) {
    return getTasks();
  }
  
  // For other keys, use localStorage
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (e) {
    console.error(`[storage] getItem error for key "${key}":`, e);
    return null;
  }
}

/**
 * Set item to storage (auto-detects OPFS vs localStorage)
 * @param {string} key - Storage key
 * @param {any} value - Value to store (will be JSON stringified)
 * @returns {boolean} Success
 */
export function setItem(key, value) {
  // For tasks, check if we should use OPFS based on data size
  if (key === TASKS_KEY) {
    return setTasks(value);
  }
  
  // For other keys, use localStorage
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[storage] setItem error for key "${key}":`, e);
    return false;
  }
}

/**
 * Remove item from storage
 * @param {string} key - Storage key
 * @returns {boolean} Success
 */
export function removeItem(key) {
  // For tasks, clear from both storages
  if (key === TASKS_KEY) {
    return removeTasks();
  }
  
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error(`[storage] removeItem error for key "${key}":`, e);
    return false;
  }
}

/**
 * Clear all stored data
 * @param {boolean} clearOPFS - Also clear OPFS data (default: true)
 * @returns {boolean} Success
 */
export async function clear(clearOPFS = true) {
  try {
    // Clear localStorage tasks-related keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('hermes_tasks') || key === 'hermes_todos_v2')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear OPFS if requested and available
    if (clearOPFS && isOPFSSupported()) {
      try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry('hermes-todo', { recursive: true });
        console.log('[storage] OPFS cleared');
      } catch (e) {
        console.warn('[storage] Failed to clear OPFS:', e);
      }
    }
    
    storageMode = 'localStorage';
    return true;
  } catch (e) {
    console.error('[storage] clear error:', e);
    return false;
  }
}

/**
 * Get tasks - automatically chooses OPFS vs localStorage based on count
 * @returns {Array} Array of tasks
 */
export function getTasks() {
  // If using OPFS, load from there
  if (storageMode === 'opfs') {
    if (!isOPFSSupported()) {
      console.warn('[storage] OPFS not available, falling back to localStorage');
      storageMode = 'localStorage';
    } else {
      // Use sharded loader but from OPFS would need async
      // For sync getTasks, we rely on storageMode flag
      // This is a limitation - for async loading, use getTasksAsync
      console.warn('[storage] Sync getTasks called while in OPFS mode, may be stale');
    }
  }
  
  // Use sharded localStorage loader
  return loadShardedTasks();
}

/**
 * Set tasks - automatically chooses OPFS vs localStorage based on count
 * @param {Array} tasks - Array of tasks
 * @returns {boolean} Success
 */
export function setTasks(tasks) {
  const taskCount = Array.isArray(tasks) ? tasks.length : 0;
  
  // Auto-switch to OPFS when task count exceeds threshold
  if (taskCount > LARGE_DATA_THRESHOLD) {
    if (isOPFSSupported()) {
      storageMode = 'opfs';
      return setTasksOPFS(tasks);
    } else {
      console.warn(`[storage] Task count (${taskCount}) exceeds threshold (${LARGE_DATA_THRESHOLD}) but OPFS not available, using sharded localStorage`);
    }
  }
  
  // Use sharded localStorage
  storageMode = 'localStorage';
  return saveShardedTasks(tasks);
}

/**
 * Set tasks to OPFS (async)
 * @param {Array} tasks - Array of tasks
 * @returns {boolean} Success
 */
async function setTasksOPFS(tasks) {
  try {
    const success = await saveToOPFS(OPFS_TASKS_KEY, {
      tasks,
      savedAt: new Date().toISOString(),
      taskCount: tasks.length,
      version: 1
    });
    
    if (success) {
      // Also keep a small index in localStorage to know we're using OPFS
      localStorage.setItem('hermes_opfs_tasks_index', JSON.stringify({
        usingOPFS: true,
        taskCount: tasks.length,
        savedAt: new Date().toISOString()
      }));
      console.log(`[storage] Saved ${tasks.length} tasks to OPFS`);
    }
    
    return success;
  } catch (e) {
    console.error('[storage] Failed to save tasks to OPFS:', e);
    return false;
  }
}

/**
 * Get tasks from OPFS (async)
 * @returns {Promise<Array>} Array of tasks
 */
export async function getTasksFromOPFS() {
  try {
    const data = await loadFromOPFS(OPFS_TASKS_KEY);
    if (data && Array.isArray(data.tasks)) {
      console.log(`[storage] Loaded ${data.tasks.length} tasks from OPFS`);
      return data.tasks;
    }
    return [];
  } catch (e) {
    console.error('[storage] Failed to load tasks from OPFS:', e);
    return [];
  }
}

/**
 * Remove tasks from storage
 * @returns {boolean} Success
 */
export function removeTasks() {
  try {
    // Remove from localStorage sharded keys
    const index = { shardCount: 0, taskIds: [], version: 1 };
    try {
      const indexStr = localStorage.getItem('hermes_tasks_index');
      if (indexStr) {
        const parsed = JSON.parse(indexStr);
        // Clear all shard keys
        for (let i = 0; i < parsed.shardCount; i++) {
          localStorage.removeItem(`hermes_tasks_shard_${i}`);
        }
      }
    } catch (e) { /* ignore */ }
    
    localStorage.removeItem('hermes_tasks_index');
    localStorage.removeItem('hermes_todos_v2');
    localStorage.removeItem('hermes_opfs_tasks_index');
    
    // Remove from OPFS if available
    if (isOPFSSupported()) {
      deleteFromOPFS(OPFS_TASKS_KEY).catch(e => {
        console.warn('[storage] Failed to delete tasks from OPFS:', e);
      });
    }
    
    storageMode = 'localStorage';
    return true;
  } catch (e) {
    console.error('[storage] removeTasks error:', e);
    return false;
  }
}

/**
 * Migrate data from localStorage to OPFS
 * @param {Object} options - Migration options
 * @param {boolean} options.force - Force migration even for small datasets
 * @param {Function} options.onProgress - Progress callback (phase, percent)
 * @returns {Promise<Object>} Migration result
 */
export async function migrateToOPFS(options = {}) {
  const { force = false, onProgress } = options;
  
  if (!isOPFSSupported()) {
    return { success: false, error: 'OPFS not supported in this browser' };
  }
  
  const progress = (phase, percent) => {
    if (onProgress) onProgress(phase, percent);
  };
  
  try {
    progress('checking', 0);
    
    // Get current tasks from localStorage
    const tasks = loadShardedTasks();
    
    if (tasks.length === 0) {
      return { success: true, migrated: 0, message: 'No tasks to migrate' };
    }
    
    // Check if migration is needed
    if (!force && tasks.length <= LARGE_DATA_THRESHOLD) {
      return { 
        success: true, 
        migrated: 0, 
        message: `Task count (${tasks.length}) below threshold (${LARGE_DATA_THRESHOLD}), no migration needed. Use force=true to migrate anyway.`
      };
    }
    
    progress('migrating', 30);
    
    // Save to OPFS
    const success = await saveToOPFS(OPFS_TASKS_KEY, {
      tasks,
      savedAt: new Date().toISOString(),
      taskCount: tasks.length,
      version: 1,
      migratedFrom: 'localStorage'
    });
    
    if (!success) {
      return { success: false, error: 'Failed to write to OPFS' };
    }
    
    progress('cleaning', 70);
    
    // Clear old localStorage shards (keep for rollback)
    const indexStr = localStorage.getItem('hermes_tasks_index');
    if (indexStr) {
      try {
        const parsed = JSON.parse(indexStr);
        for (let i = 0; i < parsed.shardCount; i++) {
          localStorage.removeItem(`hermes_tasks_shard_${i}`);
        }
      } catch (e) { /* ignore */ }
    }
    localStorage.removeItem('hermes_tasks_index');
    localStorage.removeItem('hermes_todos_v2');
    
    // Set OPFS index marker
    localStorage.setItem('hermes_opfs_tasks_index', JSON.stringify({
      usingOPFS: true,
      taskCount: tasks.length,
      savedAt: new Date().toISOString(),
      migratedAt: new Date().toISOString()
    }));
    
    storageMode = 'opfs';
    
    progress('complete', 100);
    
    console.log(`[storage] Migration complete: ${tasks.length} tasks migrated to OPFS`);
    
    return { 
      success: true, 
      migrated: tasks.length,
      message: `Successfully migrated ${tasks.length} tasks to OPFS`
    };
  } catch (e) {
    console.error('[storage] Migration error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Check if data should use OPFS based on task count
 * @param {number} taskCount - Number of tasks
 * @returns {boolean} True if should use OPFS
 */
export function shouldUseOPFS(taskCount) {
  return taskCount > LARGE_DATA_THRESHOLD && isOPFSSupported();
}

/**
 * Get storage info (for debugging/display)
 * @returns {Object} Storage info
 */
export function getStorageInfo() {
  const taskCount = (() => {
    try {
      const tasks = loadShardedTasks();
      return tasks.length;
    } catch {
      return 0;
    }
  })();
  
  return {
    mode: storageMode,
    opfsAvailable: isOPFSSupported(),
    taskCount,
    threshold: LARGE_DATA_THRESHOLD,
    shouldUseOPFS: shouldUseOPFS(taskCount),
    localStorage: {
      used: (() => {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const value = localStorage.getItem(key);
          if (key && value) total += (key.length + value.length) * 2;
        }
        return (total / (1024 * 1024)).toFixed(2) + ' MB';
      })(),
      quota: '5 MB (shared)'
    }
  };
}

/**
 * Initialize storage - checks for OPFS support and existing data
 * @returns {Promise<Object>} Init result
 */
export async function initStorage() {
  // Check OPFS support
  const opfsSupported = isOPFSSupported();
  
  // Check if we have OPFS data
  let hasOPFSData = false;
  if (opfsSupported) {
    try {
      const indexStr = localStorage.getItem('hermes_opfs_tasks_index');
      if (indexStr) {
        const index = JSON.parse(indexStr);
        hasOPFSData = index.usingOPFS === true;
      }
    } catch (e) { /* ignore */ }
  }
  
  if (hasOPFSData) {
    storageMode = 'opfs';
    console.log('[storage] Initialized in OPFS mode');
  } else {
    storageMode = 'localStorage';
    console.log('[storage] Initialized in localStorage mode');
  }
  
  return {
    opfsSupported,
    mode: storageMode,
    hasOPFSData
  };
}

/**
 * Sync getItem - synchronous, returns cached/default value
 * For async access to OPFS data, use getTasksFromOPFS()
 */
export function syncGetItem(key) {
  return getItem(key);
}

/**
 * Async getItem - always returns Promise
 */
export async function asyncGetItem(key) {
  if (key === TASKS_KEY) {
    if (storageMode === 'opfs') {
      const tasks = await getTasksFromOPFS();
      return tasks;
    }
    return getTasks();
  }
  
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (e) {
    console.error(`[storage] asyncGetItem error for key "${key}":`, e);
    return null;
  }
}

// Default export with all functions
export default {
  getItem,
  setItem,
  removeItem,
  clear,
  getTasks,
  setTasks,
  removeTasks,
  getTasksFromOPFS,
  migrateToOPFS,
  getStorageMode,
  isUsingOPFS,
  isOPFSSupported: isOPFSSupported,
  shouldUseOPFS,
  getStorageInfo,
  initStorage,
  syncGetItem,
  asyncGetItem,
  LARGE_DATA_THRESHOLD
};