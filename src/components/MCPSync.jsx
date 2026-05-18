import { useState, useCallback, useEffect } from 'react';
import githubMCP from '../mcp/githubMcp.js';
import jiraMCP from '../mcp/jiraMcp.js';
import figmaMCP from '../mcp/figmaMcp.js';
import { mapToTask } from '../mcp/taskMapper.js';
import { mcpOrchestrator } from '../mcp/orchestrator.js';
import { initWorkflows } from '../mcp/workflows.js';
import './MCPSync.css';

// Initialize workflows on module load
initWorkflows();

const STATUS_CONFIG = {
  disconnected: { icon: '⚪', label: '未连接', color: '#94a3b8' },
  connecting: { icon: '🔄', label: '连接中...', color: '#f59e0b' },
  connected: { icon: '✅', label: '已连接', color: '#22c55e' },
  error: { icon: '❌', label: '连接失败', color: '#ef4444' }
};

const TABS = ['github', 'jira', 'figma', 'orchestration'];
const TAB_LABELS = { github: 'GitHub', jira: 'Jira', figma: 'Figma', orchestration: '编排日志' };

// Available tool chains for orchestration
const TOOL_CHAINS = [
  { id: 'github-issue-to-task', label: 'GitHub Issue → Task' },
  { id: 'jira-issue-to-task', label: 'Jira Issue → Task' },
  { id: 'github-issue-to-jira', label: 'GitHub Issue → Jira' }
];

function MCPSync({ onImportTask }) {
  const [activeTab, setActiveTab] = useState('github');
  
  // GitHub state
  const [ghRepo, setGhRepo] = useState('');
  const [ghToken, setGhToken] = useState('');
  const [ghStatus, setGhStatus] = useState('disconnected');
  const [ghIssues, setGhIssues] = useState([]);
  
  // Jira state
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraProject, setJiraProject] = useState('');
  const [jiraStatus, setJiraStatus] = useState('disconnected');
  const [jiraIssues, setJiraIssues] = useState([]);
  
  // Figma state
  const [figmaToken, setFigmaToken] = useState('');
  const [figmaFileKey, setFigmaFileKey] = useState('');
  const [figmaStatus, setFigmaStatus] = useState('disconnected');
  const [figmaFile, setFigmaFile] = useState(null);
  const [figmaComments, setFigmaComments] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Batch import state
  const [autoImportEnabled, setAutoImportEnabled] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [importProgress, setImportProgress] = useState(0);

  // Orchestration state
  const [orchestrationLog, setOrchestrationLog] = useState([]);
  const [selectedChain, setSelectedChain] = useState('');
  const [orchestrationInput, setOrchestrationInput] = useState('');
  const [orchestrationLoading, setOrchestrationLoading] = useState(false);

  // Refresh orchestration log
  const refreshOrchestrationLog = useCallback(() => {
    setOrchestrationLog([...mcpOrchestrator.getExecutionLog()]);
  }, []);

  // Execute selected chain
  const handleExecuteChain = useCallback(async () => {
    if (!selectedChain) {
      setError('请选择一个工具链');
      return;
    }
    setOrchestrationLoading(true);
    setError(null);
    try {
      let input;
      try {
        input = orchestrationInput ? JSON.parse(orchestrationInput) : {};
      } catch {
        input = { input: orchestrationInput };
      }
      await mcpOrchestrator.executeChain([selectedChain], input);
      refreshOrchestrationLog();
    } catch (err) {
      setError(`编排执行失败: ${err.message}`);
    } finally {
      setOrchestrationLoading(false);
    }
  }, [selectedChain, orchestrationInput, refreshOrchestrationLog]);

  // Subscribe to orchestration events
  useEffect(() => {
    const unsubscribe = mcpOrchestrator.subscribe('task:create', (data) => {
      refreshOrchestrationLog();
    });
    return unsubscribe;
  }, [refreshOrchestrationLog]);

  // Unified import function
  const _importAsTask = useCallback((item, source) => {
    if (!onImportTask) return;

    let task = {
      priority: 'medium',
      status: 'pending',
      source,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    switch (source) {
      case 'github':
        task = {
          ...task,
          title: item.title || 'Imported from GitHub',
          description: item.body || item.description || '',
          labels: item.labels?.map(l => l.name || l) || [],
          sourceId: item.id?.toString() || item.number?.toString(),
          createdAt: item.created_at || new Date().toISOString(),
          updatedAt: item.updated_at || new Date().toISOString()
        };
        break;
      case 'jira':
        task = {
          ...task,
          title: item.summary || item.title || 'Imported from Jira',
          description: item.description || '',
          priority: item.priority || 'medium',
          sourceId: item.id || item.key,
          labels: item.labels || [],
          status: item.status === 'Done' || item.status === 'Closed' ? 'completed' : 'pending'
        };
        break;
      case 'figma':
        task = {
          ...task,
          title: item.title || item.name || 'Imported from Figma',
          description: item.description || item.comment || '',
          sourceId: item.id?.toString(),
          labels: ['figma']
        };
        break;
    }

    onImportTask(task);
  }, [onImportTask]);

  // Map MCP item to task using taskMapper and optionally create immediately
  const _handleImport = useCallback((item, source, toolType = 'issue') => {
    if (autoImportEnabled) {
      const mappedTask = mapToTask(source, toolType, item);
      if (mappedTask && onImportTask) {
        onImportTask(mappedTask);
      }
    } else {
      // Just select the item for batch import
      setSelectedItems(prev => {
        const next = new Set(prev);
        const key = `${source}-${item.id || item.key || item.number}`;
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }
  }, [autoImportEnabled, onImportTask]);

  // Import all selected items
  const _importSelected = useCallback(async () => {
    const items = Array.from(selectedItems);
    let completed = 0;
    setImportProgress(0);
    
    for (const itemKey of items) {
      const [source, id] = itemKey.split('-');
      let item, toolType;
      
      if (source === 'github') {
        const issue = ghIssues.find(i => i.id?.toString() === id || i.number?.toString() === id);
        item = issue;
        toolType = 'issue';
      } else if (source === 'jira') {
        const issue = jiraIssues.find(i => i.id === id || i.key === id);
        item = issue;
        toolType = 'issue';
      } else if (source === 'figma') {
        const file = figmaFile;
        item = file;
        toolType = 'file';
      }
      
      if (item) {
        const mappedTask = mapToTask(source, toolType, item);
        if (mappedTask && onImportTask) {
          onImportTask(mappedTask);
        }
      }
      
      completed++;
      setImportProgress(Math.round((completed / items.length) * 100));
    }
    
    setSelectedItems(new Set());
    setImportProgress(0);
  }, [selectedItems, ghIssues, jiraIssues, figmaFile, onImportTask]);

  // Open external URL in new tab
  const _openExternalUrl = useCallback((url) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // GitHub handlers
  const handleGithubConnect = useCallback(async () => {
    if (!ghRepo.trim()) {
      setError('请输入仓库名称 (owner/repo)');
      return;
    }

    setLoading(true);
    setError(null);
    setGhStatus('connecting');

    try {
      await githubMCP.connect({ token: ghToken || undefined });
      setGhStatus('connected');
      await loadGithubIssues();
    } catch (err) {
      setGhStatus('error');
      setError(`GitHub 连接失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [ghRepo, ghToken]);

  const handleGithubDisconnect = useCallback(() => {
    githubMCP.disconnect();
    setGhStatus('disconnected');
    setGhIssues([]);
  }, []);

  const loadGithubIssues = useCallback(async () => {
    if (!ghRepo.trim() || ghStatus !== 'connected') return;

    setLoading(true);
    setError(null);

    try {
      const result = await githubMCP.getIssues({ repo: ghRepo });
      setGhIssues(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(`获取 GitHub Issues 失败: ${err.message}`);
      setGhIssues([]);
    } finally {
      setLoading(false);
    }
  }, [ghRepo, ghStatus]);

  // Jira handlers
  const handleJiraConnect = useCallback(async () => {
    if (!jiraUrl.trim() || !jiraEmail.trim() || !jiraToken.trim()) {
      setError('请输入 Jira URL、邮箱和 Token');
      return;
    }

    setLoading(true);
    setError(null);
    setJiraStatus('connecting');

    try {
      await jiraMCP.connect({ url: jiraUrl, email: jiraEmail, token: jiraToken });
      setJiraStatus('connected');
      if (jiraProject.trim()) {
        await loadJiraIssues();
      }
    } catch (err) {
      setJiraStatus('error');
      setError(`Jira 连接失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [jiraUrl, jiraEmail, jiraToken]);

  const handleJiraDisconnect = useCallback(() => {
    jiraMCP.disconnect();
    setJiraStatus('disconnected');
    setJiraIssues([]);
  }, []);

  const loadJiraIssues = useCallback(async () => {
    if (!jiraProject.trim() || jiraStatus !== 'connected') return;

    setLoading(true);
    setError(null);

    try {
      const result = await jiraMCP.getIssues(jiraProject);
      setJiraIssues(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(`获取 Jira Issues 失败: ${err.message}`);
      setJiraIssues([]);
    } finally {
      setLoading(false);
    }
  }, [jiraProject, jiraStatus]);

  // Figma handlers
  const handleFigmaConnect = useCallback(async () => {
    if (!figmaToken.trim()) {
      setError('请输入 Figma Access Token');
      return;
    }

    setLoading(true);
    setError(null);
    setFigmaStatus('connecting');

    try {
      await figmaMCP.connect({ token: figmaToken });
      setFigmaStatus('connected');
    } catch (err) {
      setFigmaStatus('error');
      setError(`Figma 连接失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [figmaToken]);

  const handleFigmaDisconnect = useCallback(() => {
    figmaMCP.disconnect();
    setFigmaStatus('disconnected');
    setFigmaFile(null);
    setFigmaComments([]);
  }, []);

  const loadFigmaFile = useCallback(async () => {
    if (!figmaFileKey.trim() || figmaStatus !== 'connected') return;

    setLoading(true);
    setError(null);

    try {
      const result = await figmaMCP.getFile(figmaFileKey);
      if (typeof result === 'object' && result !== null) {
        setFigmaFile(result);
      } else {
        setFigmaFile({ name: figmaFileKey, data: result });
      }
    } catch (err) {
      setError(`获取 Figma 文件失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [figmaFileKey, figmaStatus]);

  const loadFigmaComments = useCallback(async () => {
    if (!figmaFileKey.trim() || figmaStatus !== 'connected') return;

    setLoading(true);
    setError(null);

    try {
      const result = await figmaMCP.getComments(figmaFileKey);
      setFigmaComments(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(`获取 Figma 评论失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [figmaFileKey, figmaStatus]);

  const handleImportFigmaItem = useCallback((item) => {
    _importAsTask(item, 'figma');
  }, [_importAsTask]);

  const ghStatusConfig = STATUS_CONFIG[ghStatus] || STATUS_CONFIG.disconnected;
  const jiraStatusConfig = STATUS_CONFIG[jiraStatus] || STATUS_CONFIG.disconnected;
  const figmaStatusConfig = STATUS_CONFIG[figmaStatus] || STATUS_CONFIG.disconnected;

  return (
    <div className="mcp-sync">
      <div className="mcp-sync-header">
        <h3>🔗 MCP 同步</h3>
        <div className="mcp-sync-controls">
          <label className="auto-import-toggle">
            <input
              type="checkbox"
              checked={autoImportEnabled}
              onChange={(e) => setAutoImportEnabled(e.target.checked)}
            />
            <span>自动导入</span>
          </label>
          {selectedItems.size > 0 && (
            <>
              <button className="btn-import-all" onClick={_importSelected}>
                导入已选 ({selectedItems.size})
              </button>
              {importProgress > 0 && (
                <div className="import-progress">
                  <div className="progress-bar" style={{ width: `${importProgress}%` }} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mcp-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`mcp-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mcp-sync-error">
          {error}
        </div>
      )}

      {/* GitHub Tab */}
      {activeTab === 'github' && (
        <div className="mcp-tab-content">
          <div className="mcp-sync-form">
            <div className="form-row">
              <span className="status-badge" style={{ backgroundColor: ghStatusConfig.color }}>
                {ghStatusConfig.icon} {ghStatusConfig.label}
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="gh-repo">仓库 (owner/repo)</label>
              <input
                id="gh-repo"
                type="text"
                placeholder="e.g., facebook/react"
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                disabled={ghStatus === 'connected'}
              />
            </div>

            <div className="form-group">
              <label htmlFor="gh-token">GitHub Token (可选)</label>
              <input
                id="gh-token"
                type="password"
                placeholder="ghp_xxxxx"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                disabled={ghStatus === 'connected'}
              />
            </div>

            <div className="form-actions">
              {ghStatus !== 'connected' ? (
                <button 
                  className="btn-connect"
                  onClick={handleGithubConnect}
                  disabled={loading || !ghRepo.trim()}
                >
                  {loading ? '连接中...' : '连接'}
                </button>
              ) : (
                <>
                  <button 
                    className="btn-disconnect"
                    onClick={handleGithubDisconnect}
                  >
                    断开
                  </button>
                  <button 
                    className="btn-refresh"
                    onClick={loadGithubIssues}
                    disabled={loading}
                  >
                    {loading ? '加载中...' : '刷新 Issues'}
                  </button>
                </>
              )}
            </div>
          </div>

          {ghStatus === 'connected' && ghIssues.length > 0 && (
            <div className="mcp-data-list">
              <h4>Issues ({ghIssues.length})</h4>
              <div className="data-items">
                {ghIssues.map((issue) => {
                  const itemKey = `github-${issue.id || issue.number}`;
                  const isSelected = selectedItems.has(itemKey);
                  return (
                    <div key={issue.id || issue.number} className={`data-item ${isSelected ? 'selected' : ''}`}>
                      <div className="item-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => _handleImport(issue, 'github', 'issue')}
                        />
                      </div>
                      <div className="item-content">
                        <div className="item-header">
                          <span className="item-number">#{issue.number}</span>
                          <span className="item-state" data-state={issue.state}>
                            {issue.state === 'open' ? '🟢 Open' : '🔴 Closed'}
                          </span>
                        </div>
                        <div className="item-title">{issue.title}</div>
                        {issue.labels && issue.labels.length > 0 && (
                          <div className="item-labels">
                            {issue.labels.map((label, idx) => (
                              <span key={idx} className="item-label">
                                {typeof label === 'string' ? label : label.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="item-actions">
                          {issue.html_url && (
                            <button
                              className="btn-external"
                              onClick={() => _openExternalUrl(issue.html_url)}
                              title="打开外部链接"
                            >
                              🔗
                            </button>
                          )}
                          <button 
                            className="btn-import"
                            onClick={() => autoImportEnabled ? _handleImport(issue, 'github', 'issue') : _importAsTask(issue, 'github')}
                          >
                            {autoImportEnabled ? '✓ 自动导入' : '导入为任务'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {ghStatus === 'connected' && ghIssues.length === 0 && !loading && (
            <div className="mcp-empty">
              暂无 issues 或仓库为空
            </div>
          )}
        </div>
      )}

      {/* Jira Tab */}
      {activeTab === 'jira' && (
        <div className="mcp-tab-content">
          <div className="mcp-sync-form">
            <div className="form-row">
              <span className="status-badge" style={{ backgroundColor: jiraStatusConfig.color }}>
                {jiraStatusConfig.icon} {jiraStatusConfig.label}
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="jira-url">Jira URL</label>
              <input
                id="jira-url"
                type="text"
                placeholder="e.g., https://yoursite.atlassian.net"
                value={jiraUrl}
                onChange={(e) => setJiraUrl(e.target.value)}
                disabled={jiraStatus === 'connected'}
              />
            </div>

            <div className="form-group">
              <label htmlFor="jira-email">邮箱</label>
              <input
                id="jira-email"
                type="email"
                placeholder="your@email.com"
                value={jiraEmail}
                onChange={(e) => setJiraEmail(e.target.value)}
                disabled={jiraStatus === 'connected'}
              />
            </div>

            <div className="form-group">
              <label htmlFor="jira-token">API Token</label>
              <input
                id="jira-token"
                type="password"
                placeholder="xxxxxx"
                value={jiraToken}
                onChange={(e) => setJiraToken(e.target.value)}
                disabled={jiraStatus === 'connected'}
              />
            </div>

            <div className="form-group">
              <label htmlFor="jira-project">项目 Key</label>
              <input
                id="jira-project"
                type="text"
                placeholder="e.g., PROJ"
                value={jiraProject}
                onChange={(e) => setJiraProject(e.target.value)}
                disabled={jiraStatus === 'connected'}
              />
            </div>

            <div className="form-actions">
              {jiraStatus !== 'connected' ? (
                <button 
                  className="btn-connect"
                  onClick={handleJiraConnect}
                  disabled={loading || !jiraUrl.trim() || !jiraEmail.trim() || !jiraToken.trim()}
                >
                  {loading ? '连接中...' : '连接'}
                </button>
              ) : (
                <>
                  <button 
                    className="btn-disconnect"
                    onClick={handleJiraDisconnect}
                  >
                    断开
                  </button>
                  <button 
                    className="btn-refresh"
                    onClick={loadJiraIssues}
                    disabled={loading}
                  >
                    {loading ? '加载中...' : '刷新 Issues'}
                  </button>
                </>
              )}
            </div>
          </div>

          {jiraStatus === 'connected' && jiraIssues.length > 0 && (
            <div className="mcp-data-list">
              <h4>Issues ({jiraIssues.length})</h4>
              <div className="data-items">
                {jiraIssues.map((issue) => {
                  const itemKey = `jira-${issue.id || issue.key}`;
                  const isSelected = selectedItems.has(itemKey);
                  return (
                    <div key={issue.id || issue.key} className={`data-item ${isSelected ? 'selected' : ''}`}>
                      <div className="item-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => _handleImport(issue, 'jira', 'issue')}
                        />
                      </div>
                      <div className="item-content">
                        <div className="item-header">
                          <span className="item-number">{issue.key}</span>
                          <span className="item-state" data-state={issue.status?.toLowerCase()}>
                            {issue.status || 'Unknown'}
                          </span>
                        </div>
                        <div className="item-title">{issue.summary || issue.title}</div>
                        <div className="item-meta">
                          <span className="item-priority">优先级: {issue.priority || 'Medium'}</span>
                        </div>
                        <div className="item-actions">
                          {issue.self && (
                            <button
                              className="btn-external"
                              onClick={() => _openExternalUrl(issue.self)}
                              title="打开外部链接"
                            >
                              🔗
                            </button>
                          )}
                          <button 
                            className="btn-import"
                            onClick={() => autoImportEnabled ? _handleImport(issue, 'jira', 'issue') : _importAsTask(issue, 'jira')}
                          >
                            {autoImportEnabled ? '✓ 自动导入' : '导入为任务'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {jiraStatus === 'connected' && jiraIssues.length === 0 && !loading && (
            <div className="mcp-empty">
              暂无 issues 或项目为空
            </div>
          )}
        </div>
      )}

      {/* Figma Tab */}
      {activeTab === 'figma' && (
        <div className="mcp-tab-content">
          <div className="mcp-sync-form">
            <div className="form-row">
              <span className="status-badge" style={{ backgroundColor: figmaStatusConfig.color }}>
                {figmaStatusConfig.icon} {figmaStatusConfig.label}
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="figma-token">Figma Access Token</label>
              <input
                id="figma-token"
                type="password"
                placeholder="figd_xxxxx"
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
                disabled={figmaStatus === 'connected'}
              />
            </div>

            <div className="form-group">
              <label htmlFor="figma-file">文件 Key</label>
              <input
                id="figma-file"
                type="text"
                placeholder="从 Figma URL 中获取 (e.g., abc123xyz)"
                value={figmaFileKey}
                onChange={(e) => setFigmaFileKey(e.target.value)}
                disabled={figmaStatus === 'connected'}
              />
            </div>

            <div className="form-actions">
              {figmaStatus !== 'connected' ? (
                <button 
                  className="btn-connect"
                  onClick={handleFigmaConnect}
                  disabled={loading || !figmaToken.trim()}
                >
                  {loading ? '连接中...' : '连接'}
                </button>
              ) : (
                <>
                  <button 
                    className="btn-disconnect"
                    onClick={handleFigmaDisconnect}
                  >
                    断开
                  </button>
                  <button 
                    className="btn-refresh"
                    onClick={loadFigmaFile}
                    disabled={loading}
                  >
                    {loading ? '加载中...' : '获取文件'}
                  </button>
                  <button 
                    className="btn-refresh"
                    onClick={loadFigmaComments}
                    disabled={loading}
                  >
                    获取评论
                  </button>
                </>
              )}
            </div>
          </div>

          {figmaStatus === 'connected' && figmaFile && (
            <div className="mcp-data-list">
              <h4>文件: {figmaFile.name || figmaFileKey}</h4>
              <div className="data-items">
                <div className="data-item">
                  <div className="item-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(`figma-${figmaFileKey}`)}
                      onChange={() => _handleImport(figmaFile, 'figma', 'file')}
                    />
                  </div>
                  <div className="item-content">
                    <div className="item-title">{figmaFile.name || 'Figma 文件'}</div>
                    <div className="item-meta">
                      <span>最后修改: {figmaFile.lastModified || 'Unknown'}</span>
                    </div>
                    <div className="item-actions">
                      {figmaFile.thumbnailUrl && (
                        <button
                          className="btn-external"
                          onClick={() => _openExternalUrl(figmaFile.thumbnailUrl)}
                          title="打开外部链接"
                        >
                          🔗
                        </button>
                      )}
                      <button 
                        className="btn-import"
                        onClick={() => autoImportEnabled ? _handleImport(figmaFile, 'figma', 'file') : _importAsTask(figmaFile, 'figma')}
                      >
                        {autoImportEnabled ? '✓ 自动导入' : '导入为任务'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {figmaStatus === 'connected' && figmaComments.length > 0 && (
            <div className="mcp-data-list">
              <h4>评论 ({figmaComments.length})</h4>
              <div className="data-items">
                {figmaComments.map((comment, idx) => {
                  const itemKey = `figma-comment-${comment.id || idx}`;
                  const isSelected = selectedItems.has(itemKey);
                  return (
                    <div key={comment.id || idx} className={`data-item ${isSelected ? 'selected' : ''}`}>
                      <div className="item-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => _handleImport(comment, 'figma', 'file')}
                        />
                      </div>
                      <div className="item-content">
                        <div className="item-header">
                          <span className="item-number">{comment.author?.name || 'Unknown'}</span>
                          <span className="item-date">
                            {comment.created_at ? new Date(comment.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <div className="item-title">{comment.message || comment.text}</div>
                        <div className="item-actions">
                          <button 
                            className="btn-import"
                            onClick={() => autoImportEnabled ? _handleImport(comment, 'figma', 'file') : _importAsTask(comment, 'figma')}
                          >
                            {autoImportEnabled ? '✓ 自动导入' : '导入为任务'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {figmaStatus === 'connected' && !figmaFile && figmaComments.length === 0 && !loading && (
            <div className="mcp-empty">
              请输入文件 Key 并点击"获取文件"或"获取评论"
            </div>
          )}
        </div>
      )}

      {/* Orchestration Log Tab */}
      {activeTab === 'orchestration' && (
        <div className="mcp-tab-content">
          <div className="orchestration-section">
            <h4>触发编排</h4>
            <div className="orchestration-controls">
              <div className="form-group">
                <label htmlFor="chain-select">工具链</label>
                <select
                  id="chain-select"
                  value={selectedChain}
                  onChange={(e) => setSelectedChain(e.target.value)}
                >
                  <option value="">-- 选择工具链 --</option>
                  {TOOL_CHAINS.map(chain => (
                    <option key={chain.id} value={chain.id}>{chain.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="chain-input">输入 (JSON)</label>
                <textarea
                  id="chain-input"
                  placeholder='{"repo": "owner/repo", "issue": {"number": 1}}'
                  value={orchestrationInput}
                  onChange={(e) => setOrchestrationInput(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button
                  className="btn-connect"
                  onClick={handleExecuteChain}
                  disabled={orchestrationLoading || !selectedChain}
                >
                  {orchestrationLoading ? '执行中...' : '手动触发'}
                </button>
                <button
                  className="btn-refresh"
                  onClick={refreshOrchestrationLog}
                >
                  刷新日志
                </button>
              </div>
            </div>
          </div>

          <div className="orchestration-log">
            <h4>编排日志</h4>
            {orchestrationLog.length === 0 ? (
              <div className="mcp-empty">暂无编排记录</div>
            ) : (
              <table className="log-table">
                <thead>
                  <tr>
                    <th>时间戳</th>
                    <th>工具链</th>
                    <th>状态</th>
                    <th>输入</th>
                    <th>输出</th>
                  </tr>
                </thead>
                <tbody>
                  {orchestrationLog.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.timestamp).toLocaleString()}</td>
                      <td>{entry.chain.join(' → ')}</td>
                      <td>
                        <span className={`status-badge ${entry.status}`}>{entry.status}</span>
                      </td>
                      <td>
                        <pre className="log-json">{JSON.stringify(entry.input, null, 2)}</pre>
                      </td>
                      <td>
                        <pre className="log-json">{JSON.stringify(entry.output, null, 2)}</pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MCPSync;