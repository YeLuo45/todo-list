import { useState, useMemo, useRef, useCallback } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { getReminderUrgency } from '../utils/reminder';
import { getAllProjects } from '../utils/projects';
import './GanttChart.css';

const DAY_WIDTH = 40; // px per day
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 60;

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

export default function GanttChart({ onEditTask }) {
  const { allTasks, updateTask, createTask } = useTaskContext();
  const containerRef = useRef(null);
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'resource'
  const [dragState, setDragState] = useState(null); // { taskId, edge: 'left'|'right', startX, originStart, originEnd }
  const [groupBy, setGroupBy] = useState('status'); // 'status' | 'priority'
  const DAY_WIDTH = viewMode === 'week' ? 80 : viewMode === 'resource' ? 60 : 40; // px per day
  const ROW_HEIGHT = 44;
  const HEADER_HEIGHT = 60;

  // Only tasks with dueDate or startTime
  const tasks = useMemo(
    () => allTasks.filter((t) => t.dueDate || t.startTime),
    [allTasks]
  );

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
    return { start, end };
  }, [tasks, viewMode]);

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

    let color = '#3b82f6'; // blue: in-progress
    if (task.status === 'done') color = '#9ca3af'; // gray: done
    else if (task.status === 'todo') color = '#22c55e'; // green: todo
    const urgency = getReminderUrgency(task);
    if (urgency === 'overdue') color = '#ef4444'; // red: overdue

    return { left, width, backgroundColor: color };
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
  }, [dragState, allTasks, updateTask]);

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
    // groupBy === 'status'
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

  return (
    <div className="gantt-wrapper">
      <div className="gantt-header-bar">
        <span>📊 甘特图 — 共 {tasks.length} 个有时间跨度的任务</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
        </div>
      </div>
      <div className="gantt-scroll" ref={containerRef}>
        {/* Day headers */}
        <div className="gantt-header" style={{ width: totalWidth + 200 }}>
          <div className="gantt-label-col">任务</div>
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
        {/* Resource View: projects as rows */}
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
          />
        )}

        {/* Standard View: tasks grouped */}
        {viewMode !== 'resource' && (
        <div
          className="gantt-body"
          style={{ width: totalWidth + 200 }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
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
                    return (
                      <div key={task.id} className="gantt-row" style={{ height: ROW_HEIGHT }}>
                        <div className="gantt-task-bar"
                          style={{ left: style.left, width: style.width, backgroundColor: style.backgroundColor }}
                          onClick={() => onEditTask(task)}
                          title={`${task.title}\n开始: ${task.startTime ? new Date(task.startTime).toLocaleDateString() : '未设置'}\n截止: ${task.dueDate || '未设置'}`}
                        >
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

function ResourceView({ tasks, days, dateOffset, todayOffset, DAY_WIDTH, ROW_HEIGHT, onEditTask, getBarStyle }) {
  const projects = useMemo(() => getAllProjects(), []);
  const noProjectTasks = useMemo(
    () => tasks.filter((t) => !t.projectId),
    [tasks]
  );

  // Build project rows: { project, tasks }
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

  return (
    <div className="gantt-body" style={{ width: days.length * DAY_WIDTH + 200 }}>
      <div
        className="gantt-today-line"
        style={{ left: todayOffset * DAY_WIDTH }}
      />
      {allRows.map(({ project, tasks: rowTasks }) => (
        <div key={project?.id || '__unassigned__'} className="gantt-group">
          <div className="gantt-group-label" style={{ color: project?.color || 'var(--text-muted)' }}>
            {project ? `📁 ${project.name}` : '📋 无项目'}
          </div>
          <div className="gantt-rows" style={{ width: days.length * DAY_WIDTH }}>
            {rowTasks.map((task) => {
              const style = getProjectBarStyle(task, project);
              return (
                <div key={task.id} className="gantt-row" style={{ height: ROW_HEIGHT }}>
                  <div
                    className="gantt-task-bar"
                    style={{ left: style.left, width: style.width, backgroundColor: style.backgroundColor }}
                    onClick={() => onEditTask(task)}
                    title={`${task.title}\n开始: ${task.startTime ? new Date(task.startTime).toLocaleDateString() : '未设置'}\n截止: ${task.dueDate || '未设置'}`}
                  >
                    <span className="gantt-bar-label">{task.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
