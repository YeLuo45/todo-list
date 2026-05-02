import { useTaskContext } from '../context/TaskContext';
import { getReminderUrgency } from '../utils/reminder';
import './TaskItem.css';

const priorityColors = {
  P0: '#ef4444',
  P1: '#f59e0b',
  P2: '#9ca3af',
};

const statusLabels = {
  todo: '待办',
  'in-progress': '进行中',
  done: '已完成',
};

export default function TaskItem({ task, onEdit }) {
  const { updateTask, deleteTask } = useTaskContext();

  const handleStatusChange = (e) => {
    updateTask(task.id, { status: e.target.value });
  };

  const handleDelete = () => {
    if (window.confirm('Delete this task?')) {
      deleteTask(task.id);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const urgency = getReminderUrgency(task);

  const cardClass = [
    'task-item',
    task.status === 'done' ? 'done' : '',
    urgency === 'overdue' ? 'overdue-card' : '',
    urgency === 'urgent' ? 'urgent-card' : '',
    urgency === 'today' ? 'today-card' : '',
    urgency === 'upcoming' ? 'upcoming-card' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass}>
      <div className="task-main">
        <select
          className="task-status"
          value={task.status}
          onChange={handleStatusChange}
        >
          <option value="todo">待办</option>
          <option value="in-progress">进行中</option>
          <option value="done">已完成</option>
        </select>
      </div>

      <div className="task-content">
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
        </div>
      </div>

      <div className="task-actions">
        <button className="btn-edit" onClick={() => onEdit(task)}>编辑</button>
        <button className="btn-delete" onClick={handleDelete}>删除</button>
      </div>
    </div>
  );
}
