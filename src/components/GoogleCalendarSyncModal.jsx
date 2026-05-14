import { useState } from 'react';
import { exportToGoogleCalendar, exportAllToGoogleCalendar, getGoogleCalendarApiKey, setGoogleCalendarApiKey } from '../utils/googleCalendarSync';
import './GoogleCalendarSyncModal.css';

export default function GoogleCalendarSyncModal({ tasks, onClose }) {
  const [apiKey, setApiKey] = useState(getGoogleCalendarApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);

  const tasksWithDeadline = tasks.filter(t => t.dueDate && t.status !== 'done');

  const handleSaveApiKey = () => {
    setGoogleCalendarApiKey(apiKey.trim());
  };

  const handleSelectAll = () => {
    if (selectedTasks.length === tasksWithDeadline.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(tasksWithDeadline.map(t => t.id));
    }
  };

  const handleToggleTask = (taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleExportSelected = async () => {
    if (!apiKey.trim()) {
      setResults({ error: '请先配置 Google Calendar API Key' });
      return;
    }

    setSyncing(true);
    setResults(null);

    try {
      const tasksToExport = tasksWithDeadline.filter(t => selectedTasks.includes(t.id));
      let result;
      
      if (tasksToExport.length === 0) {
        result = { error: '请选择要导出的任务' };
      } else if (tasksToExport.length === 1) {
        await exportToGoogleCalendar(tasksToExport[0]);
        result = { success: 1, failed: 0 };
      } else {
        result = await exportAllToGoogleCalendar(tasksToExport);
      }
      
      setResults(result);
    } catch (error) {
      setResults({ error: error.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleExportAll = async () => {
    if (!apiKey.trim()) {
      setResults({ error: '请先配置 Google Calendar API Key' });
      return;
    }

    setSyncing(true);
    setResults(null);

    try {
      const result = await exportAllToGoogleCalendar(tasksWithDeadline);
      setResults(result);
    } catch (error) {
      setResults({ error: error.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content gcal-sync-modal">
        <h3>📅 Google Calendar 同步</h3>

        <div className="gcal-section">
          <h4>🔑 API Key 配置</h4>
          <p className="gcal-desc">
            使用 Google Calendar API v3，需要配置 API Key。
            <br />
            <small>
              获取方式：Google Cloud Console → APIs &amp; Services → Credentials → Create API Key
            </small>
          </p>
          <div className="gcal-api-key-row">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              onBlur={handleSaveApiKey}
            />
            <button
              type="button"
              className="btn-toggle"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div className="gcal-divider" />

        <div className="gcal-section">
          <div className="gcal-header-row">
            <h4>📋 选择任务导出</h4>
            <button
              className="gcal-select-all"
              onClick={handleSelectAll}
              disabled={tasksWithDeadline.length === 0}
            >
              {selectedTasks.length === tasksWithDeadline.length ? '取消全选' : '全选'}
            </button>
          </div>
          <p className="gcal-desc">
            共 {tasksWithDeadline.length} 个有截止日期的任务
          </p>

          {tasksWithDeadline.length > 0 ? (
            <div className="gcal-task-list">
              {tasksWithDeadline.map(task => (
                <label key={task.id} className="gcal-task-item">
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(task.id)}
                    onChange={() => handleToggleTask(task.id)}
                  />
                  <span className={`gcal-priority ${task.priority}`}>{task.priority}</span>
                  <span className="gcal-task-title">{task.title}</span>
                  <span className="gcal-task-date">
                    {new Date(task.dueDate).toLocaleDateString('zh-CN')}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="gcal-empty">没有带截止日期的任务</p>
          )}
        </div>

        {results && (
          <div className={`gcal-results ${results.error ? 'error' : 'success'}`}>
            {results.error ? (
              <p>{results.error}</p>
            ) : (
              <p>
                ✅ 成功导出 {results.success} 个任务
                {results.failed > 0 && `，失败 ${results.failed} 个`}
              </p>
            )}
            {results.errors && results.errors.length > 0 && (
              <ul className="gcal-error-list">
                {results.errors.slice(0, 3).map((err, i) => (
                  <li key={i}>{err.taskTitle}: {err.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="gcal-actions">
          <button className="btn-cancel" onClick={onClose}>关闭</button>
          <button
            className="ie-btn"
            onClick={handleExportSelected}
            disabled={syncing || selectedTasks.length === 0}
          >
            {syncing ? '导出中...' : `导出选中 (${selectedTasks.length})`}
          </button>
          <button
            className="ie-btn primary"
            onClick={handleExportAll}
            disabled={syncing || tasksWithDeadline.length === 0}
          >
            {syncing ? '导出中...' : '导出全部'}
          </button>
        </div>
      </div>
    </div>
  );
}
