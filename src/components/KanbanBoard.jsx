import { useState, useCallback, useMemo } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { getReminderUrgency } from '../utils/reminder';
import './KanbanBoard.css';
import KanbanSettingsModal from './KanbanSettingsModal';

const COLUMNS = [
  { id: 'todo', label: '待办', color: '#06b6d4' },
  { id: 'in-progress', label: '进行中', color: '#f59e0b' },
  { id: 'done', label: '已完成', color: '#22c55e' },
];

const priorityColors = { P0: '#ef4444', P1: '#f59e0b', P2: '#9ca3b8' };

function formatDuration(ms) {
  if (!ms || ms <= 0) return null;
  const m = Math.floor(ms / 60000);
  if (m < 1) return '< 1 分钟';
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h} 小时`;
}

function TaskCard({ task, onEdit, onDragStart, onDragEnd, isDragging, showDuration }) {
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

  const handleDragEnd = () => { if (onDragEnd) onDragEnd(); };

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

  // Duration
  let durationStr = null;
  if (showDuration && task.startTime && task.endTime) {
    const ms = new Date(task.endTime) - new Date(task.startTime);
    durationStr = formatDuration(ms);
  } else if (showDuration && task.startTime && task.status === 'in-progress') {
    const ms = Date.now() - new Date(task.startTime);
    durationStr = formatDuration(ms) + ' (进行中)';
  }

  return (
    <div
      className={[
        'kanban-card',
        isDragging ? 'dragging' : '',
        blocked ? 'blocked' : '',
        urgency === 'overdue' ? 'overdue-card' : '',
        urgency === 'urgent' ? 'urgent-card' : '',
        urgency === 'today' ? 'today-card' : '',
        urgency === 'upcoming' ? 'upcoming-card' : '',
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
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {urgency === 'overdue' && (
            <span className="overdue-badge" title="已逾期">🔴 逾期</span>
          )}
          {blocked && <span className="blocked-icon" title="等待依赖">🔒</span>}
          {isHovered && !blocked && (
            <button className="kanban-btn-delete" onClick={handleDelete}>×</button>
          )}
        </div>
      </div>
      <div className="kanban-card-title">{task.title}</div>
      {task.content && <div className="kanban-card-desc">{task.content}</div>}
      <div className="kanban-card-meta">
        {task.tags.length > 0 && (
          <div className="kanban-tags">
            {task.tags.map((tag) => <span key={tag} className="kanban-tag">{tag}</span>)}
          </div>
        )}
        {task.dueDate && (
          <span className={`kanban-due ${urgency === 'overdue' ? 'overdue' : ''}`}>
            📅 {formatDate(task.dueDate)}
            {urgency === 'overdue' && ' ⚠️'}
            {urgency === 'urgent' && ' 🔥'}
          </span>
        )}
        {totalSubs > 0 && (
          <span className={`kanban-subtask-badge ${completedSubs === totalSubs ? 'all-done' : ''}`}>
            ☑️ {completedSubs}/{totalSubs}
          </span>
        )}
        {durationStr && (
          <span className="kanban-duration">⏱ {durationStr}</span>
        )}
      </div>
      <div className="kanban-card-actions">
        <button className="btn-edit" onClick={() => onEdit(task)}>编辑</button>
      </div>
    </div>
  );
}

function SwimlaneGroup({ label, tasks, onEdit, draggingId, setDraggingId, showDuration, swimlaneWipLimit }) {
  const [collapsed, setCollapsed] = useState(false);
  const overWip = swimlaneWipLimit > 0 && tasks.length >= swimlaneWipLimit;

  return (
    <div className={`swimlane ${overWip ? 'swimlane-over-wip' : ''}`}>
      <div className="swimlane-header" onClick={() => setCollapsed((c) => !c)}>
        <span className={`swimlane-toggle ${collapsed ? 'collapsed' : ''}`}>▼</span>
        <span className="swimlane-label">{label}</span>
        <span className="swimlane-count" style={overWip ? { backgroundColor: '#ef4444' } : {}}>
          {tasks.length}{swimlaneWipLimit > 0 ? `/${swimlaneWipLimit}` : ''}
        </span>
      </div>
      {overWip && !collapsed && (
        <div className="swimlane-wip-warning">⚠️ 泳道已达 WIP 上限</div>
      )}
      {!collapsed && (
        <div className="swimlane-cards">
          {tasks.map((task) => (
            <TaskCard
              key={task.id} task={task} onEdit={onEdit}
              isDragging={draggingId === task.id}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
              showDuration={showDuration}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ column, tasks, onEdit, onAddTask, draggingId, setDraggingId, onDropTask, swimlaneBy, wipLimit, swimlaneWipLimits }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [dropIndex, setDropIndex] = useState(-1);

  const sortedTasks = [...tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
  const overWip = wipLimit && tasks.length >= wipLimit;

  const groups = useMemo(() => {
    if (swimlaneBy === 'none' || sortedTasks.length === 0) return null;
    const map = new Map();
    sortedTasks.forEach((task) => {
      const key = swimlaneBy === 'tag'
        ? (task.tags.length > 0 ? task.tags[0] : '— 无标签 —')
        : task.priority;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(task);
    });
    const entries = [...map.entries()];
    entries.sort(([a], [b]) => {
      if (a === '— 无标签 —') return 1;
      if (b === '— 无标签 —') return -1;
      return String(a).localeCompare(String(b));
    });
    return entries.map(([key, groupTasks]) => ({
      key, groupTasks,
      wipLimit: swimlaneWipLimits ? (swimlaneWipLimits[key] || 0) : 0,
    }));
  }, [sortedTasks, swimlaneBy, swimlaneWipLimits]);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (overWip) return; // WIP limit reached — reject drop
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
    if (!groups) { setDropIndex(-1); return; }
    const cards = e.currentTarget.querySelectorAll('.kanban-card:not(.dragging)');
    let idx = sortedTasks.length;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) { idx = i; break; }
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
    if (overWip) { setIsDragOver(false); return; }
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    const sourceStatus = e.dataTransfer.getData('sourceStatus');
    let newOrder;
    if (sortedTasks.length === 0 || dropIndex === 0 || dropIndex === -1) {
      newOrder = sortedTasks.length > 0 ? (sortedTasks[0].order || 0) - 1000 : Date.now();
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
    if (newTaskTitle.trim()) { onAddTask(column.id, newTaskTitle.trim()); setNewTaskTitle(''); }
  };

  const showDuration = column.id === 'done' || column.id === 'in-progress';

  return (
    <div className={`kanban-column-wrapper ${isDragOver ? 'drag-over' : ''} ${overWip ? 'wip-exceeded' : ''}`}>
      <div className="kanban-column" style={overWip ? { borderColor: '#ef4444' } : {}}>
        <div className="kanban-column-header" style={{ borderColor: overWip ? '#ef4444' : column.color }}>
          <span className="kanban-column-title">{column.label}</span>
          <span className="kanban-column-count" style={{ backgroundColor: overWip ? '#ef4444' : column.color }}>
            {tasks.length}{wipLimit ? `/${wipLimit}` : ''}
          </span>
        </div>

        <div
          className="kanban-column-content"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {overWip && (
            <div className="kanban-wip-warning">⚠️ 已达 WIP 上限</div>
          )}
          {groups ? (
            groups.map(({ key, groupTasks, wipLimit }) => (
              <SwimlaneGroup
                key={key} label={key} tasks={groupTasks} onEdit={onEdit}
                draggingId={draggingId} setDraggingId={setDraggingId}
                showDuration={showDuration} swimlaneWipLimit={wipLimit}
              />
            ))
          ) : (
            sortedTasks.map((task, i) => (
              <div key={task.id}>
                {dropIndex === i && !overWip && <div className="kanban-drop-placeholder" />}
                <TaskCard
                  task={task} onEdit={onEdit}
                  isDragging={draggingId === task.id}
                  onDragStart={setDraggingId}
                  onDragEnd={() => { setDraggingId(null); setDropIndex(-1); }}
                  showDuration={showDuration}
                />
              </div>
            ))
          )}
          {dropIndex === sortedTasks.length && !overWip && <div className="kanban-drop-placeholder" />}
          {sortedTasks.length === 0 && !draggingId && !overWip && (
            <div className="kanban-empty">暂无任务</div>
          )}
        </div>

        <form className="kanban-add-task" onSubmit={handleAddTask}>
          <input
            type="text" placeholder={`添加任务到 ${column.label}...`}
            value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
          />
          <button type="submit">+</button>
        </form>
      </div>
    </div>
  );
}

export default function KanbanBoard({ onEditTask }) {
  const { allTasks, createTask, updateTask, reorderTasks } = useTaskContext();
  const [draggingId, setDraggingId] = useState(null);
  const [swimlaneBy, setSwimlaneBy] = useState(() => localStorage.getItem('kanban-swimlane') || 'none');
  const [wipLimits, setWipLimits] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kanban-wip') || '{"todo":0,"in-progress":3,"done":0}'); }
    catch { return { todo: 0, 'in-progress': 3, done: 0 }; }
  });
  const [swimlaneWipLimits, setSwimlaneWipLimits] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kanban-swimlane-wip') || '{}'); }
    catch { return {}; }
  });
  const [showSettings, setShowSettings] = useState(false);

  const handleSwimlaneChange = (e) => {
    const val = e.target.value;
    setSwimlaneBy(val);
    localStorage.setItem('kanban-swimlane', val);
  };

  const handleWipChange = (colId, val) => {
    const updated = { ...wipLimits, [colId]: Math.max(0, parseInt(val) || 0) };
    setWipLimits(updated);
    localStorage.setItem('kanban-wip', JSON.stringify(updated));
  };

  const handleSwimlaneWipChange = (key, val) => {
    const updated = { ...swimlaneWipLimits, [key]: Math.max(0, parseInt(val) || 0) };
    setSwimlaneWipLimits(updated);
    localStorage.setItem('kanban-swimlane-wip', JSON.stringify(updated));
  };

  const handleDropTask = useCallback((taskId, sourceStatus, targetStatus, newOrder) => {
    const wip = wipLimits[targetStatus];
    if (wip > 0) {
      const currentCount = allTasks.filter((t) => t.status === targetStatus).length;
      if (sourceStatus !== targetStatus && currentCount >= wip) return; // blocked by WIP
    }
    if (sourceStatus === targetStatus) {
      reorderTasks(taskId, newOrder);
    } else {
      // Auto-set timestamps on status transitions
      const updates = { status: targetStatus, order: newOrder };
      if (targetStatus === 'in-progress') updates.startTime = new Date().toISOString();
      if (targetStatus === 'done') updates.endTime = new Date().toISOString();
      updateTask(taskId, updates);
    }
  }, [reorderTasks, updateTask, allTasks, wipLimits]);

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
        <span style={{ marginLeft: 16 }}>WIP：</span>
        {COLUMNS.map((col) => (
          <span key={col.id} className="wip-limit-input">
            <label style={{ fontSize: 12 }}>{col.label}</label>
            <input
              type="number" min="0" max="99"
              value={wipLimits[col.id] || 0}
              onChange={(e) => handleWipChange(col.id, e.target.value)}
              style={{ width: 40, padding: '2px 4px', fontSize: 12 }}
            />
          </span>
        ))}
        <button className="kanban-settings-btn" onClick={() => setShowSettings(true)}>
          ⚙️ 看板设置
        </button>
      </div>
      {showSettings && (
        <KanbanSettingsModal
          swimlaneBy={swimlaneBy}
          wipLimits={wipLimits}
          swimlaneWipLimits={swimlaneWipLimits}
          onClose={() => setShowSettings(false)}
          onSwimlaneChange={handleSwimlaneChange}
          onWipChange={handleWipChange}
          onSwimlaneWipChange={handleSwimlaneWipChange}
        />
      )}
      <div className="kanban-board">
        {COLUMNS.map((col) => {
          const tasks = allTasks.filter((t) => t.status === col.id);
          return (
            <KanbanColumn
              key={col.id} column={col} tasks={tasks} onEdit={onEditTask}
              onAddTask={handleAddTask} draggingId={draggingId}
              setDraggingId={setDraggingId} onDropTask={handleDropTask}
              swimlaneBy={swimlaneBy} wipLimit={wipLimits[col.id] || 0}
              swimlaneWipLimits={swimlaneWipLimits}
            />
          );
        })}
      </div>
    </div>
  );
}
