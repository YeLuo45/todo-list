import { useState, useEffect } from 'react';
import {
  getGistConfig, saveGistConfig, createGist, pushGist, fetchGist,
  createBackupGist, fetchBackupList, fetchBackupContent,
  getBackupHistory, saveBackupHistory, getLastBackupTime, setLastBackupTime,
} from '../utils/gistSync';
import { useAppStore } from '../store/useAppStore';
import './GistSyncModal.css';

export default function GistSyncModal({ onClose, onSync, tasks }) {
  const projects = useAppStore((s) => s.projects);
  const tagColors = useAppStore((s) => s.tagColors);
  const hermesTagColors = useAppStore((s) => s.hermesTagColors);
  const tagGroups = useAppStore((s) => s.tagGroups);
  
  const [tab, setTab] = useState('sync'); // 'sync' | 'backup'
  const [config, setConfig] = useState(() => getGistConfig() || { gistId: '', pat: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Backup state
  const [backupHistory, setBackupHistory] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');
  const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem('auto-backup') === 'true');
  const [backupInterval, setBackupInterval] = useState(() => parseInt(localStorage.getItem('backup-interval') || '1'));
  const [lastBackupTime, setLastBackupTimeState] = useState(getLastBackupTime());
  const [restorePreview, setRestorePreview] = useState(null); // { tasks, info }
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (tab === 'backup') loadBackupHistory();
  }, [tab]);

  const loadBackupHistory = async () => {
    if (!config.pat) return;
    setBackupLoading(true);
    setBackupError('');
    try {
      const list = await fetchBackupList(config.pat, 7);
      setBackupHistory(list);
    } catch (e) {
      setBackupError(e.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSave = () => {
    saveGistConfig(config);
    setSuccess('配置已保存');
    setError('');
  };

  const handleCreateGist = async () => {
    if (!config.pat) { setError('请先输入 GitHub PAT'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await createGist(config.pat, []);
      const newConfig = { ...config, gistId: result.id };
      saveGistConfig(newConfig);
      setConfig(newConfig);
      setSuccess(`新 Gist 创建成功！ID: ${result.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePullFromRemote = async () => {
    if (!config.pat || !config.gistId) { setError('请填写 PAT 和 Gist ID'); return; }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const remoteData = await fetchGist(config.gistId, config.pat);
      // remoteData is v2 format: { tasks, projects, tagColors, tagGroups, hermesTagColors, version, timestamp }
      // Persist each part to localStorage
      if (remoteData.tasks) {
        localStorage.setItem('hermes_todos_v2', JSON.stringify(remoteData.tasks));
      }
      if (remoteData.projects) {
        localStorage.setItem('hermes_projects_v2', JSON.stringify(remoteData.projects));
      }
      if (remoteData.tagColors) {
        localStorage.setItem('hermes_tag_colors_v2', JSON.stringify(remoteData.tagColors));
      }
      if (remoteData.tagGroups) {
        localStorage.setItem('hermes_tag_groups_v2', JSON.stringify(remoteData.tagGroups));
      }
      if (remoteData.hermesTagColors) {
        localStorage.setItem('hermes_hermes_tag_colors', JSON.stringify(remoteData.hermesTagColors));
      }
      setSuccess(`✅ 已从远程拉取！任务: ${remoteData.tasks?.length || 0}, 项目: ${remoteData.projects?.length || 0}。页面将刷新...`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(`拉取失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSync = async () => {
    if (!config.pat || !config.gistId) { setError('请填写 PAT 和 Gist ID'); return; }
    setLoading(true);
    setError('');
    try {
      await pushGist(config.gistId, config.pat, []);
      setSuccess('同步测试成功！');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualBackup = async () => {
    if (!config.pat) { setBackupError('请先配置 GitHub PAT'); return; }
    setBackupLoading(true);
    setBackupError('');
    setBackupSuccess('');
    try {
      const result = await createBackupGist(config.pat, tasks || []);
      const now = new Date().toISOString();
      const newHistory = [{ ...result }, ...backupHistory].slice(0, 7);
      setBackupHistory(newHistory);
      saveBackupHistory(newHistory);
      setLastBackupTime(now);
      setLastBackupTimeState(now);
      setBackupSuccess(`备份成功！共 ${tasks?.length || 0} 个任务`);
    } catch (e) {
      setBackupError(e.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleToggleAutoBackup = (val) => {
    setAutoBackup(val);
    localStorage.setItem('auto-backup', val ? 'true' : 'false');
  };

  const handleBackupIntervalChange = (val) => {
    const n = Math.max(1, parseInt(val) || 1);
    setBackupInterval(n);
    localStorage.setItem('backup-interval', String(n));
  };

  const handleRestoreClick = async (backup) => {
    if (!config.pat) { setBackupError('请先配置 GitHub PAT'); return; }
    setBackupLoading(true);
    setBackupError('');
    try {
      const taskList = await fetchBackupContent(backup.gistId, config.pat);
      const info = getTaskSummary(taskList);
      setRestorePreview({ tasks: taskList, info, gistId: backup.gistId, description: backup.description });
    } catch (e) {
      setBackupError(`获取备份失败: ${e.message}`);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleConfirmRestore = () => {
    if (!restorePreview) return;
    setRestoring(true);
    try {
      localStorage.setItem('hermes_todos_v2', JSON.stringify(restorePreview.tasks));
      setBackupSuccess('恢复成功！页面将刷新...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      setBackupError(`恢复失败: ${e.message}`);
      setRestoring(false);
    }
  };

  const handleCancelRestore = () => {
    setRestorePreview(null);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gist-modal">
        <h3>☁️ Gist 同步与备份</h3>

        <div className="gist-tabs">
          <button className={`gist-tab ${tab === 'sync' ? 'active' : ''}`} onClick={() => setTab('sync')}>
            🔄 同步设置
          </button>
          <button className={`gist-tab ${tab === 'backup' ? 'active' : ''}`} onClick={() => setTab('backup')}>
            💾 备份与恢复
          </button>
        </div>

        {tab === 'sync' && (
          <>
            <p className="gist-desc">
              将任务数据同步到 GitHub Gist，支持多设备间共享。<br />
              PAT 需要 <strong>gist</strong> 权限（勾选 "Create gists"）。
            </p>
            <div className="gist-field">
              <label>GitHub Personal Access Token (PAT)</label>
              <input
                type="password" value={config.pat}
                onChange={(e) => setConfig((c) => ({ ...c, pat: e.target.value }))}
                placeholder="***"
              />
            </div>
            <div className="gist-field">
              <label>Gist ID <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>（留空则创建新 Gist）</span></label>
              <input
                type="text" value={config.gistId}
                onChange={(e) => setConfig((c) => ({ ...c, gistId: e.target.value }))}
                placeholder="8a9b2c3d4e5f6..."
              />
            </div>
            {error && <div className="gist-error">❌ {error}</div>}
            {success && <div className="gist-success">✅ {success}</div>}
            <div className="gist-actions">
              <button className="btn-gist" onClick={handleSave} disabled={loading}>💾 保存配置</button>
              <button className="btn-gist secondary" onClick={handleCreateGist} disabled={loading}>✨ 创建新 Gist</button>
              <button className="btn-gist secondary" onClick={handleTestSync} disabled={loading}>🔄 测试同步</button>
              <button className="btn-gist secondary" onClick={handlePullFromRemote} disabled={loading}>⬇️ 从远程同步到本地</button>
            </div>
          </>
        )}

        {tab === 'backup' && (
          <>
            {restorePreview ? (
              <RestorePreview
                preview={restorePreview}
                onConfirm={handleConfirmRestore}
                onCancel={handleCancelRestore}
                restoring={restoring}
              />
            ) : (
              <>
                <div className="backup-auto-section">
                  <div className="backup-auto-row">
                    <label>🕐 自动备份</label>
                    <label className="toggle">
                      <input type="checkbox" checked={autoBackup} onChange={(e) => handleToggleAutoBackup(e.target.checked)} />
                      <span>{autoBackup ? '已开启' : '已关闭'}</span>
                    </label>
                  </div>
                  {autoBackup && (
                    <div className="backup-auto-row">
                      <label>📅 备份间隔</label>
                      <select value={backupInterval} onChange={(e) => handleBackupIntervalChange(e.target.value)}>
                        <option value="1">每天</option>
                        <option value="3">每3天</option>
                        <option value="7">每周</option>
                      </select>
                    </div>
                  )}
                  {lastBackupTime && (
                    <div className="backup-last-time">
                      上次备份：{new Date(lastBackupTime).toLocaleString('zh-CN')}
                    </div>
                  )}
                </div>

                <div className="backup-actions-bar">
                  <button className="btn-gist" onClick={handleManualBackup} disabled={backupLoading}>
                    {backupLoading ? '备份中...' : '💾 立即备份'}
                  </button>
                  <button className="btn-gist secondary" onClick={loadBackupHistory} disabled={backupLoading}>
                    🔄 刷新历史
                  </button>
                </div>

                {backupError && <div className="gist-error">❌ {backupError}</div>}
                {backupSuccess && <div className="gist-success">✅ {backupSuccess}</div>}

                <div className="backup-history">
                  <h4>📋 备份历史（最近7份）</h4>
                  {backupHistory.length === 0 ? (
                    <p className="backup-empty">暂无备份记录，点击"立即备份"创建第一份</p>
                  ) : (
                    <div className="backup-list">
                      {backupHistory.map((b, i) => (
                        <div key={b.gistId} className="backup-item">
                          <div className="backup-item-info">
                            <span className="backup-item-desc">{b.description || `备份 #${i + 1}`}</span>
                            <span className="backup-item-time">{new Date(b.timestamp).toLocaleString('zh-CN')}</span>
                          </div>
                          <button
                            className="btn-gist secondary"
                            style={{ fontSize: 12, padding: '3px 10px' }}
                            onClick={() => handleRestoreClick(b)}
                            disabled={backupLoading}
                          >
                            🔄 恢复
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <button className="btn-close" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

function getTaskSummary(taskList) {
  if (!taskList || taskList.length === 0) return { count: 0 };
  const done = taskList.filter((t) => t.status === 'done').length;
  const dates = taskList.map((t) => t.dueDate).filter(Boolean).sort();
  const earliest = dates[0] || null;
  const latest = dates[dates.length - 1] || null;
  return { count: taskList.length, done, earliest, latest };
}

function RestorePreview({ preview, onConfirm, onCancel, restoring }) {
  const { tasks, info, description } = preview;
  return (
    <div className="restore-preview">
      <h4>🔄 恢复预览</h4>
      <p className="restore-desc">{description}</p>
      <div className="restore-stats">
        <div className="restore-stat"><span>总任务</span><strong>{info.count}</strong></div>
        <div className="restore-stat"><span>已完成</span><strong>{info.done}</strong></div>
        {info.earliest && <div className="restore-stat"><span>最早到期</span><strong>{info.earliest}</strong></div>}
        {info.latest && <div className="restore-stat"><span>最晚到期</span><strong>{info.latest}</strong></div>}
      </div>
      <p className="restore-warning">⚠️ 此操作将替换当前所有任务，是否继续？</p>
      <div className="restore-actions">
        <button className="btn-gist" onClick={onConfirm} disabled={restoring}>
          {restoring ? '恢复中...' : '✅ 确认恢复'}
        </button>
        <button className="btn-gist secondary" onClick={onCancel} disabled={restoring}>取消</button>
      </div>
    </div>
  );
}
