import { useState, useCallback } from 'react';
import { useTaskContext } from '../context/TaskContext';
import './KanbanBoard.css';

const COLUMNS = [
  { id: 'todo', label: '待办 (Todo)', color: '#06b6d4' },
  { id: 'in-progress', label: '进行中 (In Progress)', color: '#f59e0b' },
  { id: 'done', label: '已完成 (Done)', color: '#22c55e' },
];

const priorityColors = {
  P0: '#ef4444',
  P1: '#f59e0b',
  P2: '#9ca3af',
};

function TaskCard({ task, onEdit, onDragStart, onDragEnd }) {
  const { deleteTask } = useTaskContext();

  const handleDragStart = (e) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('sourceStatus', task.status);
    e.currentTarget.classList.add('dragging');
    if (onDragStart) onDragStart(task.id);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    if (onDragEnd) onDragEnd();
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm('删除此任务？')) {
      deleteTask(task.id);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const isOverdue = () => {
    if (!task.dueDate || task.status === 'done') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    return due < today;
  };

  return (
    <div
      className="kanban-card"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-card-header">
        <span
          className="kanban-priority"
          style={{ backgroundColor: priorityColors[task.priority] }}
        >
          {task.priority}
        </span>
        <button className="kanban-btn-delete" onClick={handleDelete}>×</button>
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
          <span className={`kanban-due ${isOverdue() ? 'overdue' : ''}`}>
            📅 {formatDate(task.dueDate)}
          </span>
        )}
      </div>
      <div className="kanban-card-actions">
        <button className="btn-edit" onClick={() => onEdit(task)}>编辑</button>
      </div>
    </div>
  );
}

function KanbanColumn({ column, tasks, onEdit, onAddTask, draggingId, setDraggingId }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    // Drop handling is done in KanbanBoard's handleDrop
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      onAddTask(column.id, newTaskTitle.trim());
      setNewTaskTitle('');
    }
  };

  return (
    <div
      className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="kanban-column-header" style={{ borderColor: column.color }}>
        <span className="kanban-column-title">{column.label}</span>
        <span className="kanban-column-count" style={{ backgroundColor: column.color }}>
          {tasks.length}
        </span>
      </div>
      <div className="kanban-column-content">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDragStart={setDraggingId}
            onDragEnd={() => setDraggingId(null)}
          />
        ))}
        {tasks.length === 0 && !draggingId && (
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
  const { allTasks, createTask, updateTask } = useTaskContext();
  const [draggingId, setDraggingId] = useState(null);

  const handleDrop = useCallback((targetColumnId) => {
    if (!draggingId) return;
    const task = allTasks.find((t) => t.id === draggingId);
    if (task && task.status !== targetColumnId) {
      updateTask(draggingId, { status: targetColumnId });
    }
    setDraggingId(null);
  }, [draggingId, allTasks, updateTask]);

  const handleDragStart = useCallback((taskId) => {
    setDraggingId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
  }, []);

  const handleAddTask = useCallback((columnId, title) => {
    createTask({ title, status: columnId, tags: [], priority: 'P1' });
  }, [createTask]);

  // Attach drop handler to each column's drop zone
  const renderColumn = (column) => {
    const tasks = allTasks.filter((t) => t.status === column.id);
    return (
      <KanbanColumn
        key={column.id}
        column={column}
        tasks={tasks}
        onEdit={onEditTask}
        onAddTask={handleAddTask}
        draggingId={draggingId}
        setDraggingId={setDraggingId}
      />
    );
  };

  return (
    <div className="kanban-board">
      {COLUMNS.map((col) => {
        const tasks = allTasks.filter((t) => t.status === col.id);
        const isOver = draggingId && col.id !== allTasks.find(t => t.id === draggingId)?.status;
        return (
          <div
            key={col.id}
            className={`kanban-column-wrapper ${isOver ? 'drop-target' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggingId) e.currentTarget.classList.add('drag-over');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('drag-over');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              handleDrop(col.id);
            }}
          >
            <KanbanColumn
              column={col}
              tasks={tasks}
              onEdit={onEditTask}
              onAddTask={handleAddTask}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
            />
          </div>
        );
      })}
    </div>
  );
}
