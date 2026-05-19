import React, { useState, useEffect } from 'react';
import { cronScheduler } from '../subagent/cronScheduler.js';
import { agentRunner } from '../subagent/agentRunner.js';
import { autoChecker } from '../subagent/autoChecker.js';
import { gistSyncer } from '../subagent/gistSyncer.js';
import { notebookExecutor } from '../subagent/notebookExecutor.js';
import { scriptTemplates, getTemplateNames, getTemplate } from '../subagent/scriptTemplates.js';
import './CronTaskPanel.css';

export default function CronTaskPanel({ tasks, onTaskUpdate }) {
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [activeAgents, setActiveAgents] = useState([]);
  const [newCron, setNewCron] = useState('0 9 * * *'); // default: daily 9am
  const [selectedTask, setSelectedTask] = useState('');
  
  // Sync state
  const [syncInterval, setSyncInterval] = useState('manual');
  const [lastSync, setLastSync] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Notebook state
  const [activeTab, setActiveTab] = useState('cron');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [scriptCode, setScriptCode] = useState('// Write your script here\nreturn { message: "Hello World" };');
  const [inputJson, setInputJson] = useState('{}');
  const [executionOutput, setExecutionOutput] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  
  useEffect(() => {
    // Start auto checker
    autoChecker.start();
    
    // Load scheduled tasks
    setScheduledTasks(cronScheduler.getScheduledTasks());
    
    // Load sync settings
    setSyncInterval(gistSyncer.getSyncInterval());
    setLastSync(gistSyncer.getLastSync());
    setSyncHistory(gistSyncer.getSyncHistory());
    
    // Load execution history
    setExecutionHistory(notebookExecutor.getHistory());
    
    // Poll agent status
    const interval = setInterval(() => {
      setActiveAgents(agentRunner.getAllAgents());
    }, 2000);
    
    return () => {
      autoChecker.stop();
      clearInterval(interval);
    };
  }, []);
  
  const handleSchedule = () => {
    if (!selectedTask) return;
    cronScheduler.scheduleTask(selectedTask, newCron, (taskId) => {
      // Trigger notification
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        new Notification(`定时任务: ${task.title}`, { body: '时间到！' });
      }
    });
    setScheduledTasks(cronScheduler.getScheduledTasks());
  };
  
  const handleCancel = (taskId) => {
    cronScheduler.cancelScheduled(taskId);
    setScheduledTasks(cronScheduler.getScheduledTasks());
  };
  
  const handleSpawnAgent = async () => {
    if (!selectedTask) return;
    const agentId = await agentRunner.spawnAgent({ taskId: selectedTask, action: 'process' });
    setActiveAgents(agentRunner.getAllAgents());
  };
  
  const handleSyncIntervalChange = (e) => {
    const interval = e.target.value;
    setSyncInterval(interval);
    gistSyncer.setSyncInterval(interval);
  };
  
  const handleSyncNow = async () => {
    setSyncing(true);
    const result = await gistSyncer.sync();
    gistSyncer.addSyncHistory({
      timestamp: new Date().toISOString(),
      success: result.success,
      error: result.error || null
    });
    setLastSync(gistSyncer.getLastSync());
    setSyncHistory(gistSyncer.getSyncHistory());
    setSyncing(false);
  };
  
  const handleTemplateSelect = (key) => {
    setSelectedTemplate(key);
    const template = getTemplate(key);
    if (template) {
      setScriptCode(template.script);
    }
  };
  
  const handleExecuteScript = async () => {
    setIsExecuting(true);
    try {
      let input = {};
      try {
        input = JSON.parse(inputJson);
      } catch (e) {
        setExecutionOutput({ error: 'Invalid JSON input' });
        setIsExecuting(false);
        return;
      }
      const result = await notebookExecutor.executeScript(scriptCode, input);
      setExecutionOutput(result);
      setExecutionHistory(notebookExecutor.getHistory());
    } catch (err) {
      setExecutionOutput({ error: err.message });
    }
    setIsExecuting(false);
  };
  
  const renderOutput = () => {
    if (!executionOutput) return null;
    if (executionOutput.error) {
      return <pre className="output-error">{executionOutput.error}</pre>;
    }
    try {
      const parsed = JSON.parse(executionOutput.output);
      return <pre className="output-success">{JSON.stringify(parsed, null, 2)}</pre>;
    } catch {
      return <pre className="output-success">{executionOutput.output}</pre>;
    }
  };
  
  return (
    <div className="cron-panel">
      <h3>⏰ 定时任务 + 子进程</h3>
      
      <div className="tab-buttons">
        <button 
          className={activeTab === 'cron' ? 'active' : ''} 
          onClick={() => setActiveTab('cron')}
        >
          定时
        </button>
        <button 
          className={activeTab === 'notebook' ? 'active' : ''} 
          onClick={() => setActiveTab('notebook')}
        >
          Notebook
        </button>
      </div>
      
      {activeTab === 'cron' && (
        <>
          <div className="cron-controls">
            <select value={selectedTask} onChange={(e) => setSelectedTask(e.target.value)}>
              <option value="">选择任务...</option>
              {tasks.filter(t => !t.completed).map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            
            <input 
              type="text" 
              value={newCron} 
              onChange={(e) => setNewCron(e.target.value)}
              placeholder="0 9 * * *"
              className="cron-input"
            />
            
            <button onClick={handleSchedule}>定时</button>
            <button onClick={handleSpawnAgent}>执行</button>
          </div>
          
          <div className="scheduled-list">
            <h4>定时任务</h4>
            {scheduledTasks.length === 0 ? <p className="empty">暂无定时任务</p> : (
              <ul>
                {scheduledTasks.map(s => {
                  const task = tasks.find(t => t.id === s.taskId);
                  return (
                    <li key={s.taskId}>
                      <span>{task?.title || s.taskId}</span>
                      <span className="cron-expr">{s.expression}</span>
                      <span className="next-run">{s.nextRun?.toLocaleString()}</span>
                      <button onClick={() => handleCancel(s.taskId)}>取消</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          
          <div className="agents-list">
            <h4>活跃子进程</h4>
            {activeAgents.length === 0 ? <p className="empty">无活跃子进程</p> : (
              <ul>
                {activeAgents.map(a => (
                  <li key={a.id}>
                    <span className={`status-dot ${a.status}`}></span>
                    <span>{a.id.slice(0, 8)}...</span>
                    <span>{a.status}</span>
                    <button onClick={() => agentRunner.terminateAgent(a.id)}>终止</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="sync-section">
            <h4>📤 Gist 同步</h4>
            <div className="sync-controls">
              <label>
                同步间隔:
                <select value={syncInterval} onChange={handleSyncIntervalChange}>
                  <option value="manual">手动</option>
                  <option value="hourly">每小时</option>
                  <option value="daily">每天</option>
                </select>
              </label>
              <button onClick={handleSyncNow} disabled={syncing}>
                {syncing ? '同步中...' : '立即同步'}
              </button>
            </div>
            <div className="sync-info">
              <span>最后同步: {lastSync ? lastSync.toLocaleString() : '从未同步'}</span>
            </div>
            <div className="sync-history-toggle">
              <button onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? '隐藏' : '显示'} 同步历史
              </button>
            </div>
            {showHistory && (
              <div className="sync-history">
                {syncHistory.length === 0 ? (
                  <p className="empty">暂无同步记录</p>
                ) : (
                  <ul>
                    {syncHistory.map((entry, idx) => (
                      <li key={idx}>
                        <span className={`sync-status ${entry.success ? 'success' : 'error'}`}>
                          {entry.success ? '✓' : '✗'}
                        </span>
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                        {!entry.success && <span className="sync-error">{entry.error}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}
      
      {activeTab === 'notebook' && (
        <div className="notebook-section">
          <h4>📓 脚本执行</h4>
          
          <div className="template-selector">
            <label>模板:</label>
            <select 
              value={selectedTemplate} 
              onChange={(e) => handleTemplateSelect(e.target.value)}
            >
              <option value="">选择模板...</option>
              {getTemplateNames().map(t => (
                <option key={t.key} value={t.key}>{t.name} - {t.description}</option>
              ))}
            </select>
          </div>
          
          <div className="script-editor">
            <label>脚本:</label>
            <textarea
              value={scriptCode}
              onChange={(e) => setScriptCode(e.target.value)}
              placeholder="// Write your script here&#10;// Input is available as 'input' object&#10;return { result: 'Hello' };"
              rows={8}
            />
          </div>
          
          <div className="input-editor">
            <label>输入 (JSON):</label>
            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              placeholder='{"key": "value"}'
              rows={3}
            />
          </div>
          
          <button 
            className="execute-btn" 
            onClick={handleExecuteScript}
            disabled={isExecuting}
          >
            {isExecuting ? '执行中...' : '执行'}
          </button>
          
          <div className="output-section">
            <h5>输出:</h5>
            {renderOutput()}
          </div>
          
          <div className="execution-history">
            <h5>执行历史:</h5>
            {executionHistory.length === 0 ? (
              <p className="empty">暂无执行记录</p>
            ) : (
              <ul>
                {executionHistory.slice(0, 10).map(h => (
                  <li key={h.id} className={`history-item ${h.status}`}>
                    <span className="history-status">{h.status === 'completed' ? '✓' : h.status === 'error' ? '✗' : '⏳'}</span>
                    <span className="history-time">{new Date(h.timestamp).toLocaleTimeString()}</span>
                    <span className="history-preview">
                      {h.script.substring(0, 30)}{h.script.length > 30 ? '...' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
