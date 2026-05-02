import { useState, useMemo, useRef, useCallback } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { getReminderUrgency } from '../utils/reminder';
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
  const [dragState, setDragState] = useState(null); // { taskId, edge: 'left'|'right', startX, originStart, originEnd }
  const [groupBy, setGroupBy] = useState('status'); // 'status' | 'priority'

  // Only tasks with dueDate or startTime
  const tasks = useMemo(
    () => allTasks.filter((t) => t.dueDate || t.startTime),
    [allTasks]
  );

  // Timeline: from earliest start (or today-3) to latest due (or today+30)
  const { start: timelineStart, end: timelineEnd } = useMemo(() => {
    const dates = tasks.map((t) => {
      if (t.startTime) { const d = parseDate(t.startTime); if (d) return d; }
      if (t.dueDate) { const d = parseDate(t.dueDate); if (d) return d; }
      return null;
    }).filter(Boolean);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let earliest = new Date(today); earliest.setDate(today.getDate() - 3);
    let latest = new Date(today); latest.setDate(today.getDate() + 30);
    dates.forEach((d) => {
      if (d < earliest) earliest = d;
      if (d > latest) latest = d;
    });
    return { start: earliest, end: latest };
  }, [tasks]);

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
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
      </div>
    </div>
  );
}
