import { useTaskContext } from '../context/TaskContext';
import './TaskItem.css';

const priorityColors = {
  high: '#e53935',
  medium: '#fb8c00',
  low: '#43a047',
};

const statusLabels = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
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

  const isOverdue = () => {
    if (!task.dueDate || task.status === 'done') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    return due < today;
  };

  return (
    <div className={`task-item ${task.status === 'done' ? 'done' : ''}`}>
      <div className="task-main">
        <select
          className="task-status"
          value={task.status}
          onChange={handleStatusChange}
        >
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <div className="task-content">
          <div className="task-header">
            <span className="task-title">{task.title}</span>
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
              <span className={`task-due ${isOverdue() ? 'overdue' : ''}`}>
                📅 {formatDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>

        <div className="task-actions">
          <button className="btn-edit" onClick={() => onEdit(task)}>Edit</button>
          <button className="btn-delete" onClick={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}
