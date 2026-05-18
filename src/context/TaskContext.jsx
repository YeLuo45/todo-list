import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getTasks, setTasks, initStorage, getTasksFromOPFS, getStorageMode } from '../utils/storage';

const TaskContext = createContext(null);

export function computeTaskScore(task) {
  const imp = task.importance ?? 3;
  const urg = task.urgency ?? 3;
  return imp * urg;
}

export function getQuadrant(task) {
  const imp = task.importance ?? 3;
  const urg = task.urgency ?? 3;
  if (urg >= 3 && imp >= 3) return 'Q1';
  if (imp >= 3 && urg < 3) return 'Q2';
  if (urg >= 3 && imp < 3) return 'Q3';
  return 'Q4';
}

export const QUADRANT_LABELS = {
  Q1: { label: '重要且紧急', color: '#ef4444', icon: '🔴', desc: '立即处理' },
  Q2: { label: '重要不紧急', color: '#3b82f6', icon: '🔵', desc: '计划处理' },
  Q3: { label: '紧急不重要', color: '#f59e0b', icon: '🟡', desc: '尽快处理' },
  Q4: { label: '不重要不紧急', color: '#9ca3af', icon: '⚪', desc: '可忽略' },
};

const SCHEMA_VERSION_KEY = 'hermes-todo-schema-version';
const CURRENT_SCHEMA_VERSION = 3;
const MILESTONE_STORAGE_KEY = 'hermes_milestones_v1';

// Optimistic UI — 乐观更新失败回滚事件
export const OPTIMISTIC_ROLLBACK = 'optimistic-rollback';

// Data migration functions
const migrations = {
  2: (tasks) => {
    return tasks.map(task => ({
      ...task,
      recurrence: task.recurrence || null,
      recurrenceEndDate: task.recurrenceEndDate || null,
      generatedDate: task.generatedDate || task.createdAt,
    }));
  },
  3: (tasks) => {
    const priorityMap = { high: 'P0', medium: 'P1', low: 'P2' };
    return tasks.map(task => ({
      ...task,
      priority: priorityMap[task.priority] || task.priority || 'P1',
    }));
  },
};

const migrateData = (tasks) => {
  let migratedTasks = tasks;
  for (let v = 2; v <= CURRENT_SCHEMA_VERSION; v++) {
    if (migrations[v]) {
      migratedTasks = migrations[v](migratedTasks);
      console.log(`[TaskContext] Migrated data to v${v}`);
    }
  }
  localStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
  return migratedTasks;
};

// Helper: optimistic save with rollback on failure
// saveOptimistic returns true if save succeeded, false if rolled back
function createOptimisticSave(setTasks) {
  // Snapshot ref for rollback — keyed by render cycle to avoid stale refs
  let snapshot = null;

  const saveSnapshot = (tasks) => {
    snapshot = tasks;
  };

  const saveOptimistic = (tasks, operation, payload) => {
    // Save to storage
    const ok = setTasks(tasks);
    if (!ok && snapshot) {
      // Rollback to snapshot
      setTasks(snapshot);
      snapshot = null;
      window.dispatchEvent(new CustomEvent(OPTIMISTIC_ROLLBACK, {
        detail: { operation, payload, message: `${operation} 保存失败，已回滚` }
      }));
      return false;
    }
    snapshot = null;
    return true;
  };

  return { saveOptimistic, saveSnapshot };
}

export function TaskProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [filterProject, setFilterProject] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [isLoading, setIsLoading] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [dateFilter, setDateFilter] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());

  const { saveOptimistic, saveSnapshot } = createOptimisticSave(setTasks);

  // Generate daily recurring tasks if needed
  const ensureRecurringTasks = useCallback((taskList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const now = new Date().toISOString();

    const updatedList = [...taskList];
    let hasChanges = false;

    taskList.forEach(task => {
      if (!task.recurrence) return;

      const todayInstance = taskList.find(
        t => t.parentId === task.id && t.generatedDate && t.generatedDate.startsWith(todayStr)
      );

      if (todayInstance) return;

      if (task.recurrenceEndDate) {
        const endDate = new Date(task.recurrenceEndDate);
        endDate.setHours(23, 59, 59, 999);
        if (endDate < today) return;
      }

      const newInstance = {
        id: `${task.id}-${todayStr}`,
        parentId: task.id,
        title: task.title,
        content: task.content,
        tags: task.tags,
        priority: task.priority,
        status: 'todo',
        dueDate: task.dueDate,
        recurrence: null,
        recurrenceEndDate: null,
        generatedDate: now,
        createdAt: now,
        updatedAt: now,
        reminded: false,
      };
      updatedList.push(newInstance);
      hasChanges = true;
    });

    return hasChanges ? updatedList : null;
  }, []);

  useEffect(() => {
    initStorage().then(() => {
      const mode = getStorageMode();
      if (mode === 'opfs') {
        getTasksFromOPFS().then((loadedTasks) => {
          const updated = ensureRecurringTasks(loadedTasks);
          setTasksState(updated || loadedTasks || []);
          setIsLoading(false);
        });
      } else {
        const loadedTasks = getTasks();
        const updated = ensureRecurringTasks(loadedTasks);
        setTasksState(updated || loadedTasks || []);
        setIsLoading(false);
      }
    });
  }, [ensureRecurringTasks]);

  // Optimistic UI: 持久化 tasks 到 storage（失败时回滚由 mutation 函数自行处理）
  useEffect(() => {
    if (!isLoading) {
      setTasks(tasks);
    }
  }, [tasks, isLoading]);

  // Load milestones
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MILESTONE_STORAGE_KEY);
      if (stored) {
        setMilestones(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load milestones', e);
    }
  }, []);

  // Save milestones
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(MILESTONE_STORAGE_KEY, JSON.stringify(milestones));
    }
  }, [milestones, isLoading]);

  const createTask = useCallback((taskData) => {
    const now = new Date().toISOString();
    const newTask = {
      id: taskData.id || uuidv4(),
      title: taskData.title || '',
      content: taskData.content || '',
      tags: taskData.tags || [],
      priority: taskData.priority || 'P1',
      status: taskData.status || 'todo',
      dueDate: taskData.dueDate || null,
      subtasks: taskData.subtasks || [],
      dependsOn: taskData.dependsOn || [],
      remindBefore: taskData.remindBefore || null,
      remindAt: taskData.remindAt || null,
      recurrence: taskData.recurrence || null,
      recurrenceEndDate: taskData.recurrenceEndDate || null,
      isRecurring: taskData.isRecurring || false,
      recurrenceInterval: taskData.recurrenceInterval || null,
      generatedDate: taskData.generatedDate || now,
      parentId: taskData.parentId || null,
      order: taskData.order ?? Date.now(),
      createdAt: now,
      updatedAt: now,
      reminded: false,
      importance: taskData.importance ?? 3,
      urgency: taskData.urgency ?? 3,
      startTime: taskData.startTime || null,
      endTime: taskData.endTime || null,
      projectId: taskData.projectId || null,
    };

    setTasks((prev) => {
      const next = [newTask, ...prev];
      saveSnapshot(prev);
      saveOptimistic(next, '创建任务', { id: newTask.id });
      return next;
    });

    window.dispatchEvent(new CustomEvent('task-created', { detail: newTask }));
    return newTask;
  }, [saveOptimistic, saveSnapshot]);

  const updateTask = useCallback((id, updates) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task) return prev;

      const next = { ...updates, updatedAt: new Date().toISOString() };
      if (updates.status && updates.status !== task.status) {
        if (updates.status === 'in-progress' && !next.startTime) {
          next.startTime = new Date().toISOString();
        }
        if (updates.status === 'done' && !next.endTime) {
          next.endTime = new Date().toISOString();
        }

        if (updates.status === 'done' && task.isRecurring && task.recurrenceInterval) {
          const recurrenceEnd = task.recurrenceEndDate ? new Date(task.recurrenceEndDate) : null;
          const nextDate = new Date(
            task.recurrenceInterval === 'daily' ? (task.dueDate ? new Date(task.dueDate) : new Date()) :
            task.recurrenceInterval === 'weekly' ? (task.dueDate ? new Date(task.dueDate) : new Date()) :
            (task.dueDate ? new Date(task.dueDate) : new Date())
          );
          if (task.recurrenceInterval === 'daily') nextDate.setDate(nextDate.getDate() + 1);
          else if (task.recurrenceInterval === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
          else if (task.recurrenceInterval === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);

          if (!recurrenceEnd || nextDate <= recurrenceEnd) {
            const newTask = {
              ...task,
              id: `${task.id}-${Date.now()}`,
              title: task.title,
              content: task.content,
              dueDate: nextDate.toISOString().split('T')[0],
              status: 'todo',
              startTime: null,
              endTime: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              subtasks: task.subtasks.map((st) => ({ ...st, done: false })),
            };
            const updated = [...prev.map((t) => t.id === id ? { ...t, ...next } : t), newTask];
            saveSnapshot(prev);
            saveOptimistic(updated, '更新任务', { id });
            return updated;
          }
        }
      }
      const updated = prev.map((t) => t.id === id ? { ...t, ...next } : t);
      saveSnapshot(prev);
      saveOptimistic(updated, '更新任务', { id });
      return updated;
    });
    window.dispatchEvent(new CustomEvent('task-updated', { detail: { id, updates } }));
  }, [saveOptimistic, saveSnapshot]);

  const deleteTask = useCallback((id) => {
    setTasks((prev) => {
      const task = prev.find(t => t.id === id);
      if (!task) return prev;
      const updated = prev.filter((task) => task.id !== id);
      saveSnapshot(prev);
      const ok = saveOptimistic(updated, '删除任务', { id, task });
      if (!ok) {
        // saveOptimistic already rolled back via event
        return prev;
      }
      window.dispatchEvent(new CustomEvent('task-deleted', { detail: { id } }));
      return updated;
    });
  }, [saveOptimistic, saveSnapshot]);

  // Batch operations
  const batchDeleteTasks = useCallback((ids) => {
    setTasks((prev) => {
      const updated = prev.filter((task) => !ids.includes(task.id));
      saveSnapshot(prev);
      saveOptimistic(updated, '批量删除', { ids });
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      return updated;
    });
  }, [saveOptimistic, saveSnapshot]);

  const batchUpdateTasks = useCallback((ids, updates) => {
    setTasks((prev) => {
      const updated = prev.map((task) =>
        ids.includes(task.id)
          ? { ...task, ...updates, updatedAt: new Date().toISOString() }
          : task
      );
      saveSnapshot(prev);
      saveOptimistic(updated, '批量更新', { ids });
      return updated;
    });
  }, [saveOptimistic, saveSnapshot]);

  const toggleTaskSelection = useCallback((id) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllTasks = useCallback((ids) => {
    setSelectedTaskIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  const reorderTasks = useCallback((taskId, newOrder) => {
    setTasks((prev) => {
      const updated = prev.map((task) =>
        task.id === taskId
          ? { ...task, order: newOrder, updatedAt: new Date().toISOString() }
          : task
      );
      saveSnapshot(prev);
      saveOptimistic(updated, '排序', { taskId });
      return updated;
    });
  }, [saveOptimistic, saveSnapshot]);

  const markAsRead = useCallback((id) => {
    setTasks((prev) => {
      const updated = prev.map((task) =>
        task.id === id ? { ...task, reminded: true } : task
      );
      saveSnapshot(prev);
      saveOptimistic(updated, '标记已读', { id });
      return updated;
    });
  }, [saveOptimistic, saveSnapshot]);

  const getAllTags = useCallback(() => {
    const tagSet = new Set();
    tasks.forEach((task) => {
      task.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  // Check if a task is blocked by incomplete dependencies
  const isTaskBlocked = useCallback((taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.dependsOn || task.dependsOn.length === 0) return false;
    return task.dependsOn.some((depId) => {
      const dep = tasks.find((t) => t.id === depId);
      return dep && dep.status !== 'done';
    });
  }, [tasks]);

  // Detect circular dependency before adding
  const wouldCreateCycle = useCallback((taskId, newDepId) => {
    const visited = new Set();
    const stack = [newDepId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === taskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const t = tasks.find((task) => task.id === current);
      if (t && t.dependsOn) stack.push(...t.dependsOn);
    }
    return false;
  }, [tasks]);

  // Update milestone color
  const updateMilestoneColor = useCallback((milestoneId, color) => {
    setMilestones(prev => prev.map(m =>
      m.id === milestoneId ? { ...m, color } : m
    ));
  }, []);

  const filteredTasks = tasks
    .filter((task) => {
      if (hideCompleted && task.status === 'done') return false;
      if (dateFilter) {
        const taskDate = task.generatedDate || task.createdAt;
        if (!taskDate.startsWith(dateFilter)) return false;
      }
      if (filterTags.length > 0 && !task.tags.some(tag => filterTags.includes(tag))) return false;
      if (filterProject && task.projectId !== filterProject) return false;
      if (searchResult !== null && !searchResult.includes(task.id)) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        case 'priority': {
          const order = { 'P0': 0, 'P1': 1, 'P2': 2 };
          const aOrder = order[a.priority] ?? 3;
          const bOrder = order[b.priority] ?? 3;
          return aOrder - bOrder;
        }
        case 'createdAt':
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

  // Helper to allow child components to trigger state update without duplicate saving
  const setTasksState = useCallback((newTasks) => {
    setTasks(newTasks);
  }, [setTasks]);

  return (
    <TaskContext.Provider
      value={{
        tasks: filteredTasks,
        allTasks: tasks,
        milestones,
        setMilestones,
        setTasks: setTasksState,
        filterTags,
        setFilterTags,
        filterProject,
        setFilterProject,
        searchQuery,
        setSearchQuery,
        searchResult,
        setSearchResult,
        sortBy,
        setSortBy,
        hideCompleted,
        setHideCompleted,
        dateFilter,
        setDateFilter,
        createTask,
        updateTask,
        deleteTask,
        reorderTasks,
        markAsRead,
        getAllTags,
        selectedTaskIds,
        toggleTaskSelection,
        selectAllTasks,
        clearSelection,
        batchDeleteTasks,
        batchUpdateTasks,
        isTaskBlocked,
        wouldCreateCycle,
        updateMilestoneColor,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTaskContext() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
}