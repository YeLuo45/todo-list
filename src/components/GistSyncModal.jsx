import { useState, useEffect } from 'react';
import { getGistConfig, saveGistConfig, fetchGist, pushGist, createGist } from '../utils/gistSync';
import './GistSyncModal.css';

export default function GistSyncModal({ onClose, onSync }) {
  const [config, setConfig] = useState(() => getGistConfig() || { gistId: '', pat: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gist-modal">
        <h3>☁️ GitHub Gist 同步设置</h3>
        <p className="gist-desc">
          将任务数据同步到 GitHub Gist，支持多设备间共享。<br />
          PAT 需要 <strong>gist</strong> 权限（勾选 "Create gists"）。
        </p>

        <div className="gist-field">
          <label>GitHub Personal Access Token (PAT)</label>
          <input
            type="password"
            value={config.pat}
            onChange={(e) => setConfig((c) => ({ ...c, pat: e.target.value }))}
            placeholder="ghp_xxxxxxxxxxxx"
          />
        </div>

        <div className="gist-field">
          <label>Gist ID <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>（留空则创建新 Gist）</span></label>
          <input
            type="text"
            value={config.gistId}
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
        </div>

        <button className="btn-close" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}
