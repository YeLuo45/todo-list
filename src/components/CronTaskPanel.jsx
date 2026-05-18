import React, { useState, useEffect } from 'react';
import { cronScheduler } from '../subagent/cronScheduler.js';
import { agentRunner } from '../subagent/agentRunner.js';
import { autoChecker } from '../subagent/autoChecker.js';
import './CronTaskPanel.css';

export default function CronTaskPanel({ tasks, onTaskUpdate }) {
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [activeAgents, setActiveAgents] = useState([]);
  const [newCron, setNewCron] = useState('0 9 * * *'); // default: daily 9am
  const [selectedTask, setSelectedTask] = useState('');
  
  useEffect(() => {
    // Start auto checker
    autoChecker.start();
    
    // Load scheduled tasks
    setScheduledTasks(cronScheduler.getScheduledTasks());
    
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
  
  return (
    <div className="cron-panel">
      <h3>⏰ 定时任务 + 子进程</h3>
      
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
    </div>
  );
}