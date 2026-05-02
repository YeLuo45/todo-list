import { useState, useCallback } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { getReminderUrgency } from '../utils/reminder';
import './KanbanBoard.css';

const COLUMNS = [
  { id: 'todo', label: '待办 (Todo)', color: '#06b6d4' },
  { id: 'in-progress', label: '进行中 (In Progress)', color: '#f59e0b' },
  { id: 'done', label: '已完成 (Done)', color: '#22c55e' },
];

const priorityColors = { P0: '#ef4444', P1: '#f59e0b', P2: '#9ca3b8' };

function TaskCard({ task, onEdit, onDragStart, onDragEnd, isDragging }) {
  const { deleteTask } = useTaskContext();
  const [isHovered, setIsHovered] = useState(false);

  const handleDragStart = (e) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('sourceStatus', task.status);
    e.dataTransfer.setData('sourceOrder', String(task.order));
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(task.id);
  };

  const handleDragEnd = (e) => {
    if (onDragEnd) onDragEnd();
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm('删除此任务？')) deleteTask(task.id);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const isOverdue = () => {
    if (!task.dueDate || task.status === 'done') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(task.dueDate) < today;
  };

  const urgency = getReminderUrgency(task);

  return (
    <div
      className={[
        'kanban-card',
        isDragging ? 'dragging' : '',
        isHovered ? 'hovered' : '',
        urgency === 'overdue' ? 'overdue-card' : '',
        urgency === 'urgent' ? 'urgent-card' : '',
        urgency === 'today' ? 'today-card' : '',
        urgency === 'upcoming' ? 'upcoming-card' : '',
      ].filter(Boolean).join(' ')}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="kanban-card-header">
        <span className="kanban-priority" style={{ backgroundColor: priorityColors[task.priority] }}>
          {task.priority}
        </span>
        {isHovered && (
          <button className="kanban-btn-delete" onClick={handleDelete}>×</button>
        )}
      </div>
      <div className="kanban-card-title">{task.title}</div>
      {task.content && <div className="kanban-card-desc">{task.content}</div>}
      <div className="kanban-card-meta">
        {task.tags.length > 0 && (
          <div className="kanban-tags">
            {task.tags.map((tag) => (
              <span key={tag} className="kanban-tag">{tag}</span>
            ))}
          </div>
        )}
        {task.dueDate && (
          <span className={`kanban-due ${urgency === 'overdue' ? 'overdue' : ''} ${urgency === 'urgent' ? 'urgent' : ''}`}>
            📅 {formatDate(task.dueDate)}
            {urgency === 'overdue' && ' ⚠️'}
            {urgency === 'urgent' && ' 🔥'}
            {urgency === 'today' && ' 📌'}
            {urgency === 'upcoming' && ' ⏰'}
          </span>
        )}
      </div>
      <div className="kanban-card-actions">
        <button className="btn-edit" onClick={() => onEdit(task)}>编辑</button>
      </div>
    </div>
  );
}

function KanbanColumn({ column, tasks, onEdit, onAddTask, draggingId, setDraggingId, onDropTask }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [dropIndex, setDropIndex] = useState(-1);

  const sortedTasks = [...tasks].sort((a, b) => (a.order || 0) - (b.order || 0));

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);

    // 计算放置位置
    const cards = e.currentTarget.querySelectorAll('.kanban-card:not(.dragging)');
    let idx = sortedTasks.length;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) { idx = i; break; }
    }
    setDropIndex(idx);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
      setDropIndex(-1);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    const sourceStatus = e.dataTransfer.getData('sourceStatus');
    const sourceOrder = parseInt(e.dataTransfer.getData('sourceOrder') || '0', 10);

    // 计算新 order
    const cards = e.currentTarget.querySelectorAll('.kanban-card:not(.dragging)');
    let idx = sortedTasks.length;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) { idx = i; break; }
    }

    // 计算 targetOrder（插入位置前一个和后一个的 order 平均值）
    let newOrder;
    if (sortedTasks.length === 0) {
      newOrder = Date.now();
    } else if (idx === 0) {
      newOrder = (sortedTasks[0].order || 0) - 1000;
    } else if (idx >= sortedTasks.length) {
      newOrder = (sortedTasks[sortedTasks.length - 1].order || 0) + 1000;
    } else {
      const before = sortedTasks[idx - 1].order || 0;
      const after = sortedTasks[idx].order || 0;
      newOrder = (before + after) / 2;
    }

    onDropTask(taskId, sourceStatus, column.id, newOrder);
    setDropIndex(-1);
    setDraggingId(null);
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      onAddTask(column.id, newTaskTitle.trim());
      setNewTaskTitle('');
    }
  };

  return (
    <div className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}>
      <div className="kanban-column-header" style={{ borderColor: column.color }}>
        <span className="kanban-column-title">{column.label}</span>
        <span className="kanban-column-count" style={{ backgroundColor: column.color }}>
          {tasks.length}
        </span>
      </div>

      <div
        className="kanban-column-content"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {sortedTasks.map((task, i) => (
          <div key={task.id}>
            {dropIndex === i && <div className="kanban-drop-placeholder" />}
            <TaskCard
              task={task}
              onEdit={onEdit}
              isDragging={draggingId === task.id}
              onDragStart={setDraggingId}
              onDragEnd={() => { setDraggingId(null); setDropIndex(-1); }}
            />
          </div>
        ))}
        {dropIndex === sortedTasks.length && <div className="kanban-drop-placeholder" />}
        {sortedTasks.length === 0 && !draggingId && (
          <div className="kanban-empty">暂无任务</div>
        )}
      </div>

      <form className="kanban-add-task" onSubmit={handleAddTask}>
        <input
          type="text"
          placeholder={`添加任务到 ${column.label.split(' ')[0]}...`}
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
        />
        <button type="submit">+</button>
      </form>
    </div>
  );
}

export default function KanbanBoard({ onEditTask }) {
  const { allTasks, createTask, updateTask, reorderTasks } = useTaskContext();
  const [draggingId, setDraggingId] = useState(null);

  const handleDropTask = useCallback((taskId, sourceStatus, targetStatus, newOrder) => {
    if (sourceStatus === targetStatus) {
      // 列内重排序
      reorderTasks(taskId, newOrder);
    } else {
      // 跨列移动：更新 status + order
      updateTask(taskId, { status: targetStatus, order: newOrder });
    }
  }, [reorderTasks, updateTask]);

  const handleAddTask = useCallback((columnId, title) => {
    createTask({ title, status: columnId, tags: [], priority: 'P1' });
  }, [createTask]);

  return (
    <div className="kanban-board">
      {COLUMNS.map((col) => {
        const tasks = allTasks.filter((t) => t.status === col.id);
        return (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasks}
            onEdit={onEditTask}
            onAddTask={handleAddTask}
            draggingId={draggingId}
            setDraggingId={setDraggingId}
            onDropTask={handleDropTask}
          />
        );
      })}
    </div>
  );
}
