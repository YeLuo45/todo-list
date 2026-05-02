import { useTaskContext } from '../context/TaskContext';
import { getReminderUrgency } from '../utils/reminder';
import './TaskItem.css';

const priorityColors = {
  P0: '#ef4444',
  P1: '#f59e0b',
  P2: '#9ca3af',
};

export default function TaskItem({ task, onEdit }) {
  const { updateTask, deleteTask, toggleTaskSelection, selectedTaskIds, isTaskBlocked } = useTaskContext();

  const isSelected = selectedTaskIds.has(task.id);
  const blocked = isTaskBlocked(task.id);

  const handleStatusChange = (e) => {
    if (blocked) return;
    updateTask(task.id, { status: e.target.value });
  };

  const handleDelete = () => {
    if (window.confirm('Delete this task?')) {
      deleteTask(task.id);
    }
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const urgency = getReminderUrgency(task);
  const completedSubs = (task.subtasks || []).filter((s) => s.done).length;
  const totalSubs = (task.subtasks || []).length;

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
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass}>
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

      <div className="task-content" onClick={() => !blocked && onEdit(task)}>
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
        </div>

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
          {durationStr && (
            <span className="task-duration">{durationStr}</span>
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
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="task-actions">
        <button className="btn-edit" onClick={() => onEdit(task)}>编辑</button>
        <button className="btn-delete" onClick={handleDelete}>删除</button>
      </div>
    </div>
  );
}
