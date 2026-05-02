import { useState, useEffect, useCallback } from 'react';
import { TaskProvider, useTaskContext } from './context/TaskContext';
import TaskList from './components/TaskList';
import FilterBar from './components/FilterBar';
import ReminderToast from './components/ReminderToast';
import KanbanBoard from './components/KanbanBoard';
import TaskForm from './components/TaskForm';
import SyncStatus from './components/SyncStatus';
import SettingsModal from './components/SettingsModal';
import ImportExportModal from './components/ImportExportModal';
import { useSync } from './hooks/useSync';
import { checkReminders, requestNotificationPermission, sendNotification } from './utils/reminder';
import './App.css';

function AppContent() {
  const { allTasks, markAsRead, setTasks } = useTaskContext();
  const [toasts, setToasts] = useState([]);
  const [view, setView] = useState('list');
  const [editingTask, setEditingTask] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

  const {
    status,
    lastSynced,
    githubToken,
    githubRepo,
    login,
    logout,
    sync,
  } = useSync(allTasks, setTasks);

  useEffect(() => {
    requestNotificationPermission();
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

  const handleEditTask = useCallback((task) => {
    setEditingTask(task);
    setShowForm(true);
  }, []);

  const handleNewTask = useCallback(() => {
    setEditingTask(null);
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingTask(null);
  }, []);

  const handleSaveSettings = useCallback((token, repo) => {
    login(token, repo);
    setShowSettings(false);
  }, [login]);

  const handleImport = useCallback((tasks) => {
    setTasks(tasks);
  }, [setTasks]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>📝 Hermes TodoList</h1>
            <p className="subtitle">Manage your tasks efficiently</p>
          </div>
          <div className="header-actions">
            <SyncStatus
              status={status}
              lastSynced={lastSynced}
              onClick={() => setShowSettings(true)}
            />
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="toolbar-row">
          <div className="view-toggle">
            <button
              className={`view-btn ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
            >
              📋 列表
            </button>
            <button
              className={`view-btn ${view === 'kanban' ? 'active' : ''}`}
              onClick={() => setView('kanban')}
            >
              📊 看板
            </button>
          </div>
          <div className="toolbar-actions">
            <button className="toolbar-btn" onClick={() => setShowImportExport(true)}>
              📥 导入/导出
            </button>
            {githubToken && (
              <button className="toolbar-btn" onClick={sync}>
                🔄 同步
              </button>
            )}
          </div>
        </div>

        {view === 'list' && <FilterBar />}
        {view === 'list' ? (
          <TaskList onEdit={handleEditTask} onNew={handleNewTask} />
        ) : (
          <KanbanBoard onEditTask={handleEditTask} />
        )}
      </main>

      <footer className="app-footer">
        <p>Hermes TodoList • Built with React + Vite</p>
      </footer>

      {showForm && (
        <TaskForm editingTask={editingTask} onClose={handleCloseForm} />
      )}

      {showSettings && (
        <SettingsModal
          token={githubToken}
          repo={githubRepo}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showImportExport && (
        <ImportExportModal
          tasks={allTasks}
          onImport={handleImport}
          onClose={() => setShowImportExport(false)}
        />
      )}

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
