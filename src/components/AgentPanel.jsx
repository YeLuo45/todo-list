import React, { useState, useEffect } from 'react';
import './AgentPanel.css';
import { CreatorAgent } from '../agents/creatorAgent.js';
import { ReviewAgent } from '../agents/reviewAgent.js';
import { ReminderAgent } from '../agents/reminderAgent.js';

const creatorAgent = new CreatorAgent();
const reviewAgent = new ReviewAgent();
const reminderAgent = new ReminderAgent();

export default function AgentPanel({ onTaskCreate }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [reviewResults, setReviewResults] = useState([]);
  
  useEffect(() => {
    // Listen for review complete
    const handleReview = (data) => {
      setReviewResults(prev => [...prev, data]);
    };
    window.addEventListener('task:review-complete', handleReview);
    return () => window.removeEventListener('task:review-complete', handleReview);
  }, []);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, { from: 'user', text: input, time: Date.now() }]);
    
    // Trigger CreatorAgent
    const task = creatorAgent.handleInput(input);
    
    // Notify parent to create task
    if (onTaskCreate) {
      onTaskCreate(task);
    }
    
    setMessages(prev => [...prev, { from: 'agent', text: `Created task: ${task.title}`, time: Date.now() }]);
    setInput('');
  };
  
  return (
    <div className="agent-panel">
      <h3>🤖 Agent 控制面板</h3>
      
      <div className="agent-status">
        <span className="agent-badge active">CreatorAgent</span>
        <span className="agent-badge active">ReviewAgent</span>
        <span className="agent-badge active">ReminderAgent</span>
      </div>
      
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
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.from}`}>
            <span className="message-label">{msg.from === 'user' ? '👤' : '🤖'}</span>
            <span className="message-text">{msg.text}</span>
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
    </div>
  );
}
