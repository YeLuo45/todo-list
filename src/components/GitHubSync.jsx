import { useState, useCallback } from 'react';
import githubMCP from '../mcp/githubMcp.js';
import './GitHubSync.css';

const STATUS_CONFIG = {
  disconnected: { icon: '⚪', label: '未连接', color: '#94a3b8' },
  connecting: { icon: '🔄', label: '连接中...', color: '#f59e0b' },
  connected: { icon: '✅', label: '已连接', color: '#22c55e' },
  error: { icon: '❌', label: '连接失败', color: '#ef4444' }
};

function GitHubSync({ onImportTask }) {
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = useCallback(async () => {
    if (!repo.trim()) {
      setError('请输入仓库名称 (owner/repo)');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus('connecting');

    try {
      await githubMCP.connect({ token: token || undefined });
      setStatus('connected');
      
      // Auto-fetch issues after connection
      await loadIssues();
    } catch (err) {
      setStatus('error');
      setError(`连接失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [repo, token]);

  const handleDisconnect = useCallback(() => {
    githubMCP.disconnect();
    setStatus('disconnected');
    setIssues([]);
  }, []);

  const loadIssues = useCallback(async () => {
    if (!repo.trim() || status !== 'connected') return;

    setLoading(true);
    setError(null);

    try {
      const result = await githubMCP.getIssues({ repo });
      setIssues(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(`获取 issues 失败: ${err.message}`);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [repo, status]);

  const handleImportIssue = useCallback((issue) => {
    if (!onImportTask) return;

    // Convert GitHub issue to task format
    const task = {
      title: issue.title || 'Imported from GitHub',
      description: issue.body || issue.description || '',
      priority: 'medium',
      status: 'pending',
      labels: issue.labels?.map(l => l.name || l) || [],
      source: 'github',
      sourceId: issue.id?.toString() || issue.number?.toString(),
      createdAt: issue.created_at || new Date().toISOString(),
      updatedAt: issue.updated_at || new Date().toISOString()
    };

    onImportTask(task);
  }, [onImportTask]);

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;

  return (
    <div className="github-sync">
      <div className="github-sync-header">
        <h3>🔗 GitHub MCP 同步</h3>
        <span 
          className="status-badge" 
          style={{ backgroundColor: statusConfig.color }}
        >
          {statusConfig.icon} {statusConfig.label}
        </span>
      </div>

      <div className="github-sync-form">
        <div className="form-group">
          <label htmlFor="gh-repo">仓库 (owner/repo)</label>
          <input
            id="gh-repo"
            type="text"
            placeholder="e.g., facebook/react"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            disabled={status === 'connected'}
          />
        </div>

        <div className="form-group">
          <label htmlFor="gh-token">GitHub Token (可选)</label>
          <input
            id="gh-token"
            type="password"
            placeholder="ghp_xxxxx"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={status === 'connected'}
          />
        </div>

        <div className="form-actions">
          {status !== 'connected' ? (
            <button 
              className="btn-connect"
              onClick={handleConnect}
              disabled={loading || !repo.trim()}
            >
              {loading ? '连接中...' : '连接'}
            </button>
          ) : (
            <>
              <button 
                className="btn-disconnect"
                onClick={handleDisconnect}
              >
                断开
              </button>
              <button 
                className="btn-refresh"
                onClick={loadIssues}
                disabled={loading}
              >
                {loading ? '加载中...' : '刷新 Issues'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="github-sync-error">
          {error}
        </div>
      )}

      {status === 'connected' && issues.length > 0 && (
        <div className="github-sync-issues">
          <h4>Issues ({issues.length})</h4>
          <div className="issues-list">
            {issues.map((issue) => (
              <div key={issue.id || issue.number} className="issue-item">
                <div className="issue-header">
                  <span className="issue-number">#{issue.number}</span>
                  <span className="issue-state" data-state={issue.state}>
                    {issue.state === 'open' ? '🟢 Open' : '🔴 Closed'}
                  </span>
                </div>
                <div className="issue-title">{issue.title}</div>
                {issue.labels && issue.labels.length > 0 && (
                  <div className="issue-labels">
                    {issue.labels.map((label, idx) => (
                      <span key={idx} className="issue-label">
                        {typeof label === 'string' ? label : label.name}
                      </span>
                    ))}
                  </div>
                )}
                <button 
                  className="btn-import"
                  onClick={() => handleImportIssue(issue)}
                >
                  导入为任务
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {status === 'connected' && issues.length === 0 && !loading && (
        <div className="github-sync-empty">
          暂无 issues 或仓库为空
        </div>
      )}
    </div>
  );
}

export default GitHubSync;
