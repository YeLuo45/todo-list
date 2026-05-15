import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { getReminderUrgency } from '../utils/reminder';
import { getAllProjects } from '../utils/projects';
import GanttSettingsModal from './GanttSettingsModal';
import './GanttChart.css';

const DAY_WIDTH_BASE = 40;
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 60;

const COLUMN_STORAGE_KEY = 'hermes_gantt_columns';

const DEFAULT_COLUMNS = [
  { id: 'title', label: '任务名', visible: true },
  { id: 'assignee', label: '负责人', visible: true },
  { id: 'startDate', label: '开始日期', visible: true },
  { id: 'endDate', label: '结束日期', visible: true },
  { id: 'progress', label: '进度', visible: false },
  { id: 'status', label: '状态', visible: false },
  { id: 'priority', label: '优先级', visible: true },
];

function getDays(start, end) {
  const days = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function formatDay(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isToday(date) {
  const t = new Date();
  return date.getFullYear() === t.getFullYear() &&
    date.getMonth() === t.getMonth() &&
    date.getDate() === t.getDate();
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function nextInstance(interval, from) {
  const d = new Date(from);
  if (interval === 'daily') d.setDate(d.getDate() + 1);
  else if (interval === 'weekly') d.setDate(d.getDate() + 7);
  else if (interval === 'monthly') d.setMonth(d.getMonth() + 1);
  return d;
}

// Critical Path Algorithm
function findCriticalPath(tasks) {
  if (!tasks || tasks.length === 0) return new Set();

  const taskMap = new Map();
  tasks.forEach(t => taskMap.set(t.id, t));

  // Build dependency graph
  const graph = new Map();
  const inDegree = new Map();
  tasks.forEach(t => {
    graph.set(t.id, []);
    inDegree.set(t.id, 0);
  });

  tasks.forEach(t => {
    if (t.dependsOn && t.dependsOn.length > 0) {
      t.dependsOn.forEach(depId => {
        if (taskMap.has(depId)) {
          graph.get(depId).push(t.id);
          inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
        }
      });
    }
  });

  // Find start nodes (no dependencies)
  const startNodes = tasks.filter(t => !t.dependsOn || t.dependsOn.length === 0);

  // If no start nodes, treat all as starts
  if (startNodes.length === 0) return new Set();

  // Topological sort with longest path tracking
  const dist = new Map();
  const prev = new Map();
  tasks.forEach(t => dist.set(t.id, 0));

  const queue = startNodes.map(id => id);
  startNodes.forEach(id => dist.set(id, 1));

  while (queue.length > 0) {
    const curr = queue.shift();
    const neighbors = graph.get(curr) || [];
    for (const neighbor of neighbors) {
      const currDist = dist.get(curr) || 0;
      const neighborDist = dist.get(neighbor) || 0;
      if (currDist + 1 > neighborDist) {
        dist.set(neighbor, currDist + 1);
        prev.set(neighbor, curr);
      }
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Find the longest path
  let maxDist = 0;
  let endNode = null;
  dist.forEach((d, id) => {
    if (d > maxDist) {
      maxDist = d;
      endNode = id;
    }
  });

  if (!endNode) return new Set();

  // Backtrack to find critical path
  const criticalSet = new Set();
  let node = endNode;
  while (node) {
    criticalSet.add(node);
    node = prev.get(node);
  }

  return criticalSet;
}

// Load/save column settings
function loadColumnSettings() {
  try {
    const stored = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new columns
      return DEFAULT_COLUMNS.map(col => {
        const saved = parsed.find(c => c.id === col.id);
        return saved ? { ...col, visible: saved.visible } : col;
      });
    }
  } catch (e) {
    console.error('Failed to load column settings', e);
  }
  return DEFAULT_COLUMNS;
}

function saveColumnSettings(columns) {
  try {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columns));
  } catch (e) {
    console.error('Failed to save column settings', e);
  }
}

export default function GanttChart({ onEditTask }) {
  const { allTasks, updateTask, createTask, milestones, updateMilestoneColor } = useTaskContext();
  const containerRef = useRef(null);
  const [viewMode, setViewMode] = useState('month');
  const [dragState, setDragState] = useState(null);
  const [groupBy, setGroupBy] = useState('status');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showGanttSettings, setShowGanttSettings] = useState(false);
  const [columnSettings, setColumnSettings] = useState(() => loadColumnSettings());
  const [draggingColIdx, setDraggingColIdx] = useState(null);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [hoveredTask, setHoveredTask] = useState(null);

  const DAY_WIDTH = viewMode === 'week' ? 80 : viewMode === 'resource' ? 60 : 40;
  const ROW_HEIGHT = 44;
  const HEADER_HEIGHT = 60;

  // Only tasks with dueDate or startTime
  const tasks = useMemo(
    () => allTasks.filter((t) => t.dueDate || t.startTime),
    [allTasks]
  );

  // Critical path calculation
  const criticalPathSet = useMemo(() => {
    return findCriticalPath(tasks);
  }, [tasks]);

  const timelineRange = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let start, end;
    if (viewMode === 'week') {
      start = new Date(today); start.setDate(today.getDate() - 3);
      end = new Date(today); end.setDate(today.getDate() + 3);
    } else if (viewMode === 'resource') {
      start = new Date(today); start.setDate(today.getDate() - 7);
      end = new Date(today); end.setDate(today.getDate() + 30);
    } else {
      start = new Date(today); start.setDate(today.getDate() - 3);
      end = new Date(today); end.setDate(today.getDate() + 30);
    }
    const dates = tasks.map((t) => {
      if (t.startTime) { const d = parseDate(t.startTime); if (d) return d; }
      if (t.dueDate) { const d = parseDate(t.dueDate); if (d) return d; }
      return null;
    }).filter(Boolean);
    dates.forEach((d) => {
      if (d < start) start = d;
      if (d > end) end = d;
    });

    // Also include milestone deadlines
    milestones.forEach((m) => {
      if (m.deadline) {
        const d = parseDate(m.deadline);
        if (d) {
          if (d < start) start = d;
          if (d > end) end = d;
        }
      }
    });

    return { start, end };
  }, [tasks, viewMode, milestones]);

  const timelineStart = timelineRange.start;
  const timelineEnd = timelineRange.end;

  const days = useMemo(() => getDays(timelineStart, timelineEnd), [timelineStart, timelineEnd]);
  const totalWidth = days.length * DAY_WIDTH;

  const timelineStartMs = timelineStart.getTime();
  const dateOffset = useCallback((date) => {
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    return Math.floor((d.getTime() - timelineStartMs) / 86400000);
  }, [timelineStartMs]);

  const getBarStyle = (task) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = parseDate(task.startTime) || new Date(today);
    const end = parseDate(task.dueDate) || new Date(start); end.setDate(end.getDate() + 1);
    const left = Math.max(0, dateOffset(start)) * DAY_WIDTH;
    const rightEdge = Math.min(days.length - 1, dateOffset(end)) * DAY_WIDTH + DAY_WIDTH;
    const width = Math.max(DAY_WIDTH * 0.5, rightEdge - left);

    let color = '#3b82f6';
    if (task.status === 'done') color = '#9ca3af';
    else if (task.status === 'todo') color = '#22c55e';
    const urgency = getReminderUrgency(task);
    if (urgency === 'overdue') color = '#ef4444';

    const isCritical = showCriticalPath && criticalPathSet.has(task.id);

    return { left, width, backgroundColor: color, isCritical };
  };

  // Drag handlers
  const handleMouseDown = (e, taskId, edge) => {
    e.preventDefault();
    e.stopPropagation();
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;
    setDragState({
      taskId,
      edge,
      startX: e.clientX,
      originStart: task.startTime,
      originEnd: task.dueDate,
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragState) return;
    const { taskId, edge, startX, originStart, originEnd } = dragState;
    const dx = e.clientX - startX;
    const daysDelta = Math.round(dx / DAY_WIDTH);
    if (daysDelta === 0) return;

    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    if (edge === 'left') {
      const newStart = new Date(originStart || new Date());
      newStart.setDate(newStart.getDate() + daysDelta);
      updateTask(taskId, { startTime: newStart.toISOString() });
    } else {
      const newEnd = new Date(originEnd || new Date());
      newEnd.setDate(newEnd.getDate() + daysDelta);
      updateTask(taskId, { dueDate: newEnd.toISOString() });
    }
  }, [dragState, allTasks, updateTask, DAY_WIDTH]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  // Group tasks
  const grouped = useMemo(() => {
    if (groupBy === 'priority') {
      const groups = { P0: [], P1: [], P2: [] };
      tasks.forEach((t) => {
        const key = t.priority || 'P1';
        if (groups[key]) groups[key].push(t);
      });
      return groups;
    }
    const groups = { todo: [], 'in-progress': [], done: [] };
    tasks.forEach((t) => {
      if (groups[t.status]) groups[t.status].push(t);
    });
    return groups;
  }, [tasks, groupBy]);

  const groupLabel = (key) => {
    if (groupBy === 'priority') {
      return { P0: '🔴 P0 紧急', P1: '🟡 P1 普通', P2: '⚪ P2 低优先级' }[key] || key;
    }
    return { todo: '📋 待办', 'in-progress': '🔄 进行中', done: '✅ 已完成' }[key] || key;
  };

  const todayOffset = dateOffset(new Date());

  // Milestone positions on timeline
  const milestoneMarkers = useMemo(() => {
    return milestones.map((m) => {
      const d = parseDate(m.deadline);
      if (!d) return null;
      const offset = dateOffset(d);
      if (offset < 0 || offset > days.length) return null;
      return {
        ...m,
        offset: offset * DAY_WIDTH + DAY_WIDTH / 2,
      };
    }).filter(Boolean);
  }, [milestones, dateOffset, days.length, DAY_WIDTH]);

  // Column settings handlers
  const handleColDragStart = (idx) => {
    dragItem.current = idx;
    setDraggingColIdx(idx);
  };

  const handleColDragEnter = (idx) => {
    dragOverItem.current = idx;
    if (dragItem.current === idx) return;
    const newOrder = [...columnSettings];
    const draggedItem = newOrder[dragItem.current];
    newOrder.splice(dragItem.current, 1);
    newOrder.splice(idx, 0, draggedItem);
    dragItem.current = idx;
    setColumnSettings(newOrder);
  };

  const handleColDragEnd = () => {
    setDraggingColIdx(null);
    dragItem.current = null;
    dragOverItem.current = null;
    saveColumnSettings(columnSettings);
  };

  const toggleColumnVisible = (colId) => {
    const updated = columnSettings.map(col =>
      col.id === colId ? { ...col, visible: !col.visible } : col
    );
    setColumnSettings(updated);
    saveColumnSettings(updated);
  };

  const visibleColumns = columnSettings.filter(col => col.visible);

  return (
    <div className="gantt-wrapper">
      <div className="gantt-header-bar">
        <span>📊 甘特图 — 共 {tasks.length} 个有时间跨度的任务</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`gantt-group-btn ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => setViewMode('month')}
          >月视图</button>
          <button
            className={`gantt-group-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >周视图</button>
          <button
            className={`gantt-group-btn ${viewMode === 'resource' ? 'active' : ''}`}
            onClick={() => setViewMode('resource')}
          >📊 资源</button>
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            泳道分组：
          </span>
          <button
            className={`gantt-group-btn ${groupBy === 'status' ? 'active' : ''}`}
            onClick={() => setGroupBy('status')}
          >按状态</button>
          <button
            className={`gantt-group-btn ${groupBy === 'priority' ? 'active' : ''}`}
            onClick={() => setGroupBy('priority')}
          >按优先级</button>
          <button
            className={`gantt-group-btn ${showCriticalPath ? 'active' : ''}`}
            onClick={() => setShowCriticalPath(!showCriticalPath)}
          >🔴 关键路径</button>
          <button
            className="gantt-group-btn"
            onClick={() => setShowColumnSettings(!showColumnSettings)}
          >📋 列设置</button>
          <button
            className="gantt-group-btn"
            onClick={() => setShowGanttSettings(true)}
          >⚙️ 设置</button>
        </div>
      </div>

      {/* Column Settings Panel */}
      {showColumnSettings && (
        <div className="gantt-column-settings">
          <div className="column-settings-header">
            <span>选择显示的列（可拖拽调整顺序）</span>
            <button className="btn-close-panel" onClick={() => setShowColumnSettings(false)}>×</button>
          </div>
          <div className="column-settings-list">
            {columnSettings.map((col, idx) => (
              <div
                key={col.id}
                className={`column-settings-item ${draggingColIdx === idx ? 'dragging' : ''} ${!col.visible ? 'hidden' : ''}`}
                draggable
                onDragStart={() => handleColDragStart(idx)}
                onDragEnter={() => handleColDragEnter(idx)}
                onDragEnd={handleColDragEnd}
                onDragOver={(e) => e.preventDefault()}
              >
                <span className="column-drag-handle">⋮⋮</span>
                <label className="column-checkbox-label">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => toggleColumnVisible(col.id)}
                  />
                  {col.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gantt Settings Modal */}
      {showGanttSettings && (
        <GanttSettingsModal
          milestones={milestones}
          onMilestoneColorChange={(id, color) => updateMilestoneColor(id, color)}
          onClose={() => setShowGanttSettings(false)}
        />
      )}

      <div className="gantt-scroll" ref={containerRef}>
        {/* Day headers */}
        <div className="gantt-header" style={{ width: totalWidth + 200 }}>
          <div className="gantt-label-col">
            {visibleColumns.map(col => (
              <div key={col.id} className="gantt-col-header">{col.label}</div>
            ))}
          </div>
          <div className="gantt-timeline-header" style={{ width: totalWidth }}>
            {days.map((day, i) => (
              <div
                key={i}
                className={`gantt-day-header ${isToday(day) ? 'today' : ''}`}
                style={{ width: DAY_WIDTH }}
              >
                {formatDay(day)}
              </div>
            ))}
          </div>
        </div>

        {/* Task rows */}
        {viewMode === 'resource' && (
          <ResourceView
            tasks={tasks}
            days={days}
            dateOffset={dateOffset}
            todayOffset={todayOffset}
            DAY_WIDTH={DAY_WIDTH}
            ROW_HEIGHT={ROW_HEIGHT}
            onEditTask={onEditTask}
            getBarStyle={getBarStyle}
            showCriticalPath={showCriticalPath}
            criticalPathSet={criticalPathSet}
            milestoneMarkers={milestoneMarkers}
          />
        )}

        {viewMode !== 'resource' && (
        <div
          className="gantt-body"
          style={{ width: totalWidth + 200 }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Milestone markers */}
          {milestoneMarkers.map((m) => (
            <div
              key={m.id}
              className="gantt-milestone-marker"
              style={{ left: m.offset + 200 }}
              title={`🎯 ${m.title}`}
            >
              <div
                className="milestone-diamond"
                style={{ backgroundColor: m.color || '#8b5cf6' }}
              />
            </div>
          ))}

          {Object.entries(grouped).map(([groupKey, groupTasks]) => {
            if (groupTasks.length === 0) return null;
            return (
              <div key={groupKey} className="gantt-group">
                <div className="gantt-group-label">
                  {groupLabel(groupKey)}
                </div>
                <div className="gantt-rows" style={{ width: totalWidth }}>
                  {/* Today line */}
                  <div
                    className="gantt-today-line"
                    style={{ left: todayOffset * DAY_WIDTH }}
                  />
                  {groupTasks.map((task) => {
                    const style = getBarStyle(task);
                    const isCritical = showCriticalPath && criticalPathSet.has(task.id);
                    return (
                      <div key={task.id} className="gantt-row" style={{ height: ROW_HEIGHT }}>
                        {/* Task info columns */}
                        <div className="gantt-task-info">
                          {visibleColumns.map(col => (
                            <div key={col.id} className="gantt-task-cell">
                              {col.id === 'title' && (
                                <span className="task-title-cell">{task.title}</span>
                              )}
                              {col.id === 'assignee' && (
                                <span>{task.assignee || '-'}</span>
                              )}
                              {col.id === 'startDate' && (
                                <span>{task.startTime ? new Date(task.startTime).toLocaleDateString('zh-CN') : '-'}</span>
                              )}
                              {col.id === 'endDate' && (
                                <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('zh-CN') : '-'}</span>
                              )}
                              {col.id === 'progress' && (
                                <span>{task.progress || 0}%</span>
                              )}
                              {col.id === 'status' && (
                                <span className={`status-badge ${task.status}`}>
                                  {task.status === 'todo' ? '待办' : task.status === 'in-progress' ? '进行中' : '完成'}
                                </span>
                              )}
                              {col.id === 'priority' && (
                                <span className={`priority-badge ${task.priority}`}>
                                  {task.priority || 'P1'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="gantt-task-bar-wrapper">
                          <div
                            className={`gantt-task-bar ${isCritical ? 'critical' : ''}`}
                            style={{ left: style.left, width: style.width, backgroundColor: style.backgroundColor }}
                            onClick={() => onEditTask(task)}
                            onMouseEnter={() => isCritical && setHoveredTask(task.id)}
                            onMouseLeave={() => setHoveredTask(null)}
                            title={`${task.title}\n开始: ${task.startTime ? new Date(task.startTime).toLocaleDateString() : '未设置'}\n截止: ${task.dueDate || '未设置'}`}
                          >
                            {hoveredTask === task.id && isCritical && (
                              <span className="critical-path-label">🔴 关键路径</span>
                            )}
                            <div
                              className="gantt-bar-handle left"
                              onMouseDown={(e) => handleMouseDown(e, task.id, 'left')}
                            />
                            <span className="gantt-bar-label">{task.title}</span>
                            <div
                              className="gantt-bar-handle right"
                              onMouseDown={(e) => handleMouseDown(e, task.id, 'right')}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <div className="gantt-empty">暂无有时间跨度的任务<br />给任务设置开始时间或截止日期即可显示在甘特图中</div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

function ResourceView({ tasks, days, dateOffset, todayOffset, DAY_WIDTH, ROW_HEIGHT, onEditTask, getBarStyle, showCriticalPath, criticalPathSet, milestoneMarkers }) {
  const projects = useMemo(() => getAllProjects(), []);
  const noProjectTasks = useMemo(
    () => tasks.filter((t) => !t.projectId),
    [tasks]
  );

  const projectRows = useMemo(() => {
    return projects.map((proj) => ({
      project: proj,
      tasks: tasks.filter((t) => t.projectId === proj.id),
    })).filter((r) => r.tasks.length > 0);
  }, [projects, tasks]);

  const allRows = [
    ...projectRows,
    ...(noProjectTasks.length > 0 ? [{ project: null, tasks: noProjectTasks }] : []),
  ];

  if (allRows.length === 0) {
    return (
      <div className="gantt-empty">暂无有项目的任务<br />创建项目并分配任务后，资源视图将显示项目时间线</div>
    );
  }

  const getProjectBarStyle = (task, project) => {
    const style = getBarStyle(task);
    style.backgroundColor = project?.color || style.backgroundColor;
    return style;
  };

  const loadData = useMemo(() => {
    const data = {};
    allRows.forEach(({ project, tasks: rowTasks }) => {
      const key = project?.id || '__none__';
      data[key] = {};
      days.forEach((day) => {
        data[key][day.dateStr] = rowTasks.filter((t) => {
          const start = t.startTime ? new Date(t.startTime) : null;
          const end = t.dueDate ? new Date(t.dueDate) : null;
          const d = new Date(day.dateStr);
          if (!start && !end) return false;
          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        });
      });
    });
    let max = 1;
    Object.values(data).forEach((byDate) => {
      Object.values(byDate).forEach((tasks) => { if (tasks.length > max) max = tasks.length; });
    });
    return { data, max };
  }, [allRows, days]);

  const [hoverInfo, setHoverInfo] = useState(null);

  const handleLoadHover = (e, projectKey, dateStr) => {
    const tasks = loadData.data[projectKey]?.[dateStr] || [];
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverInfo({ projectKey, dateStr, x: rect.left + rect.width / 2, y: rect.top, tasks });
  };

  return (
    <div className="gantt-body" style={{ width: days.length * DAY_WIDTH + 200 }}>
      <div className="gantt-today-line" style={{ left: todayOffset * DAY_WIDTH }} />
      {allRows.map(({ project, tasks: rowTasks }) => {
        const projectKey = project?.id || '__none__';
        return (
          <div key={projectKey} className="gantt-group">
            <div className="gantt-group-label" style={{ color: project?.color || 'var(--text-muted)' }}>
              {project ? `📁 ${project.name}` : '📋 无项目'}
            </div>
            <div className="gantt-rows" style={{ width: days.length * DAY_WIDTH }}>
              {rowTasks.map((task) => {
                const style = getProjectBarStyle(task, project);
                const isCritical = showCriticalPath && criticalPathSet.has(task.id);
                return (
                  <div key={task.id} className="gantt-row" style={{ height: ROW_HEIGHT }}>
                    <div
                      className={`gantt-task-bar ${isCritical ? 'critical' : ''}`}
                      style={{ left: style.left, width: style.width, backgroundColor: style.backgroundColor }}
                      onClick={() => onEditTask(task)}
                      title={`${task.title}\n开始: ${task.startTime ? new Date(task.startTime).toLocaleDateString() : '未设置'}\n截止: ${task.dueDate || '未设置'}`}
                    >
                      <span className="gantt-bar-label">{task.title}</span>
                    </div>
                  </div>
                );
              })}
              {/* Load chart row */}
              <div className="gantt-load-row">
                {days.map((day) => {
                  const dayTasks = loadData.data[projectKey]?.[day.dateStr] || [];
                  const barHeight = loadData.max > 1
                    ? Math.max(3, (dayTasks.length / loadData.max) * (ROW_HEIGHT - 4))
                    : 0;
                  return (
                    <div key={day.dateStr} className="gantt-load-cell">
                      <div
                        className="gantt-load-bar"
                        style={{
                          height: barHeight,
                          backgroundColor: project?.color || '#48DBFB',
                          opacity: dayTasks.length > 0 ? 0.5 + (dayTasks.length / loadData.max) * 0.5 : 0.1,
                        }}
                        onMouseEnter={(e) => handleLoadHover(e, projectKey, day.dateStr)}
                        onMouseLeave={() => setHoverInfo(null)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
      {hoverInfo && hoverInfo.tasks.length > 0 && (
        <div
          className="gantt-load-tooltip"
          style={{ left: hoverInfo.x, top: hoverInfo.y - 10 }}
        >
          <div className="load-tooltip-date">{hoverInfo.dateStr}</div>
          <div className="load-tooltip-count">{hoverInfo.tasks.length} 个任务</div>
          {hoverInfo.tasks.slice(0, 5).map((t) => (
            <div key={t.id} className="load-tooltip-task">{t.title}</div>
          ))}
          {hoverInfo.tasks.length > 5 && <div className="load-tooltip-more">+{hoverInfo.tasks.length - 5} 更多</div>}
        </div>
      )}
    </div>
  );
}
