import { useState, useEffect, useCallback } from 'react';
import { TaskProvider, useTaskContext } from './context/TaskContext';
import TaskList from './components/TaskList';
import FilterBar from './components/FilterBar';
import ReminderToast from './components/ReminderToast';
import { checkReminders, requestNotificationPermission, sendNotification } from './utils/reminder';
import './App.css';

function AppContent() {
  const { allTasks, markAsRead } = useTaskContext();
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    // Request notification permission on mount
    requestNotificationPermission();
    
    // Check reminders immediately on load
    checkReminders(allTasks, (task) => {
      sendNotification(task);
      markAsRead(task.id);
      addToast(`Task "${task.title}" is due!`);
    });
  }, []);

  const addToast = useCallback((message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>📝 Hermes TodoList</h1>
        <p className="subtitle">Manage your tasks efficiently</p>
      </header>

      <main className="app-main">
        <FilterBar />
        <TaskList />
      </main>

      <footer className="app-footer">
        <p>Hermes TodoList • Built with React + Vite</p>
      </footer>

      {toasts.map((toast) => (
        <ReminderToast
          key={toast.id}
          message={toast.message}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

export default function App() {
  return (
    <TaskProvider>
      <AppContent />
    </TaskProvider>
  );
}
