import { useState, useEffect, useRef } from 'react';
import { getComments, addComment, deleteComment, getUsers, getUserById, getCurrentUser } from '../utils/comment';
import { getTaskActivities, addActivity, ACTIVITY_ACTIONS } from '../utils/activityLog';
import ActivityTimeline from './ActivityTimeline';
import './TaskDetailModal.css';

export default function TaskDetailModal({ task, onClose, onEdit }) {
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [users, setUsers] = useState([]);
  const commentInputRef = useRef(null);

  useEffect(() => {
    setComments(getComments(task.id));
    setUsers(getUsers());
  }, [task.id]);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const handleCommentKeyDown = (e) => {
    if (e.key === '@') {
      const rect = e.target.getBoundingClientRect();
      setMentionPosition({ top: rect.bottom + 5, left: rect.left });
      setShowMentionPopup(true);
      setMentionFilter('');
    } else if (e.key === 'Escape') {
      setShowMentionPopup(false);
    }
  };

  const handleCommentChange = (e) => {
    const value = e.target.value;
    setNewComment(value);
    
    // Check for @ mentions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = value.slice(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setMentionFilter(afterAt);
        setShowMentionPopup(true);
        const rect = e.target.getBoundingClientRect();
        setMentionPosition({ top: rect.bottom + 5, left: rect.left });
      } else {
        setShowMentionPopup(false);
      }
    } else {
      setShowMentionPopup(false);
    }
  };

  const insertMention = (user) => {
    const lastAtIndex = newComment.lastIndexOf('@');
    const beforeAt = newComment.slice(0, lastAtIndex);
    setNewComment(beforeAt + `@${user.name} `);
    setShowMentionPopup(false);
    commentInputRef.current?.focus();
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    // Extract mentions from comment
    const mentionMatches = newComment.match(/@([^@\s]+)/g) || [];
    const mentions = mentionMatches.map(m => {
      const name = m.slice(1);
      const user = users.find(u => u.name === name);
      return user ? user.id : null;
    }).filter(Boolean);

    const comment = addComment(task.id, newComment, mentions);
    if (comment) {
      setComments([comment, ...comments]);
      setNewComment('');
      addActivity(task.id, ACTIVITY_ACTIONS.COMMENT_ADDED, { commentContent: newComment.slice(0, 50) });
    }
  };

  const handleDeleteComment = (commentId) => {
    if (window.confirm('确定删除这条评论？')) {
      deleteComment(commentId);
      setComments(comments.filter(c => c.id !== commentId));
    }
  };

  const handleEdit = () => {
    onClose();
    onEdit(task);
  };

  const assignee = task.assignee ? getUserById(task.assignee) : null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '无';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="task-detail-overlay" onClick={onClose}>
      <div className="task-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="task-detail-header">
          <h3>{task.title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="task-detail-body">
          {/* Task Info Section */}
          <div className="detail-section task-info-section">
            <div className="info-row">
              <span className="info-label">状态</span>
              <span className={`status-badge status-${task.status}`}>
                {task.status === 'todo' ? '待办' : task.status === 'in-progress' ? '进行中' : '已完成'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">优先级</span>
              <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
            </div>
            {assignee && (
              <div className="info-row">
                <span className="info-label">指派给</span>
                <span className="assignee-badge" style={{ backgroundColor: assignee.color }}>
                  {assignee.avatar} {assignee.name}
                </span>
              </div>
            )}
            <div className="info-row">
              <span className="info-label">截止日期</span>
              <span>{task.dueDate || '无'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">创建时间</span>
              <span>{formatDate(task.createdAt)}</span>
            </div>
            {task.content && (
              <div className="info-row content-row">
                <span className="info-label">描述</span>
                <p className="task-content-text">{task.content}</p>
              </div>
            )}
            {task.tags && task.tags.length > 0 && (
              <div className="info-row">
                <span className="info-label">标签</span>
                <div className="tag-list">
                  {task.tags.map(tag => (
                    <span key={tag} className="task-tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="detail-section comments-section">
            <h4>💬 评论 ({comments.length})</h4>
            
            <div className="comment-input-area">
              <textarea
                ref={commentInputRef}
                value={newComment}
                onChange={handleCommentChange}
                onKeyDown={handleCommentKeyDown}
                placeholder="添加评论... 使用 @ 提及成员"
                rows={2}
              />
              <button 
                className="btn-comment-submit"
                onClick={handleAddComment}
                disabled={!newComment.trim()}
              >
                发送
              </button>
            </div>

            {/* Mention Popup */}
            {showMentionPopup && filteredUsers.length > 0 && (
              <div 
                className="mention-popup"
                style={{ top: mentionPosition.top, left: mentionPosition.left }}
              >
                {filteredUsers.slice(0, 5).map(user => (
                  <div 
                    key={user.id} 
                    className="mention-item"
                    onClick={() => insertMention(user)}
                  >
                    <span className="mention-avatar" style={{ backgroundColor: user.color }}>
                      {user.avatar}
                    </span>
                    <span className="mention-name">{user.name}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="comments-list">
              {comments.map(comment => {
                const author = comment.author || {};
                const isOwner = author.id === getCurrentUser().id;
                return (
                  <div key={comment.id} className={`comment-item ${isOwner ? 'own' : ''}`}>
                    <div className="comment-header">
                      <span 
                        className="comment-avatar"
                        style={{ backgroundColor: author.color || '#6b7280' }}
                      >
                        {author.avatar || '👤'}
                      </span>
                      <span className="comment-author">{author.name || '未知'}</span>
                      <span className="comment-time">
                        {formatDate(comment.createdAt)}
                      </span>
                      {isOwner && (
                        <button 
                          className="comment-delete"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                    <div className="comment-content">
                      {comment.content}
                    </div>
                  </div>
                );
              })}
              {comments.length === 0 && (
                <p className="no-comments">暂无评论</p>
              )}
            </div>
          </div>

          {/* Activity Timeline Section */}
          <div className="detail-section">
            <ActivityTimeline taskId={task.id} />
          </div>
        </div>

        <div className="task-detail-footer">
          <button className="btn-edit-task" onClick={handleEdit}>
            ✏️ 编辑任务
          </button>
        </div>
      </div>
    </div>
  );
}
