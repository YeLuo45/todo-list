import { useState, useCallback, useMemo } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { getReminderUrgency } from '../utils/reminder';
import './KanbanBoard.css';

const COLUMNS = [
  { id: 'todo', label: '待办', color: '#06b6d4' },
  { id: 'in-progress', label: '进行中', color: '#f59e0b' },
  { id: 'done', label: '已完成', color: '#22c55e' },
];

const priorityColors = { P0: '#ef4444', P1: '#f59e0b', P2: '#9ca3b8' };

function TaskCard({ task, onEdit, onDragStart, onDragEnd, isDragging }) {
  const { deleteTask, isTaskBlocked } = useTaskContext();
  const [isHovered, setIsHovered] = useState(false);
  const blocked = isTaskBlocked(task.id);

  const handleDragStart = (e) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('sourceStatus', task.status);
    e.dataTransfer.setData('sourceOrder', String(task.order));
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(task.id);
  };

  const handleDragEnd = () => {
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

  const urgency = getReminderUrgency(task);
  const completedSubs = (task.subtasks || []).filter((s) => s.done).length;
  const totalSubs = (task.subtasks || []).length;

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
        blocked ? 'blocked' : '',
      ].filter(Boolean).join(' ')}
      draggable={!blocked}
      onDragStart={blocked ? undefined : handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="kanban-card-header">
        <span className="kanban-priority" style={{ backgroundColor: priorityColors[task.priority] }}>
          {task.priority}
        </span>
        {blocked && <span className="blocked-icon" title="等待依赖任务完成">🔒</span>}
        {isHovered && !blocked && (
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
        {totalSubs > 0 && (
          <span className={`kanban-subtask-badge ${completedSubs === totalSubs ? 'all-done' : ''}`}>
            ☑️ {completedSubs}/{totalSubs}
          </span>
        )}
      </div>
      <div className="kanban-card-actions">
        <button className="btn-edit" onClick={() => onEdit(task)}>编辑</button>
      </div>
    </div>
  );
}

function SwimlaneGroup({ label, tasks, onEdit, draggingId, setDraggingId }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="swimlane">
      <div className="swimlane-header" onClick={() => setCollapsed((c) => !c)}>
        <span className={`swimlane-toggle ${collapsed ? 'collapsed' : ''}`}>▼</span>
        <span className="swimlane-label">{label}</span>
        <span className="swimlane-count">{tasks.length}</span>
      </div>
      {!collapsed && (
        <div className="swimlane-cards">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              isDragging={draggingId === task.id}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ column, tasks, onEdit, onAddTask, draggingId, setDraggingId, onDropTask, swimlaneBy }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [dropIndex, setDropIndex] = useState(-1);

  const sortedTasks = [...tasks].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Group tasks for swimlanes
  const groups = useMemo(() => {
    if (swimlaneBy === 'none' || sortedTasks.length === 0) return null;

    const map = new Map();
    sortedTasks.forEach((task) => {
      let key;
      if (swimlaneBy === 'tag') {
        // Group by first tag, '无标签' if none
        key = task.tags.length > 0 ? task.tags[0] : '— 无标签 —';
      } else if (swimlaneBy === 'priority') {
        key = task.priority;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(task);
    });

    // Sort groups: specific values first, then '— 无标签 —'
    const entries = [...map.entries()];
    entries.sort(([a], [b]) => {
      if (a === '— 无标签 —') return 1;
      if (b === '— 无标签 —') return -1;
      return String(a).localeCompare(String(b));
    });
    return entries;
  }, [sortedTasks, swimlaneBy]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);

    if (!groups) {
      setDropIndex(-1);
      return;
    }

    // In swimlane mode, find which swimlane we're over
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

    let newOrder;
    if (sortedTasks.length === 0) {
      newOrder = Date.now();
    } else if (dropIndex === 0 || dropIndex === -1) {
      newOrder = (sortedTasks[0].order || 0) - 1000;
    } else if (dropIndex >= sortedTasks.length) {
      newOrder = (sortedTasks[sortedTasks.length - 1].order || 0) + 1000;
    } else {
      const before = sortedTasks[Math.max(0, dropIndex - 1)].order || 0;
      const after = sortedTasks[dropIndex].order || 0;
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
        {groups ? (
          // Swimlane mode
          groups.map(([label, groupTasks]) => (
            <SwimlaneGroup
              key={label}
              label={label}
              tasks={groupTasks}
              onEdit={onEdit}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
            />
          ))
        ) : (
          // Flat mode
          sortedTasks.map((task, i) => (
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
          ))
        )}
        {dropIndex === sortedTasks.length && <div className="kanban-drop-placeholder" />}
        {sortedTasks.length === 0 && !draggingId && (
          <div className="kanban-empty">暂无任务</div>
        )}
      </div>

      <form className="kanban-add-task" onSubmit={handleAddTask}>
        <input
          type="text"
          placeholder={`添加任务到 ${column.label}...`}
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
  const [swimlaneBy, setSwimlaneBy] = useState(() => localStorage.getItem('kanban-swimlane') || 'none');

  const handleSwimlaneChange = (e) => {
    const val = e.target.value;
    setSwimlaneBy(val);
    localStorage.setItem('kanban-swimlane', val);
  };

  const handleDropTask = useCallback((taskId, sourceStatus, targetStatus, newOrder) => {
    if (sourceStatus === targetStatus) {
      reorderTasks(taskId, newOrder);
    } else {
      updateTask(taskId, { status: targetStatus, order: newOrder });
    }
  }, [reorderTasks, updateTask]);

  const handleAddTask = useCallback((columnId, title) => {
    createTask({ title, status: columnId, tags: [], priority: 'P1' });
  }, [createTask]);

  return (
    <div>
      <div className="kanban-swimlane-controls">
        <span>泳道分组：</span>
        <select value={swimlaneBy} onChange={handleSwimlaneChange}>
          <option value="none">无</option>
          <option value="tag">按标签</option>
          <option value="priority">按优先级</option>
        </select>
      </div>
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
              swimlaneBy={swimlaneBy}
            />
          );
        })}
      </div>
    </div>
  );
}
