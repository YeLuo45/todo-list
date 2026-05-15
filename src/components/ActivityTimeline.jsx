import { useState, useEffect } from 'react';
import { getTaskActivities, formatActivityAction, ACTIVITY_ACTIONS } from '../utils/activityLog';
import { getUserById } from '../utils/comment';
import './ActivityTimeline.css';

export default function ActivityTimeline({ taskId }) {
  const [activities, setActivities] = useState([]);
  
  useEffect(() => {
    const taskActivities = getTaskActivities(taskId);
    setActivities(taskActivities);
  }, [taskId]);
  
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const getActionIcon = (action) => {
    const icons = {
      [ACTIVITY_ACTIONS.TASK_CREATED]: '✨',
      [ACTIVITY_ACTIONS.TASK_UPDATED]: '📝',
      [ACTIVITY_ACTIONS.STATUS_CHANGED]: '🔄',
      [ACTIVITY_ACTIONS.TASK_DELETED]: '🗑️',
      [ACTIVITY_ACTIONS.TASK_ASSIGNED]: '👤',
      [ACTIVITY_ACTIONS.COMMENT_ADDED]: '💬',
      [ACTIVITY_ACTIONS.DESCRIPTION_CHANGED]: '📝',
      [ACTIVITY_ACTIONS.PRIORITY_CHANGED]: '🎯',
      [ACTIVITY_ACTIONS.DUE_DATE_CHANGED]: '📅',
      [ACTIVITY_ACTIONS.SUBTASK_ADDED]: '☑️',
      [ACTIVITY_ACTIONS.SUBTASK_COMPLETED]: '✅',
      [ACTIVITY_ACTIONS.TAG_ADDED]: '🏷️',
      [ACTIVITY_ACTIONS.TAG_REMOVED]: '🏷️',
    };
    return icons[action] || '📌';
  };
  
  if (activities.length === 0) {
    return (
      <div className="activity-timeline empty">
        <div className="empty-message">暂无活动记录</div>
      </div>
    );
  }
  
  return (
    <div className="activity-timeline">
      <div className="timeline-header">
        <h4>📜 活动时间线</h4>
      </div>
      <div className="timeline-list">
        {activities.map((activity, index) => {
          const actor = activity.actor || {};
          const isLast = index === activities.length - 1;
          
          return (
            <div key={activity.id} className={`timeline-item ${isLast ? 'last' : ''}`}>
              <div className="timeline-line"></div>
              <div className="timeline-marker">
                <span className="marker-icon">{getActionIcon(activity.action)}</span>
              </div>
              <div className="timeline-content">
                <div className="timeline-actor">
                  <span 
                    className="actor-avatar"
                    style={{ backgroundColor: actor.color || '#6b7280' }}
                  >
                    {actor.avatar || '👤'}
                  </span>
                  <span className="actor-name">{actor.name || '未知'}</span>
                </div>
                <div className="timeline-action">
                  {formatActivityAction(activity.action, activity.details)}
                </div>
                <div className="timeline-time">{formatTime(activity.timestamp)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
