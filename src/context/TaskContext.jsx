import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { fuzzySearch } from '../utils/search';

const TaskContext = createContext(null);

const STORAGE_KEY = 'hermes_todos_v2';
const LEGACY_STORAGE_KEY = 'hermes-todo-tasks';
const SCHEMA_VERSION_KEY = 'hermes-todo-schema-version';
const CURRENT_SCHEMA_VERSION = 3;

// Data migration functions
const migrations = {
  2: (tasks) => {
    // v2: Add recurrence fields, convert status to Chinese display only (value stays same)
    return tasks.map(task => ({
      ...task,
      recurrence: task.recurrence || null, // null, 'daily', 'weekly', 'monthly'
      recurrenceEndDate: task.recurrenceEndDate || null,
      generatedDate: task.generatedDate || task.createdAt, // date when this instance was generated
      // status values remain: 'todo', 'in-progress', 'done'
    }));
  },
  3: (tasks) => {
    // v3: Convert priority from high/medium/low to P0/P1/P2, migrate from legacy storage key
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

// Detect if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI;
};

// Load tasks from Electron file storage or localStorage
const loadTasks = async () => {
  if (isElectron()) {
    try {
      const data = await window.electronAPI.loadTasks();
      const tasks = data.tasks || [];
      return migrateData(tasks);
    } catch (e) {
      console.error('Failed to load tasks from Electron storage', e);
      return [];
    }
  } else {
    try {
      // Check new storage key first
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const tasks = JSON.parse(stored);
        return migrateData(tasks);
      }
      // Fallback to legacy storage key and migrate
      const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyStored) {
        const tasks = JSON.parse(legacyStored);
        const migrated = migrateData(tasks);
        // Save to new storage key
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        // Clear legacy
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        console.log('[TaskContext] Migrated legacy data to hermes_todos_v2');
        return migrated;
      }
    } catch (e) {
      console.error('Failed to load tasks from localStorage', e);
    }
    return [];
  }
};

// Save tasks to Electron file storage or localStorage
const saveTasks = async (tasks) => {
  if (isElectron()) {
    try {
      await window.electronAPI.saveTasks({ tasks });
      return true;
    } catch (e) {
      console.error('Failed to save tasks to Electron storage', e);
      return false;
    }
  } else {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      return true;
    } catch (e) {
      console.error('Failed to save tasks to localStorage', e);
      return false;
    }
  }
};

export function TaskProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [filterTags, setFilterTags] = useState([]); // multi-select tags
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [isLoading, setIsLoading] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [dateFilter, setDateFilter] = useState(null); // null = all, or date string 'YYYY-MM-DD'

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

      // Check if a task instance for today already exists
      const todayInstance = taskList.find(
        t => t.parentId === task.id && t.generatedDate && t.generatedDate.startsWith(todayStr)
      );

      if (todayInstance) return; // Already has today's instance

      // Check if recurrence has ended
      if (task.recurrenceEndDate) {
        const endDate = new Date(task.recurrenceEndDate);
        endDate.setHours(23, 59, 59, 999);
        if (endDate < today) return;
      }

      // Create today's instance
      const newInstance = {
        id: `${task.id}-${todayStr}`,
        parentId: task.id,
        title: task.title,
        content: task.content,
        tags: task.tags,
        priority: task.priority,
        status: 'todo',
        dueDate: task.dueDate,
        recurrence: null, // instance is not recurring
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
    loadTasks().then((loadedTasks) => {
      // Ensure recurring tasks exist for today
      const updated = ensureRecurringTasks(loadedTasks);
      setTasks(updated || loadedTasks);
      setIsLoading(false);
    });
  }, [ensureRecurringTasks]);

  useEffect(() => {
    if (!isLoading) {
      saveTasks(tasks);
    }
  }, [tasks, isLoading]);

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
      recurrence: taskData.recurrence || null,
      recurrenceEndDate: taskData.recurrenceEndDate || null,
      generatedDate: taskData.generatedDate || now,
      parentId: taskData.parentId || null,
      order: taskData.order ?? Date.now(),
      createdAt: now,
      updatedAt: now,
      reminded: false,
    };
    setTasks((prev) => [newTask, ...prev]);
    return newTask;
  }, []);

  const updateTask = useCallback((id, updates) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, ...updates, updatedAt: new Date().toISOString() }
          : task
      )
    );
  }, []);

  const deleteTask = useCallback((id) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const reorderTasks = useCallback((taskId, newOrder) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, order: newOrder, updatedAt: new Date().toISOString() }
          : task
      )
    );
  }, []);

  const markAsRead = useCallback((id) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, reminded: true } : task
      )
    );
  }, []);

  const getAllTags = useCallback(() => {
    const tagSet = new Set();
    tasks.forEach((task) => {
      task.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  const filteredTasks = tasks
    .filter((task) => {
      // Hide completed filter
      if (hideCompleted && task.status === 'done') return false;
      // Date filter
      if (dateFilter) {
        const taskDate = task.generatedDate || task.createdAt;
        if (!taskDate.startsWith(dateFilter)) return false;
      }
      // Multi-select tag filter: show task if it has ANY of the selected tags
      if (filterTags.length > 0 && !task.tags.some(tag => filterTags.includes(tag))) return false;
      // Search filter: fuzzy search in title + content + tags
      if (searchQuery) {
        const matched = fuzzySearch([task], searchQuery);
        if (matched.length === 0) return false;
      }
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
          // P0=0 (highest), P1=1, P2=2, nulls last
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

  return (
    <TaskContext.Provider
      value={{
        tasks: filteredTasks,
        allTasks: tasks,
        setTasks,
        filterTags,
        setFilterTags,
        searchQuery,
        setSearchQuery,
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
