import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const TaskContext = createContext(null);

const STORAGE_KEY = 'hermes-todo-tasks';

// Detect if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI;
};

// Load tasks from Electron file storage or localStorage
const loadTasks = async () => {
  if (isElectron()) {
    try {
      const data = await window.electronAPI.loadTasks();
      return data.tasks || [];
    } catch (e) {
      console.error('Failed to load tasks from Electron storage', e);
      return [];
    }
  } else {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
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

  useEffect(() => {
    loadTasks().then((loadedTasks) => {
      setTasks(loadedTasks);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveTasks(tasks);
    }
  }, [tasks, isLoading]);

  const createTask = useCallback((taskData) => {
    const now = new Date().toISOString();
    const newTask = {
      id: uuidv4(),
      title: taskData.title || '',
      content: taskData.content || '',
      tags: taskData.tags || [],
      priority: taskData.priority || 'medium',
      status: taskData.status || 'todo',
      dueDate: taskData.dueDate || null,
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
