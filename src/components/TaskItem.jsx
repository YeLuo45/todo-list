import { useState, useEffect, useRef } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { getReminderUrgency } from '../utils/reminder';
import { computeTaskScore, QUADRANT_LABELS, getQuadrant } from '../context/TaskContext';
import { getAIPriorityScore } from '../utils/aiPriority';
import { breakIntoSubtasks, getAPIToken } from '../utils/aiSubtask';
import { getQuickEstimate, predictCompletionTime } from '../utils/aiPrediction';
import { improveDescription, formatDiff } from '../utils/aiDescription优化';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import './TaskItem.css';

const priorityColors = {
  P0: '#ef4444',
  P1: '#f59e0b',
  P2: '#9ca3af',
};

export default function TaskItem({ task, onEdit, onDragStart, onDragEnd, isDragging }) {
  const { updateTask, deleteTask, toggleTaskSelection, selectedTaskIds, isTaskBlocked, allTasks } = useTaskContext();

  const [isAIBreaking, setIsAIBreaking] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [improvedDesc, setImprovedDesc] = useState(null);
  const [showDescDiff, setShowDescDiff] = useState(false);
  const cardRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isDraggingTouch = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);

  const isSelected = selectedTaskIds.has(task.id);
  const blocked = isTaskBlocked(task.id);

  // Calculate AI priority
  const aiPriority = task.dueDate ? getAIPriorityScore(task, allTasks) : null;

  // Swipe gesture handlers
  const handleSwipeLeft = () => {
    setShowActions(true);
  };

  const handleSwipeRight = () => {
    if (!blocked) onEdit(task);
  };

  const handleDoubleTap = () => {
    setIsExpanded(!isExpanded);
  };

  const handleSwipeReset = () => {
    setSwipeOffset(0);
    setShowActions(false);
  };

  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useSwipeGesture({
    threshold: 60,
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    onDoubleTap: handleDoubleTap,
    onSwipeReset: handleSwipeReset,
  });

  // Touch drag handlers for Kanban cross-column dragging
  const handleTouchDragStart = (e) => {
    if (blocked) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    dragStartX.current = touch.clientX;
    dragStartY.current = touch.clientY;
    isDraggingTouch.current = false;
  };

  const handleTouchDragMove = (e) => {
    if (touchStartX.current === null || blocked) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX.current);
    const dy = Math.abs(touch.clientY - touchStartY.current);

    // Start drag after 10px movement, prefer horizontal
    if (!isDraggingTouch.current && dx > 10) {
      isDraggingTouch.current = true;
      if (onDragStart) onDragStart(task.id);
    }

    if (isDraggingTouch.current) {
      e.preventDefault();
      e.stopPropagation();
      const deltaX = touch.clientX - dragStartX.current;
      setSwipeOffset(deltaX);
    }
  };

  const handleTouchDragEnd = (e) => {
    if (isDraggingTouch.current && onDragEnd) {
      onDragEnd();
    }
    isDraggingTouch.current = false;
    touchStartX.current = null;
    touchStartY.current = null;
    setSwipeOffset(0);
  };

  const handleStatusChange = (e) => {
    if (blocked) return;
    updateTask(task.id, { status: e.target.value });
  };

  const handleDelete = () => {
    if (window.confirm('Delete this task?')) {
      deleteTask(task.id);
    }
  };

  const handleComplete = () => {
    updateTask(task.id, { status: 'done' });
    setShowActions(false);
  };

  const handleCheckbox = (e) => {
    e.stopPropagation();
    toggleTaskSelection(task.id);
  };

  const handleSubtaskToggle = (e, subtaskId) => {
    e.stopPropagation();
    const subtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, done: !st.done } : st
    );
    updateTask(task.id, { subtasks });
  };

  const handleAIBreakdown = async () => {
    const token = getAPIToken();
    if (!token) {
      setAiError('请先在设置中配置 AI Token');
      return;
    }

    setIsAIBreaking(true);
    setAiError(null);

    try {
      const subtasks = await breakIntoSubtasks(task, allTasks);
      
      // Merge with existing subtasks
      const existingSubtasks = task.subtasks || [];
      const newSubtasks = [...existingSubtasks, ...subtasks];
      
      updateTask(task.id, { subtasks: newSubtasks });
    } catch (error) {
      if (error.message === 'NO_TOKEN') {
        setAiError('请先在设置中配置 AI Token');
      } else {
        setAiError(error.message);
      }
      console.error('AI Breakdown Error:', error);
    } finally {
      setIsAIBreaking(false);
    }
  };

  const handleAIImproveDescription = async () => {
    const token = getAPIToken();
    if (!token) {
      setAiError('请先在设置中配置 AI Token');
      return;
    }

    setIsImproving(true);
    setAiError(null);

    try {
      const result = await improveDescription(task);
      setImprovedDesc(result);
      setShowDescDiff(true);
    } catch (error) {
      if (error.message === 'NO_TOKEN') {
        setAiError('请先在设置中配置 AI Token');
      } else {
        setAiError(error.message);
      }
      console.error('AI Description Improvement Error:', error);
    } finally {
      setIsImproving(false);
    }
  };

  const handleApplyImprovedDescription = () => {
    if (improvedDesc) {
      updateTask(task.id, { content: improvedDesc.improved });
      setShowDescDiff(false);
      setImprovedDesc(null);
    }
  };

  const handleCancelImprovedDescription = () => {
    setShowDescDiff(false);
    setImprovedDesc(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const urgency = getReminderUrgency(task);
  const completedSubs = (task.subtasks || []).filter((s) => s.done).length;
  const totalSubs = (task.subtasks || []).length;

  // AI Completion Time Prediction
  useEffect(() => {
    if ((task.subtasks || []).length > 0) {
      // Quick estimate based on subtasks (synchronous)
      const quickEst = getQuickEstimate(task);
      if (quickEst) {
        setPrediction(quickEst);
      }
      
      // Async AI prediction if token is available
      const token = getAPIToken();
      if (token) {
        setIsPredicting(true);
        predictCompletionTime(task, allTasks).then(result => {
          setPrediction(result);
          setIsPredicting(false);
        }).catch(() => {
          setIsPredicting(false);
        });
      }
    } else {
      setPrediction(null);
    }
  }, [task.id, task.subtasks, allTasks]);

  // Duration
  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return null;
    const m = Math.floor(ms / 60000);
    if (m < 1) return '< 1 分钟';
    if (m < 60) return `${m} 分钟`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h} 小时`;
  };

  let durationStr = null;
  if (task.startTime && task.endTime) {
    const ms = new Date(task.endTime) - new Date(task.startTime);
    durationStr = formatDuration(ms);
  } else if (task.startTime && task.status === 'in-progress') {
    const ms = Date.now() - new Date(task.startTime);
    durationStr = `⏱ ${formatDuration(ms)} (进行中)`;
  } else if (task.startTime && task.status === 'done') {
    durationStr = '⏱ 已完成';
  }

  const cardClass = [
    'task-item',
    task.status === 'done' ? 'done' : '',
    urgency === 'overdue' ? 'overdue-card' : '',
    urgency === 'urgent' ? 'urgent-card' : '',
    urgency === 'today' ? 'today-card' : '',
    urgency === 'upcoming' ? 'upcoming-card' : '',
    isSelected ? 'selected' : '',
    blocked ? 'blocked' : '',
    isDragging ? 'dragging' : '',
    showActions ? 'swipe-show-actions' : '',
    isExpanded ? 'expanded' : '',
  ].filter(Boolean).join(' ');

  // AI Priority label colors
  const aiPriorityColors = {
    high: '#22c55e',
    medium: '#eab308',
    low: '#ef4444',
  };

  const aiPriorityEmoji = {
    high: '🟢',
    medium: '🟡',
    low: '🔴',
  };

  const cardStyle = {
    transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
    transition: swipeOffset ? 'none' : undefined,
  };

  return (
    <div className={cardClass} ref={cardRef} style={cardStyle}>
      {/* Swipe action buttons (left side - swipe left reveals) */}
      {showActions && (
        <div className="swipe-actions swipe-actions-left">
          <button className="swipe-action-btn complete" onClick={handleComplete}>
            ✅ 完成
          </button>
          <button className="swipe-action-btn delete" onClick={handleDelete}>
            🗑️ 删除
          </button>
        </div>
      )}

      <div className="task-main">
        <input
          type="checkbox"
          className="task-checkbox"
          checked={isSelected}
          onChange={handleCheckbox}
          onClick={(e) => e.stopPropagation()}
        />
        <select
          className="task-status"
          value={task.status}
          onChange={handleStatusChange}
          disabled={blocked}
        >
          <option value="todo">待办</option>
          <option value="in-progress">进行中</option>
          <option value="done">已完成</option>
        </select>
        {blocked && <span className="blocked-badge" title="等待依赖任务完成">🔒</span>}
      </div>

      <div
        className="task-content"
        onClick={() => !blocked && onEdit(task)}
        onTouchStart={handleTouchDragStart}
        onTouchMove={handleTouchDragMove}
        onTouchEnd={handleTouchDragEnd}
      >
        <div className="task-header">
          <span className={`task-title ${urgency === 'overdue' ? 'overdue-title' : ''}`}>
            {task.title}
          </span>
          <span
            className="task-priority"
            style={{ backgroundColor: priorityColors[task.priority] }}
          >
            {task.priority}
          </span>
          {/* AI Priority Label */}
          {aiPriority && (
            <span
              className="ai-priority-badge"
              style={{ backgroundColor: aiPriorityColors[aiPriority.label] }}
              title={`AI 优先级: ${aiPriority.reason}`}
            >
              {aiPriorityEmoji[aiPriority.label]} AI {aiPriority.score}分
            </span>
          )}
        </div>

        {/* Mobile: Show only title + priority + due date */}
        <div className="task-mobile-meta">
          {task.dueDate && (
            <span className={`task-due ${urgency === 'overdue' ? 'overdue' : ''} ${urgency === 'urgent' ? 'urgent' : ''}`}>
              📅 {formatDate(task.dueDate)}
            </span>
          )}
          {totalSubs > 0 && (
            <span className={`subtask-badge ${completedSubs === totalSubs ? 'all-done' : ''}`}>
              ☑️ {completedSubs}/{totalSubs}
            </span>
          )}
        </div>

        {/* Desktop: Show full description */}
        <div className="task-desktop-content">
          {task.content && <p className="task-description">{task.content}</p>}

          <div className="task-meta">
            {task.tags.length > 0 && (
              <div className="task-tags">
                {task.tags.map((tag) => (
                  <span key={tag} className="task-tag">{tag}</span>
                ))}
              </div>
            )}
            {task.dueDate && (
              <span className={`task-due ${urgency === 'overdue' ? 'overdue' : ''} ${urgency === 'urgent' ? 'urgent' : ''}`}>
                📅 {formatDate(task.dueDate)}
                {urgency === 'overdue' && ' ⚠️'}
                {urgency === 'urgent' && ' 🔥'}
                {urgency === 'today' && ' 📌'}
                {urgency === 'upcoming' && ' ⏰'}
              </span>
            )}
            {totalSubs > 0 && (
              <span className={`subtask-badge ${completedSubs === totalSubs ? 'all-done' : ''}`}>
                ☑️ {completedSubs}/{totalSubs}
              </span>
            )}
            {prediction && (
              <span className="task-prediction" title={`预计 ${prediction.estimatedDays} 天完成 (${prediction.basedOn})`}>
                {isPredicting ? '⏳ 预测中...' : `📊 预计 ${prediction.estimatedDays} 天`}
              </span>
            )}
            {durationStr && (
              <span className="task-duration">{durationStr}</span>
            )}
            <span
              className="task-score"
              style={{ backgroundColor: QUADRANT_LABELS[getQuadrant(task)]?.color }}
              title={`${QUADRANT_LABELS[getQuadrant(task)]?.label} · ${QUADRANT_LABELS[getQuadrant(task)]?.desc}`}
            >
              {computeTaskScore(task)}分
            </span>
            {task.isRecurring && (
              <span className="task-recurring" title="循环任务">🔄</span>
            )}
          </div>

          {/* AI Breakdown Button */}
          <div className="task-ai-actions">
            <button
              className={`btn-ai-breakdown ${isAIBreaking ? 'loading' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleAIBreakdown();
              }}
              disabled={isAIBreaking || blocked}
              title="AI 智能拆解子任务"
            >
              {isAIBreaking ? (
                <>
                  <span className="ai-spinner">⏳</span>
                  AI 拆解中...
                </>
              ) : (
                <>🧠 AI 拆解</>
              )}
            </button>
            <button
              className={`btn-ai-breakdown btn-ai-improve ${isImproving ? 'loading' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleAIImproveDescription();
              }}
              disabled={isImproving || blocked}
              title="AI 优化任务描述"
            >
              {isImproving ? (
                <>
                  <span className="ai-spinner">⏳</span>
                  AI 优化中...
                </>
              ) : (
                <>✨ AI 优化描述</>
              )}
            </button>
            {aiError && (
              <span className="ai-error" onClick={(e) => e.stopPropagation()}>
                ⚠️ {aiError}
                <button 
                  className="btn-goto-settings"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-settings'))}
                >
                  去设置
                </button>
              </span>
            )}
          </div>

          {/* Inline subtask toggles */}
          {totalSubs > 0 && (
            <div className="task-subtasks-inline">
              {task.subtasks.map((st) => (
                <label key={st.id} className={`subtask-inline-item ${st.done ? 'done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={st.done}
                    onChange={(e) => handleSubtaskToggle(e, st.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>{st.title}</span>
                  {st.estimatedMinutes && (
                    <span className="subtask-duration">{st.estimatedMinutes}分钟</span>
                  )}
                </label>
              ))}
            </div>
          )}

          {/* AI Description Improvement Modal */}
          {showDescDiff && improvedDesc && (
            <div className="desc-diff-modal" onClick={(e) => e.stopPropagation()}>
              <div className="desc-diff-content">
                <h4>✨ AI 优化建议</h4>
                <div className="desc-diff-view">
                  <div className="desc-diff-original">
                    <div className="diff-label">📝 原描述</div>
                    <pre>{improvedDesc.original}</pre>
                  </div>
                  <div className="desc-diff-improved">
                    <div className="diff-label">✨ 优化后</div>
                    <pre>{improvedDesc.improved}</pre>
                  </div>
                </div>
                <div className="desc-diff-actions">
                  <button className="btn-apply" onClick={handleApplyImprovedDescription}>
                    ✓ 采纳优化
                  </button>
                  <button className="btn-cancel" onClick={handleCancelImprovedDescription}>
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="task-actions">
        <button className="btn-edit" onClick={() => onEdit(task)}>编辑</button>
        <button className="btn-delete" onClick={handleDelete}>删除</button>
      </div>
    </div>
  );
}
