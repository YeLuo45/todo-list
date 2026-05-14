import { useState, useEffect, useCallback, useRef } from 'react';
import { TaskProvider, useTaskContext } from './context/TaskContext';
import TaskList from './components/TaskList';
import FilterBar from './components/FilterBar';
import ReminderToast from './components/ReminderToast';
import KanbanBoard from './components/KanbanBoard';
import TaskForm from './components/TaskForm';
import SyncStatus from './components/SyncStatus';
import SettingsModal from './components/SettingsModal';
import ImportExportModal from './components/ImportExportModal';
import StatsDashboard from './components/StatsDashboard';
import GanttChart from './components/GanttChart';
import Dashboard from './components/Dashboard';
import GistSyncModal from './components/GistSyncModal';
import GoogleCalendarSyncModal from './components/GoogleCalendarSyncModal';
import ProjectSidebar from './components/ProjectSidebar';
import { useSync } from './hooks/useSync';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { checkReminders, requestNotificationPermission, sendNotification } from './utils/reminder';
import { getGistConfig, getLastBackupTime, setLastBackupTime, createBackupGist } from './utils/gistSync';
import './App.css';

function AppContent() {
  const { tasks: filteredTasks, allTasks, markAsRead, setTasks } = useTaskContext();
  const [toasts, setToasts] = useState([]);
  const [view, setView] = useState('dashboard');
  const [editingTask, setEditingTask] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showGistSync, setShowGistSync] = useState(false);
  const [showGoogleCalendarSync, setShowGoogleCalendarSync] = useState(false);
  const filterBarRef = useRef();

  const { theme, toggleTheme } = useTheme();

  const {
    status,
    lastSynced,
    githubToken,
    githubRepo,
    login,
    sync,
  } = useSync(allTasks, setTasks);

  useEffect(() => {
    requestNotificationPermission();
    checkReminders(allTasks, (task) => {
      sendNotification(task);
      markAsRead(task.id);
      addToast(`Task "${task.title}" is due!`);
    });

    // 自动备份检查
    if (localStorage.getItem('auto-backup') === 'true') {
      const config = getGistConfig();
      const interval = parseInt(localStorage.getItem('backup-interval') || '1');
      const lastBackup = getLastBackupTime();
      if (config?.pat && (!lastBackup || Date.now() - new Date(lastBackup).getTime() > interval * 24 * 60 * 60 * 1000)) {
        createBackupGist(config.pat, allTasks)
          .then(() => { setLastBackupTime(new Date().toISOString()); })
          .catch(() => {});
      }
    }
  }, []);

  // Listen for cross-component view switch events (e.g. from Dashboard quick actions)
  useEffect(() => {
    const handler = (e) => setView(e.detail);
    window.addEventListener('switch-view', handler);
    return () => window.removeEventListener('switch-view', handler);
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
    if (view !== 'list') setView('list');
  }, [view]);

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

  // 全局快捷键
  useKeyboardShortcuts({
    onFocusSearch: () => {
      if (view !== 'list') setView('list');
      setTimeout(() => filterBarRef.current?.focus(), 50);
    },
    onNewTask: handleNewTask,
    onViewList: () => setView('list'),
    onViewKanban: () => setView('kanban'),
    onOpenStats: () => setShowStats(true),
    onCloseModal: () => {
      if (showForm) setShowForm(false);
      else if (showSettings) setShowSettings(false);
      else if (showImportExport) setShowImportExport(false);
      else if (showStats) setShowStats(false);
    },
  });

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>📝 Hermes TodoList</h1>
            <p className="subtitle">Manage your tasks efficiently</p>
          </div>
          <div className="header-actions">
            <button className="theme-toggle" onClick={toggleTheme} title="切换主题">
              {theme === 'dark' ? '☀️ 亮色' : '🌙 暗色'}
            </button>
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
              className={`view-btn ${view === 'dashboard' ? 'active' : ''}`}
              onClick={() => setView('dashboard')}
            >
              🏠 首页
            </button>
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
            <button
              className={`view-btn ${view === 'gantt' ? 'active' : ''}`}
              onClick={() => setView('gantt')}
            >
              📈 甘特图
            </button>
          </div>
          <div className="toolbar-actions">
            <button className="toolbar-btn" onClick={() => setShowStats(true)}>
              📊 统计 (3)
            </button>
            <button className="toolbar-btn" onClick={() => setShowImportExport(true)}>
              📥 导入/导出
            </button>
            <button className="toolbar-btn" onClick={() => setShowGistSync(true)}>
              ☁️ Gist同步
            </button>
            <button className="toolbar-btn" onClick={() => setShowGoogleCalendarSync(true)}>
              📅 日历同步
            </button>
            <button className="toolbar-btn" onClick={handleNewTask}>
              ➕ 新建 (Ctrl+N)
            </button>
            {githubToken && (
              <button className="toolbar-btn" onClick={sync}>
                🔄 同步
              </button>
            )}
          </div>
        </div>

        {view === 'dashboard' && (
          <Dashboard
            onNewTask={handleNewTask}
            onEditTask={handleEditTask}
          />
        )}
        {view === 'list' && (
          <FilterBar
            ref={filterBarRef}
            resultCount={filteredTasks.length}
            totalCount={allTasks.length}
          />
        )}
        {view === 'list' ? (
          <>
            <ProjectSidebar />
            <TaskList onEdit={handleEditTask} onNew={handleNewTask} />
          </>
        ) : view === 'kanban' ? (
          <KanbanBoard onEditTask={handleEditTask} />
        ) : view === 'gantt' ? (
          <GanttChart onEditTask={handleEditTask} />
        ) : null}
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

      {showStats && (
        <StatsDashboard tasks={allTasks} onClose={() => setShowStats(false)} />
      )}

      {showGistSync && (
        <GistSyncModal
          tasks={allTasks}
          onClose={() => setShowGistSync(false)}
        />
      )}

      {showGoogleCalendarSync && (
        <GoogleCalendarSyncModal
          tasks={allTasks}
          onClose={() => setShowGoogleCalendarSync(false)}
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
