/**
 * storageOptimizer.js - localStorage 读写分片
 * 解决 localStorage 5MB 上限问题
 */

const SHARD_SIZE = 200; // 每200个任务一个分片
const SHARD_PREFIX = 'hermes_tasks_shard_';
const TASKS_INDEX_KEY = 'hermes_tasks_index';
const SETTINGS_KEY = 'hermes_settings_v1';
const MILESTONE_KEY = 'hermes_milestones_v1';

// 分片索引结构
// { shardCount: number, taskIds: string[], version: number }

function getShardKey(shardIndex) {
  return `${SHARD_PREFIX}${shardIndex}`;
}

// 从索引获取所有任务ID
function loadIndex() {
  try {
    const indexStr = localStorage.getItem(TASKS_INDEX_KEY);
    if (indexStr) {
      return JSON.parse(indexStr);
    }
  } catch (e) {
    console.error('[storageOptimizer] Failed to load index:', e);
  }
  return { shardCount: 0, taskIds: [], version: 1 };
}

// 保存索引
function saveIndex(index) {
  try {
    localStorage.setItem(TASKS_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.error('[storageOptimizer] Failed to save index:', e);
  }
}

// 加载所有任务（透明分片读取）
export function loadTasks() {
  try {
    // 检查是否有旧版本数据需要迁移
    const legacyKey = 'hermes_todos_v2';
    const legacyData = localStorage.getItem(legacyKey);
    if (legacyData) {
      console.log('[storageOptimizer] Migrating legacy data to sharded storage...');
      const tasks = JSON.parse(legacyData);
      saveTasks(tasks); // 触发分片存储
      localStorage.removeItem(legacyKey);
      console.log('[storageOptimizer] Migration complete, stored in sharded format');
      return tasks;
    }

    const index = loadIndex();
    if (index.shardCount === 0 || index.taskIds.length === 0) {
      return [];
    }

    // 按分片加载任务
    const allTasks = [];
    for (let i = 0; i < index.shardCount; i++) {
      const shardKey = getShardKey(i);
      const shardStr = localStorage.getItem(shardKey);
      if (shardStr) {
        const shard = JSON.parse(shardStr);
        allTasks.push(...shard);
      }
    }

    // 按 taskIds 顺序排列
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    const orderedTasks = index.taskIds.map(id => taskMap.get(id)).filter(Boolean);

    console.log(`[storageOptimizer] Loaded ${orderedTasks.length} tasks from ${index.shardCount} shards`);
    return orderedTasks;
  } catch (e) {
    console.error('[storageOptimizer] Failed to load tasks:', e);
    return [];
  }
}

// 保存所有任务（透明分片写入）
export function saveTasks(tasks) {
  try {
    // 构建新索引
    const taskIds = tasks.map(t => t.id);
    const newIndex = {
      shardCount: Math.ceil(tasks.length / SHARD_SIZE),
      taskIds,
      version: 1,
      savedAt: new Date().toISOString()
    };

    // 清除所有旧分片
    const oldIndex = loadIndex();
    for (let i = 0; i < oldIndex.shardCount; i++) {
      localStorage.removeItem(getShardKey(i));
    }

    // 按分片存储
    for (let i = 0; i < newIndex.shardCount; i++) {
      const start = i * SHARD_SIZE;
      const end = Math.min(start + SHARD_SIZE, tasks.length);
      const shard = tasks.slice(start, end);
      localStorage.setItem(getShardKey(i), JSON.stringify(shard));
    }

    // 保存索引
    saveIndex(newIndex);
    console.log(`[storageOptimizer] Saved ${tasks.length} tasks in ${newIndex.shardCount} shards`);
    return true;
  } catch (e) {
    console.error('[storageOptimizer] Failed to save tasks:', e);
    // 如果是配额不足，尝试清理后重试
    if (e.name === 'QuotaExceededError') {
      console.warn('[storageOptimizer] Storage quota exceeded, attempting cleanup...');
      // 保留最新的half任务
      const half = Math.floor(tasks.length / 2);
      const trimmedTasks = tasks.slice(0, half);
      try {
        saveTasks(trimmedTasks);
        console.warn(`[storageOptimizer] Saved only ${trimmedTasks.length} tasks due to quota limit`);
        return true;
      } catch (e2) {
        console.error('[storageOptimizer] Even trimmed save failed:', e2);
      }
    }
    return false;
  }
}

// 单独存储里程碑
export function loadMilestones() {
  try {
    const data = localStorage.getItem(MILESTONE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('[storageOptimizer] Failed to load milestones:', e);
    return [];
  }
}

export function saveMilestones(milestones) {
  try {
    localStorage.setItem(MILESTONE_KEY, JSON.stringify(milestones));
    return true;
  } catch (e) {
    console.error('[storageOptimizer] Failed to save milestones:', e);
    return false;
  }
}

// 单独存储设置
export function loadSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('[storageOptimizer] Failed to load settings:', e);
    return {};
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.error('[storageOptimizer] Failed to save settings:', e);
    return false;
  }
}

// 获取存储使用情况
export function getStorageInfo() {
  const index = loadIndex();
  let usedBytes = 0;
  let totalTasks = index.taskIds.length;

  // 计算每个分片大小
  for (let i = 0; i < index.shardCount; i++) {
    const shardStr = localStorage.getItem(getShardKey(i));
    if (shardStr) {
      usedBytes += shardStr.length * 2; // UTF-16
    }
  }

  // 估算总 localStorage 使用（所有 key）
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    if (key && value) {
      usedBytes += (key.length + value.length) * 2;
    }
  }

  return {
    totalTasks,
    shardCount: index.shardCount,
    usedBytes,
    usedMB: (usedBytes / (1024 * 1024)).toFixed(2),
    quotaBytes: 5 * 1024 * 1024, // 5MB
    quotaMB: 5,
    usagePercent: ((usedBytes / (5 * 1024 * 1024)) * 100).toFixed(1)
  };
}