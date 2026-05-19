import React, { useState, useEffect } from 'react';
import './AgentPanel.css';
import { CreatorAgent } from '../agents/creatorAgent.js';
import { ReviewAgent } from '../agents/reviewAgent.js';
import { ReminderAgent } from '../agents/reminderAgent.js';
import { agentHistory } from '../agents/agentHistory.js';

const creatorAgent = new CreatorAgent();
const reviewAgent = new ReviewAgent();
const reminderAgent = new ReminderAgent();

const AGENTS = [
  { id: 'CreatorAgent', instance: creatorAgent },
  { id: 'ReviewAgent', instance: reviewAgent },
  { id: 'ReminderAgent', instance: reminderAgent },
];

export default function AgentPanel({ onTaskCreate }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [reviewResults, setReviewResults] = useState([]);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'history'
  const [agentStatuses, setAgentStatuses] = useState({});
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('all');

  // Load agent statuses and history on mount
  useEffect(() => {
    const statuses = {};
    AGENTS.forEach(({ id, instance }) => {
      const loaded = instance.loadState ? instance.loadState() : false;
      const msgCount = instance.messageLog ? instance.messageLog.length : 0;
      statuses[id] = {
        active: true,
        messageCount: msgCount,
        lastActive: instance.lastActive || Date.now(),
        restored: loaded,
      };
    });
    setAgentStatuses(statuses);
    refreshHistory();
  }, []);

  const refreshHistory = () => {
    const records = agentHistory.getHistory(historyFilter === 'all' ? null : historyFilter, 100);
    setHistoryRecords(records);
  };

  // Listen for review complete
  useEffect(() => {
    const handleReview = (data) => {
      setReviewResults(prev => [...prev, data]);
      agentHistory.addRecord('ReviewAgent', 'review-complete', { taskId: data.task.id });
      setTimeout(refreshHistory, 50);
    };
    window.addEventListener('task:review-complete', handleReview);
    return () => window.removeEventListener('task:review-complete', handleReview);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { from: 'user', text: input, time: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    agentHistory.addRecord('CreatorAgent', 'user-input', { text: input });

    // Trigger CreatorAgent
    const task = creatorAgent.handleInput(input);
    agentHistory.addRecord('CreatorAgent', 'task-created', { taskId: task.id, title: task.title });

    const agentMsg = { from: 'agent', text: `Created task: ${task.title}`, time: Date.now() };
    setMessages(prev => [...prev, agentMsg]);

    // Notify parent to create task
    if (onTaskCreate) {
      onTaskCreate(task);
    }

    // Save agent state
    creatorAgent.saveState();
    reminderAgent.saveState();

    setInput('');
    setTimeout(refreshHistory, 50);
  };

  const handleClearHistory = () => {
    if (historyFilter === 'all') {
      agentHistory.clearHistory();
    } else {
      agentHistory.clearHistory(historyFilter);
    }
    setHistoryRecords([]);
    agentStatuses && Object.keys(agentStatuses).forEach(id => {
      const agent = AGENTS.find(a => a.id === id)?.instance;
      if (agent && agent.clearState) agent.clearState();
    });
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getEventLabel = (event) => {
    const map = {
      'user-input': '💬 用户输入',
      'task-created': '✅ 任务创建',
      'review-complete': '🔍 审核完成',
      'reminder-set': '⏰ 提醒设置',
      'reminder-restored': '♻️ 提醒恢复',
      'notification-sent': '🔔 通知发送',
    };
    return map[event] || `📌 ${event}`;
  };

  return (
    <div className="agent-panel">
      <h3>🤖 Agent 控制面板</h3>

      {/* Agent Status */}
      <div className="agent-status">
        {AGENTS.map(({ id }) => {
          const status = agentStatuses[id] || {};
          return (
            <div key={id} className={`agent-badge ${status.active ? 'active' : 'inactive'}`}>
              <span className="agent-name">{id}</span>
              {status.restored && <span className="agent-restored" title="状态已恢复">♻️</span>}
              <span className="agent-msg-count">{status.messageCount || 0} 条</span>
              <span className="agent-last-active">{status.lastActive ? formatTime(status.lastActive) : '-'}</span>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="agent-tabs">
        <button
          className={`agent-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          💬 对话
        </button>
        <button
          className={`agent-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => { setActiveTab('history'); refreshHistory(); }}
        >
          📜 历史
        </button>
      </div>

      {activeTab === 'chat' && (
        <>
          <form onSubmit={handleSubmit} className="agent-input-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入自然语言创建任务，如：帮我创建明天开会要准备的任务 #meeting"
              className="agent-input"
            />
            <button type="submit">发送</button>
          </form>

          <div className="agent-messages">
            <h4>消息流</h4>
            {messages.length === 0 && <p className="empty-hint">暂无消息</p>}
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.from}`}>
                <span className="message-label">{msg.from === 'user' ? '👤' : '🤖'}</span>
                <span className="message-text">{msg.text}</span>
                <span className="message-time">{formatTime(msg.time)}</span>
              </div>
            ))}
          </div>

          {reviewResults.length > 0 && (
            <div className="review-results">
              <h4>审核结果</h4>
              {reviewResults.map((result, i) => (
                <div key={i} className="review-item">
                  <span>Task: {result.task.title}</span>
                  {result.review.issues.length === 0 ? (
                    <span className="approved">✅ 审核通过</span>
                  ) : (
                    <ul>
                      {result.review.issues.map((issue, j) => (
                        <li key={j}>{issue.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="agent-history">
          <div className="history-controls">
            <select
              value={historyFilter}
              onChange={(e) => { setHistoryFilter(e.target.value); setTimeout(refreshHistory, 0); }}
              className="history-filter"
            >
              <option value="all">全部Agent</option>
              {AGENTS.map(({ id }) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <button className="clear-history-btn" onClick={handleClearHistory}>
              清空历史
            </button>
          </div>

          <div className="history-timeline">
            {historyRecords.length === 0 && <p className="empty-hint">暂无历史记录</p>}
            {historyRecords.map((record) => (
              <div key={record.id} className="history-item">
                <span className="history-agent">[{record.agentId}]</span>
                <span className="history-event">{getEventLabel(record.event)}</span>
                {record.data.title && <span className="history-title">"{record.data.title}"</span>}
                <span className="history-time">{formatTime(record.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
