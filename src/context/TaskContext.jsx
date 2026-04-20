import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const TaskContext = createContext(null);

const STORAGE_KEY = 'hermes-todo-tasks';
const SCHEMA_VERSION_KEY = 'hermes-todo-schema-version';
const CURRENT_SCHEMA_VERSION = 2;

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
};

const migrateData = (tasks) => {
  const schemaVersion = parseInt(localStorage.getItem(SCHEMA_KEY) || '1', 10);
  let migratedTasks = tasks;
  
  for (let v = schemaVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    if (migrations[v]) {
      migratedTasks = migrations[v](migratedTasks);
      console.log(`[TaskContext] Migrated data to v${v}`);
    }
  }
  
  localStorage.setItem(SCHEMA_KEY, String(CURRENT_SCHEMA_VERSION));
  return migratedTasks;
};

const SCHEMA_KEY = 'hermes-todo-schema-version';

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
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const tasks = JSON.parse(stored);
        return migrateData(tasks);
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
  const [filterTag, setFilterTag] = useState('');
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
      priority: taskData.priority || 'medium',
      status: taskData.status || 'todo',
      dueDate: taskData.dueDate || null,
      recurrence: taskData.recurrence || null,
      recurrenceEndDate: taskData.recurrenceEndDate || null,
      generatedDate: taskData.generatedDate || now,
      parentId: taskData.parentId || null,
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
      if (filterTag && !task.tags.includes(filterTag)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !task.title.toLowerCase().includes(q) &&
          !task.content.toLowerCase().includes(q)
        )
          return false;
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
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.priority] - order[b.priority];
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
        filterTag,
        setFilterTag,
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
