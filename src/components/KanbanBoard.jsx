import { useState, useCallback, useMemo, useRef } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { getReminderUrgency } from '../utils/reminder';
import { getAllProjects } from '../utils/projects';
import './KanbanBoard.css';
import KanbanSettingsModal from './KanbanSettingsModal';
import {
  getOrderedColumns,
  getLaneColors,
} from '../utils/kanbanSettings';

const DEFAULT_COLUMNS = [
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

function TaskCard({ task, onEdit, onDragStart, onDragEnd, isDragging, showDuration, onTouchDragStart, selected, onSelect }) {
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
        selected ? 'selected' : '',
      ].filter(Boolean).join(' ')}
      draggable={!blocked}
      onDragStart={blocked ? undefined : handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={(e) => {
        if (!blocked && onTouchDragStart) {
          onTouchDragStart(task.id, task.status);
        }
      }}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect(task.id);
        }
      }}
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

function SwimlaneGroup({ label, tasks, onEdit, draggingId, setDraggingId, showDuration, swimlaneWipLimit, project, laneColor, selectedIds, onSelect, selectMode }) {
  const [collapsed, setCollapsed] = useState(false);
  const overWip = swimlaneWipLimit > 0 && tasks.length >= swimlaneWipLimit;
  const displayLabel = project ? `${project.name}` : label;
  const labelStyle = project ? { color: project.color || laneColor || undefined } : {};
  const colorIndicator = laneColor ? { borderLeftColor: laneColor } : {};

  return (
    <div className={`swimlane ${overWip ? 'swimlane-over-wip' : ''}`} style={colorIndicator}>
      <div className="swimlane-header" onClick={() => setCollapsed((c) => !c)}>
        <span className={`swimlane-toggle ${collapsed ? 'collapsed' : ''}`}>▼</span>
        {laneColor && <span className="swimlane-color-dot" style={{ backgroundColor: laneColor }} />}
        <span className="swimlane-label" style={labelStyle}>
          {project ? `● ` : ''}{displayLabel}
        </span>
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
              selected={selectedIds.has(task.id)}
              onSelect={selectMode ? onSelect : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  column, tasks, onEdit, onAddTask, draggingId, setDraggingId, onDropTask,
  swimlaneBy, wipLimit, swimlaneWipLimits, touchDragging, onTouchDragEnd, onTouchDragMove,
  selectedIds, onSelectTask, onSelectAll, onDeselectAll, selectMode, allSelected,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [dropIndex, setDropIndex] = useState(-1);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [showAllLanes, setShowAllLanes] = useState(false);

  const sortedTasks = [...tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
  const overWip = wipLimit && tasks.length >= wipLimit;
  const laneColors = getLaneColors();

  const groups = useMemo(() => {
    if (swimlaneBy === 'none' || sortedTasks.length === 0) return null;
    const projects = getAllProjects();
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
    const map = new Map();
    sortedTasks.forEach((task) => {
      let key;
      if (swimlaneBy === 'tag') {
        key = task.tags.length > 0 ? task.tags[0] : '— 无标签 —';
      } else if (swimlaneBy === 'project') {
        key = task.projectId || '__no-project__';
      } else {
        key = task.priority;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(task);
    });
    const entries = [...map.entries()];
    entries.sort(([a], [b]) => {
      if (a === '— 无标签 —') return 1;
      if (b === '— 无标签 —') return -1;
      if (swimlaneBy === 'project') {
        if (a === '__no-project__') return 1;
        if (b === '__no-project__') return -1;
        const pa = projectMap[a];
        const pb = projectMap[b];
        return (pa?.name || '').localeCompare(pb?.name || '');
      }
      return String(a).localeCompare(String(b));
    });
    return entries.map(([key, groupTasks]) => ({
      key, groupTasks,
      wipLimit: swimlaneWipLimits ? (swimlaneWipLimits[key] || 0) : 0,
      project: swimlaneBy === 'project' ? (projectMap[key] || null) : null,
      laneColor: swimlaneBy === 'project' ? (laneColors[key] || null) : null,
    }));
  }, [sortedTasks, swimlaneBy, swimlaneWipLimits, laneColors]);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (overWip) return;
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

  const handleColumnSelectToggle = () => {
    if (allSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  const handleMoveTo = (targetColId) => {
    onMoveSelected(targetColId);
    setShowMoveMenu(false);
  };

  const handleCopyTo = (targetColId) => {
    onCopySelected(targetColId);
    setShowCopyMenu(false);
  };

  return (
    <div className={`kanban-column-wrapper ${isDragOver ? 'drag-over' : ''} ${overWip ? 'wip-exceeded' : ''}`}>
      <div className="kanban-column" style={overWip ? { borderColor: '#ef4444' } : {}}>
        <div className="kanban-column-header" style={{ borderColor: overWip ? '#ef4444' : column.color }}>
          <div className="kanban-column-header-left">
            <button
              className={`kanban-col-select-btn ${selectMode ? 'active' : ''}`}
              onClick={handleColumnSelectToggle}
              title={selectMode ? (allSelected ? '取消全选' : '全选') : '多选模式'}
            >
              {selectMode ? (allSelected ? '☑' : '☐') : '☐'}
            </button>
            <span className="kanban-column-title">{column.label}</span>
          </div>
          <span className="kanban-column-count" style={{ backgroundColor: overWip ? '#ef4444' : column.color }}>
            {tasks.length}{wipLimit ? `/${wipLimit}` : ''}
          </span>
        </div>

        <div
          className="kanban-column-content"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onTouchMove={onTouchDragMove}
          onTouchEnd={onTouchDragEnd}
          onClick={() => {
            if (selectMode && !allSelected) {
              // Clicking on column content in select mode with some selected - deselect all
              // But we only deselect if clicking on empty area (handled by child elements)
            }
          }}
        >
          {overWip && (
            <div className="kanban-wip-warning">⚠️ 已达 WIP 上限</div>
          )}
          {groups ? (
            <>
              {(showAllLanes ? groups : groups.slice(0, 6)).map(({ key, groupTasks, wipLimit, project, laneColor }) => (
                <SwimlaneGroup
                  key={key} label={key} tasks={groupTasks} onEdit={onEdit}
                  draggingId={draggingId} setDraggingId={setDraggingId}
                  showDuration={showDuration} swimlaneWipLimit={wipLimit}
                  project={project} laneColor={laneColor}
                  selectedIds={selectedIds}
                  onSelect={onSelectTask}
                  selectMode={selectMode}
                />
              ))}
              {groups.length > 6 && (
                <button
                  className="kanban-lane-toggle"
                  onClick={() => setShowAllLanes(!showAllLanes)}
                  style={{ display: 'block', width: '100%', padding: '8px', marginTop: 8, background: '#f0f0f0', border: 'none', cursor: 'pointer', textAlign: 'center' }}
                >
                  {showAllLanes ? '收起' : `查看更多 (${groups.length - 6})`}
                </button>
              )}
            </>
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
                  selected={selectedIds.has(task.id)}
                  onSelect={selectMode ? onSelectTask : undefined}
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

        {/* Move/Copy dropdown menus */}
        {showMoveMenu && (
          <div className="batch-action-menu">
            <div className="batch-action-menu-title">移动到...</div>
            {DEFAULT_COLUMNS.filter(c => c.id !== column.id).map(c => (
              <button key={c.id} className="batch-action-menu-item" onClick={() => handleMoveTo(c.id)}>
                <span className="batch-action-color" style={{ backgroundColor: c.color }} />
                {c.label}
              </button>
            ))}
            <button className="batch-action-menu-cancel" onClick={() => setShowMoveMenu(false)}>取消</button>
          </div>
        )}
        {showCopyMenu && (
          <div className="batch-action-menu">
            <div className="batch-action-menu-title">复制到...</div>
            {DEFAULT_COLUMNS.map(c => (
              <button key={c.id} className="batch-action-menu-item" onClick={() => handleCopyTo(c.id)}>
                <span className="batch-action-color" style={{ backgroundColor: c.color }} />
                {c.label}
              </button>
            ))}
            <button className="batch-action-menu-cancel" onClick={() => setShowCopyMenu(false)}>取消</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ onEditTask }) {
  const { allTasks, createTask, updateTask, reorderTasks, batchDeleteTasks, batchUpdateTasks } = useTaskContext();
  const [draggingId, setDraggingId] = useState(null);
  const [touchDragging, setTouchDragging] = useState(null);
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
  const boardRef = useRef(null);

  // Batch selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showBatchToolbar, setShowBatchToolbar] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);

  // Get ordered columns from settings
  const orderedColumns = useMemo(() => getOrderedColumns(), []);

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
      if (sourceStatus !== targetStatus && currentCount >= wip) return;
    }
    if (sourceStatus === targetStatus) {
      reorderTasks(taskId, newOrder);
    } else {
      const updates = { status: targetStatus, order: newOrder };
      if (targetStatus === 'in-progress') updates.startTime = new Date().toISOString();
      if (targetStatus === 'done') updates.endTime = new Date().toISOString();
      updateTask(taskId, updates);
    }
  }, [reorderTasks, updateTask, allTasks, wipLimits]);

  const handleAddTask = useCallback((columnId, title) => {
    // Use the first column in ordered columns if none specified - but here columnId is always provided
    createTask({ title, status: columnId, tags: [], priority: 'P1' });
  }, [createTask]);

  // Touch drag handlers
  const handleTouchDragStart = (taskId, sourceStatus) => {
    setTouchDragging({ taskId, sourceStatus });
    setDraggingId(taskId);
  };

  const handleTouchDragMove = (e) => {
    if (!touchDragging) return;
  };

  const handleTouchDragEnd = (e) => {
    if (!touchDragging || !boardRef.current) {
      setTouchDragging(null);
      setDraggingId(null);
      return;
    }

    const touch = e.changedTouches[0];
    const columns = boardRef.current.querySelectorAll('.kanban-column-content');
    let targetColumn = null;

    columns.forEach((col, idx) => {
      const rect = col.getBoundingClientRect();
      if (touch.clientX >= rect.left && touch.clientX <= rect.right) {
        targetColumn = orderedColumns[idx];
      }
    });

    if (targetColumn && targetColumn.id !== touchDragging.sourceStatus) {
      const tasksInColumn = allTasks.filter((t) => t.status === targetColumn.id);
      let newOrder;
      if (tasksInColumn.length === 0) {
        newOrder = Date.now();
      } else {
        newOrder = (tasksInColumn[tasksInColumn.length - 1].order || 0) + 1000;
      }
      handleDropTask(touchDragging.taskId, touchDragging.sourceStatus, targetColumn.id, newOrder);
    }

    setTouchDragging(null);
    setDraggingId(null);
  };

  // Batch selection handlers
  const handleSelectTask = useCallback((taskId) => {
    if (!selectMode) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, [selectMode]);

  const handleSelectAll = useCallback((columnId) => {
    const taskIds = allTasks.filter(t => t.status === columnId).map(t => t.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      taskIds.forEach(id => next.add(id));
      return next;
    });
  }, [allTasks]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`删除选中的 ${selectedIds.size} 个任务？`)) {
      batchDeleteTasks([...selectedIds]);
      setSelectedIds(new Set());
      setSelectMode(false);
      setShowBatchToolbar(false);
    }
  }, [selectedIds, batchDeleteTasks]);

  const handleMoveSelected = useCallback((targetStatus) => {
    if (selectedIds.size === 0) return;
    const updates = {};
    if (targetStatus === 'in-progress') updates.startTime = new Date().toISOString();
    if (targetStatus === 'done') updates.endTime = new Date().toISOString();
    batchUpdateTasks([...selectedIds], { status: targetStatus, ...updates });
    setSelectedIds(new Set());
    setSelectMode(false);
    setShowBatchToolbar(false);
  }, [selectedIds, batchUpdateTasks]);

  const handleCopySelected = useCallback((targetStatus) => {
    if (selectedIds.size === 0) return;
    const tasksToCopy = allTasks.filter(t => selectedIds.has(t.id));
    tasksToCopy.forEach(task => {
      createTask({
        ...task,
        id: undefined,
        status: targetStatus,
        title: task.title + ' (副本)',
        order: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startTime: targetStatus === 'in-progress' ? new Date().toISOString() : null,
        endTime: targetStatus === 'done' ? new Date().toISOString() : null,
      });
    });
    setSelectedIds(new Set());
    setSelectMode(false);
    setShowBatchToolbar(false);
  }, [selectedIds, allTasks, createTask]);

  // Toggle select mode when clicking column select button
  const handleToggleSelectMode = () => {
    if (!selectMode) {
      setSelectMode(true);
    } else {
      // If already in select mode, just deselect all
      setSelectedIds(new Set());
    }
  };

  // Show batch toolbar when there are selected items
  const selectedCount = selectedIds.size;

  return (
    <div className="kanban-board-wrapper" ref={boardRef}>
      <div className="kanban-swimlane-controls">
        <span>泳道分组：</span>
        <select value={swimlaneBy} onChange={handleSwimlaneChange}>
          <option value="none">无</option>
          <option value="tag">按标签</option>
          <option value="priority">按优先级</option>
          <option value="project">按项目</option>
        </select>
        <span style={{ marginLeft: 16 }}>WIP：</span>
        {orderedColumns.map((col) => (
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
        {orderedColumns.map((col) => {
          const tasks = allTasks.filter((t) => t.status === col.id);
          const columnSelectedCount = tasks.filter(t => selectedIds.has(t.id)).length;
          const allColumnSelected = tasks.length > 0 && columnSelectedCount === tasks.length;
          return (
            <KanbanColumn
              key={col.id} column={col} tasks={tasks} onEdit={onEditTask}
              onAddTask={handleAddTask} draggingId={draggingId}
              setDraggingId={setDraggingId} onDropTask={handleDropTask}
              swimlaneBy={swimlaneBy} wipLimit={wipLimits[col.id] || 0}
              swimlaneWipLimits={swimlaneWipLimits}
              touchDragging={touchDragging}
              onTouchDragEnd={handleTouchDragEnd}
              onTouchDragMove={handleTouchDragMove}
              selectedIds={selectedIds}
              onSelectTask={handleSelectTask}
              onSelectAll={() => handleSelectAll(col.id)}
              onDeselectAll={handleDeselectAll}
              selectMode={selectMode}
              allSelected={allColumnSelected}
              onMoveSelected={handleMoveSelected}
              onCopySelected={handleCopySelected}
            />
          );
        })}
      </div>

      {/* Batch Action Toolbar */}
      {selectMode && selectedCount > 0 && (
        <div className="batch-toolbar">
          <span className="batch-toolbar-count">已选择 {selectedCount} 个任务</span>
          <div className="batch-toolbar-actions">
            <button className="batch-btn batch-btn-move" onClick={() => setMoveTarget('move')}>
              移动到
            </button>
            <button className="batch-btn batch-btn-copy" onClick={() => setMoveTarget('copy')}>
              复制到
            </button>
            <button className="batch-btn batch-btn-delete" onClick={handleDeleteSelected}>
              删除
            </button>
            <button className="batch-btn batch-btn-cancel" onClick={() => {
              setSelectedIds(new Set());
              setSelectMode(false);
            }}>
              取消
            </button>
          </div>

          {/* Move/Copy target column selector */}
          {moveTarget && (
            <div className="batch-target-selector">
              <span className="batch-target-label">{moveTarget === 'move' ? '移动到：' : '复制到：'}</span>
              {orderedColumns.map(col => (
                <button
                  key={col.id}
                  className="batch-target-btn"
                  style={{ borderColor: col.color, backgroundColor: `${col.color}20` }}
                  onClick={() => {
                    if (moveTarget === 'move') handleMoveSelected(col.id);
                    else handleCopySelected(col.id);
                    setMoveTarget(null);
                  }}
                >
                  {col.label}
                </button>
              ))}
              <button className="batch-target-cancel" onClick={() => setMoveTarget(null)}>取消</button>
            </div>
          )}
        </div>
      )}

      {/* Select mode hint */}
      {selectMode && selectedCount === 0 && (
        <div className="select-mode-hint">
          点击列头部的 ☐ 进入多选，点击任务卡片选中。点击"取消"退出多选模式。
        </div>
      )}
    </div>
  );
}
