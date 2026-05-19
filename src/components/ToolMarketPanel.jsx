import React, { useState, useEffect } from 'react';
import { toolRegistry } from '../agents/toolRegistry.js';
import './ToolMarketPanel.css';

export default function ToolMarketPanel() {
  const [tools, setTools] = useState([]);
  const [disabledTools, setDisabledTools] = useState(new Set());
  const [filter, setFilter] = useState('all'); // 'all' | 'CreatorAgent' | 'ReviewAgent' | 'ReminderAgent'

  useEffect(() => {
    refreshTools();
  }, [filter]);

  const refreshTools = () => {
    const allTools = toolRegistry.getToolDefs();
    setTools(allTools);
  };

  const toggleTool = (toolId) => {
    setDisabledTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const getAgentColor = (agentId) => {
    const colors = {
      CreatorAgent: '#4ade80',
      ReviewAgent: '#60a5fa',
      ReminderAgent: '#f87171',
    };
    return colors[agentId] || '#a78bfa';
  };

  const filteredTools = filter === 'all'
    ? tools
    : tools.filter(t => t.agentIds.includes(filter));

  return (
    <div className="tool-market-panel">
      <h3>🛠️ 工具市场</h3>

      <div className="tool-filter">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
        {['CreatorAgent', 'ReviewAgent', 'ReminderAgent'].map(agent => (
          <button
            key={agent}
            className={`filter-btn ${filter === agent ? 'active' : ''}`}
            onClick={() => setFilter(agent)}
          >
            {agent.replace('Agent', '')}
          </button>
        ))}
      </div>

      <div className="tool-list">
        {filteredTools.length === 0 && (
          <p className="empty-hint">暂无工具</p>
        )}
        {filteredTools.map(tool => (
          <div
            key={tool.id}
            className={`tool-item ${disabledTools.has(tool.id) ? 'disabled' : ''}`}
          >
            <div className="tool-header">
              <span className="tool-name">{tool.name}</span>
              <button
                className={`tool-toggle ${disabledTools.has(tool.id) ? 'off' : 'on'}`}
                onClick={() => toggleTool(tool.id)}
              >
                {disabledTools.has(tool.id) ? '禁用' : '启用'}
              </button>
            </div>
            <p className="tool-desc">{tool.description}</p>
            <div className="tool-agents">
              {tool.agentIds.map(agentId => (
                <span
                  key={agentId}
                  className="tool-agent-tag"
                  style={{ backgroundColor: getAgentColor(agentId) + '33', color: getAgentColor(agentId) }}
                >
                  {agentId}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
