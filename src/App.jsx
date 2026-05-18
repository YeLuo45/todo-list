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
import MobileToolbar from './components/MobileToolbar';
import OfflineBanner from './components/OfflineBanner';
import { useSync } from './hooks/useSync';
import { useSyncWorker } from './hooks/useSyncWorker';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import ConflictModal from './components/ConflictModal';
import InsightsPanel from './components/InsightsPanel';
import AgentPanel from './components/AgentPanel';
import { checkReminders, requestNotificationPermission, sendNotification } from './utils/reminder';
import { getGistConfig, createBackupGist } from './utils/gistSync';
import { useAppStore } from './store/useAppStore';
import { migrateToOPFS, getStorageMode } from './utils/storage';
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
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const filterBarRef = useRef();
  const recognitionRef = useRef(null);

  // SharedWorker 跨标签页同步状态
  const [syncConnected, setSyncConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [gistOnline, setGistOnline] = useState(true);

  // 冲突解决状态
  const [showConflict, setShowConflict] = useState(false);
  const [conflictData, setConflictData] = useState({ local: null, remote: null });

  // 洞察面板折叠状态
  const [insightsCollapsed, setInsightsCollapsed] = useState(true);

  // OPFS 迁移进度状态
  const [opfsMigration, setOpfsMigration] = useState(null); // null | { current, total }

  const { theme, toggleTheme } = useTheme();

  const {
    status,
    lastSynced,
    githubToken,
    githubRepo,
    login,
    sync,
  } = useSync(allTasks, setTasks);

  // SharedWorker 跨标签页同步
  const { connected, lastHeartbeat: swHeartbeat, pendingCount: swPending, isGistOnline, notifyTaskChange } = useSyncWorker((changedTask) => {
    // 跨标签页任务变更：更新 tasks
    setTasks(prev => {
      // 删除操作
      if (changedTask._deleted) {
        return prev.filter(t => t.id !== changedTask.id);
      }
      const idx = prev.findIndex(t => t.id === changedTask.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = changedTask;
        return updated;
      }
      // 新建任务（ID 不存在则添加）
      return [changedTask, ...prev];
    });
  });

  // 同步 SharedWorker 状态到 React state
  useEffect(() => { setSyncConnected(connected); }, [connected]);
  useEffect(() => { setLastHeartbeat(swHeartbeat); }, [swHeartbeat]);
  useEffect(() => { setPendingCount(swPending); }, [swPending]);
  useEffect(() => { setGistOnline(typeof isGistOnline === 'boolean' ? isGistOnline : true); }, [isGistOnline]);

  // 监听 TaskContext 事件并广播到其他标签页
  useEffect(() => {
    const handleCreated = (e) => notifyTaskChange(e.detail);
    const handleUpdated = (e) => {
      const { id, updates } = e.detail;
      const task = allTasks.find(t => t.id === id);
      if (task) notifyTaskChange({ ...task, ...updates });
    };
    const handleDeleted = (e) => notifyTaskChange({ id: e.detail.id, _deleted: true });

    window.addEventListener('task-created', handleCreated);
    window.addEventListener('task-updated', handleUpdated);
    window.addEventListener('task-deleted', handleDeleted);

    return () => {
      window.removeEventListener('task-created', handleCreated);
      window.removeEventListener('task-updated', handleUpdated);
      window.removeEventListener('task-deleted', handleDeleted);
    };
  }, [notifyTaskChange, allTasks]);

  // OPFS 迁移（任务数 > 500 时触发）
  useEffect(() => {
    if (allTasks.length > 500 && getStorageMode() !== 'opfs') {
      migrateToOPFS({
        onProgress: (phase, percent, current, total) => {
          if (phase === 'migrating') {
            setOpfsMigration({ current, total });
          }
        }
      }).then((result) => {
        setOpfsMigration(null);
        if (result.success) {
          addToast(`OPFS 迁移完成 (${result.migrated || allTasks.length} 任务) ✓`);
        }
      }).catch(() => {
        setOpfsMigration(null);
      });
    }
  }, [allTasks.length]);

  const autoBackup = useAppStore((s) => s.autoBackup);
  const backupInterval = useAppStore((s) => s.backupInterval);
  const lastBackup = useAppStore((s) => s.lastBackup);
  const setLastBackup = useAppStore((s) => s.setLastBackup);

  useEffect(() => {
    requestNotificationPermission();
    checkReminders(allTasks, (task) => {
      sendNotification(task);
      markAsRead(task.id);
      addToast(`Task "${task.title}" is due!`);
    });

    // 自动备份检查
    if (autoBackup) {
      const config = getGistConfig();
      if (config?.pat && (!lastBackup || Date.now() - new Date(lastBackup).getTime() > backupInterval * 24 * 60 * 60 * 1000)) {
        createBackupGist(config.pat, allTasks)
          .then(() => { setLastBackup(new Date().toISOString()); })
          .catch(() => {});
      }
    }
  }, [autoBackup, backupInterval, lastBackup, setLastBackup, allTasks]);

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

  // Voice input using Web Speech API
  const handleVoiceInput = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      addToast('您的浏览器不支持语音输入');
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
      addToast('正在聆听...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      if (transcript.trim()) {
        // Create a new task with the voice input
        setEditingTask(null);
        // Pre-fill the form with voice text
        setShowForm(true);
        // Dispatch custom event to pre-fill form
        window.dispatchEvent(new CustomEvent('voice-input', { detail: transcript }));
        addToast(`语音输入: "${transcript}"`);
      }
    };

    recognition.onerror = (event) => {
      setIsRecording(false);
      if (event.error !== 'no-speech') {
        addToast('语音识别出错，请重试');
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
    } catch (e) {
      setIsRecording(false);
      addToast('无法启动语音识别');
    }
  }, [isRecording, addToast]);

  // Quick add handler
  const handleQuickAdd = useCallback(() => {
    handleNewTask();
  }, [handleNewTask]);

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
      <OfflineBanner />
      {isRecording && <div className="voice-recording">🎤 正在录音...</div>}

      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>📝 Hermes TodoList</h1>
            <p className="subtitle">Manage your tasks efficiently</p>
          </div>
          <div className="header-actions">
            <button className="mobile-sidebar-toggle" onClick={() => setSidebarMobileOpen(true)} title="项目">
              📁
            </button>
            <button className="theme-toggle" onClick={toggleTheme} title="切换主题">
              {theme === 'dark' ? '☀️ 亮色' : '🌙 暗色'}
            </button>
            <SyncStatus
              status={status}
              lastSynced={lastSynced}
              syncConnected={syncConnected}
              pendingCount={pendingCount}
              isGistOnline={gistOnline}
              onClick={() => setShowSettings(true)}
            />
            <button className="theme-toggle" onClick={() => setShowAgentPanel(v => !v)} title="Agent Panel">
              🤖 Agent
            </button>
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
            <ProjectSidebar
              isMobileOpen={sidebarMobileOpen}
              onMobileClose={() => setSidebarMobileOpen(false)}
            />
            <div className="task-list-container">
              <TaskList onEdit={handleEditTask} onNew={handleNewTask} />
            </div>
          </>
        ) : view === 'kanban' ? (
          <KanbanBoard onEditTask={handleEditTask} />
        ) : view === 'gantt' ? (
          <GanttChart onEditTask={handleEditTask} />
        ) : null}
      </main>

      {/* Mobile Toolbar */}
      <MobileToolbar
        onQuickAdd={handleQuickAdd}
        onVoiceInput={handleVoiceInput}
      />

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

      {showConflict && (
        <ConflictModal
          visible={showConflict}
          localData={{ tasks: allTasks, savedAt: lastSynced }}
          remoteData={conflictData.remote}
          onLocalWins={() => {
            setShowConflict(false);
            addToast('已保留本地版本');
          }}
          onRemoteWins={() => {
            if (conflictData.remote?.tasks) {
              setTasks(conflictData.remote.tasks);
            }
            setShowConflict(false);
            addToast('已保留远程版本');
          }}
          onMerge={() => {
            if (conflictData.remote?.tasks) {
              const merged = [...allTasks];
              conflictData.remote.tasks.forEach(remoteTask => {
                if (!merged.find(t => t.id === remoteTask.id)) {
                  merged.push(remoteTask);
                }
              });
              setTasks(merged);
            }
            setShowConflict(false);
            addToast('已合并两个版本');
          }}
        />
      )}

      {opfsMigration && (
        <div className="opfs-migration-toast">
          📦 OPFS 迁移中... {opfsMigration.current}/{opfsMigration.total}
        </div>
      )}

      <InsightsPanel
        tasks={allTasks}
        collapsed={insightsCollapsed}
        onToggle={() => setInsightsCollapsed(c => !c)}
      />

      {showAgentPanel && (
        <AgentPanel
          onTaskCreate={(task) => {
            // Add the task to the task list
            setTasks(prev => [task, ...prev]);
            window.dispatchEvent(new CustomEvent('task-created', { detail: task }));
          }}
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
