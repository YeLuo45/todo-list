import { useMemo } from 'react';
import { useTaskContext, computeTaskScore, getQuadrant, QUADRANT_LABELS } from '../context/TaskContext';
import { getReminderUrgency } from '../utils/reminder';
import './Dashboard.css';

function KpiCard({ icon, label, value, color, sub }) {
  return (
    <div className="kpi-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value" style={{ color }}>{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard({ onNewTask, onEditTask }) {
  const { allTasks } = useTaskContext();

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const threeDays = new Date(today); threeDays.setDate(today.getDate() + 3);
    const total = allTasks.length;
    const inProgress = allTasks.filter((t) => t.status === 'in-progress').length;
    const done = allTasks.filter((t) => t.status === 'done').length;
    const todo = allTasks.filter((t) => t.status === 'todo').length;
    const todayDue = allTasks.filter((t) => {
      if (!t.dueDate || t.status === 'done') return false;
      const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    const soonDue = allTasks.filter((t) => {
      if (!t.dueDate || t.status === 'done') return false;
      const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
      return d > today && d <= threeDays;
    });
    const overdueTasks = allTasks.filter((t) => {
      if (t.status === 'done') return false;
      const urg = getReminderUrgency(t);
      return urg === 'overdue';
    });
    const q1Count = allTasks.filter((t) => t.status !== 'done' && getQuadrant(t) === 'Q1').length;
    return { total, inProgress, done, todo, todayDue, soonDue, overdueTasks, q1Count };
  }, [allTasks]);

  const todayTasks = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return allTasks
      .filter((t) => {
        if (!t.dueDate || t.status === 'done') return false;
        const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
        return d.getTime() <= today;
      })
      .sort((a, b) => computeTaskScore(b) - computeTaskScore(a));
  }, [allTasks]);

  const soonTasks = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const threeDays = new Date(today); threeDays.setDate(today.getDate() + 3);
    return allTasks
      .filter((t) => {
        if (!t.dueDate || t.status === 'done') return false;
        const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
        return d > today && d <= threeDays;
      })
      .sort((a, b) => computeTaskScore(b) - computeTaskScore(a))
      .slice(0, 5);
  }, [allTasks]);

  const recentDone = useMemo(() => {
    return allTasks
      .filter((t) => t.status === 'done')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);
  }, [allTasks]);

  const quadrantBreakdown = useMemo(() => {
    const active = allTasks.filter((t) => t.status !== 'done');
    return ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({
      q, ...QUADRANT_LABELS[q],
      count: active.filter((t) => getQuadrant(t) === q).length,
    }));
  }, [allTasks]);

  const urgency = getReminderUrgency;

  return (
    <div className="dashboard">
      {/* KPI Cards */}
      <div className="dashboard-kpis">
        <KpiCard icon="📋" label="总任务" value={stats.total} color="var(--color-primary)" />
        <KpiCard icon="🔄" label="进行中" value={stats.inProgress} color="#3b82f6" />
        <KpiCard icon="✅" label="已完成" value={stats.done} color="#22c55e" />
        <KpiCard icon="⚠️" label="已逾期" value={stats.overdueTasks.length} color="#ef4444" sub={stats.overdueTasks.length > 0 ? '需要处理' : ''} />
        <KpiCard icon="🔥" label="紧急任务" value={stats.q1Count} color="#ef4444" sub="重要且紧急" />
        <KpiCard icon="📅" label="今日到期" value={stats.todayDue.length} color="#f59e0b" />
      </div>

      {/* Main grid */}
      <div className="dashboard-grid">
        {/* Left: Today + Soon */}
        <div className="dashboard-col">
          <div className="dash-section overdue-section">
            <h3>⚠️ 已逾期 / 今日到期 ({todayTasks.length})</h3>
            {todayTasks.length === 0 ? (
              <p className="dash-empty">🎉 暂无逾期任务</p>
            ) : (
              <div className="dash-task-list">
                {todayTasks.map((t) => (
                  <div key={t.id} className={`dash-task overdue ${urgency(t) === 'overdue' ? 'is-overdue' : ''}`}
                    onClick={() => onEditTask(t)}>
                    <div className="dash-task-left">
                      <span className="dash-task-title">{t.title}</span>
                      <span className="dash-task-meta">
                        {t.priority} {t.dueDate && `📅 ${t.dueDate}`}
                      </span>
                    </div>
                    <div className="dash-task-right">
                      <span
                        className="dash-score"
                        style={{ backgroundColor: QUADRANT_LABELS[getQuadrant(t)]?.color }}
                      >
                        {computeTaskScore(t)}分
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dash-section">
            <h3>📆 即将到期 (3天内, {soonTasks.length})</h3>
            {soonTasks.length === 0 ? (
              <p className="dash-empty">近期无到期任务</p>
            ) : (
              <div className="dash-task-list">
                {soonTasks.map((t) => (
                  <div key={t.id} className="dash-task" onClick={() => onEditTask(t)}>
                    <div className="dash-task-left">
                      <span className="dash-task-title">{t.title}</span>
                      <span className="dash-task-meta">
                        {t.priority} {t.dueDate && `📅 ${t.dueDate}`}
                      </span>
                    </div>
                    <div className="dash-task-right">
                      <span
                        className="dash-score"
                        style={{ backgroundColor: QUADRANT_LABELS[getQuadrant(t)]?.color }}
                      >
                        {computeTaskScore(t)}分
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick actions + Quadrant + Recent */}
        <div className="dashboard-col">
          <div className="dash-section">
            <h3>🚀 快捷操作</h3>
            <div className="quick-actions">
              <button className="quick-action-btn primary" onClick={onNewTask}>
                ➕ 新建任务
              </button>
              <button className="quick-action-btn" onClick={() => window.dispatchEvent(new CustomEvent('switch-view', { detail: 'kanban' }))}>
                📊 看板视图
              </button>
              <button className="quick-action-btn" onClick={() => window.dispatchEvent(new CustomEvent('switch-view', { detail: 'gantt' }))}>
                📈 甘特图
              </button>
              <button className="quick-action-btn" onClick={() => window.dispatchEvent(new CustomEvent('switch-view', { detail: 'stats' }))}>
                📊 统计面板
              </button>
            </div>
          </div>

          <div className="dash-section">
            <h3>🎯 四象限分布</h3>
            <div className="quadrant-grid">
              {quadrantBreakdown.map(({ q, label, icon, color, count }) => (
                <div key={q} className="quadrant-cell" style={{ borderTop: `3px solid ${color}` }}>
                  <div className="quadrant-header">
                    <span>{icon}</span>
                    <span className="quadrant-label">{label}</span>
                  </div>
                  <div className="quadrant-count" style={{ color }}>{count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-section">
            <h3>✨ 最近完成 ({recentDone.length})</h3>
            {recentDone.length === 0 ? (
              <p className="dash-empty">暂无已完成任务</p>
            ) : (
              <div className="dash-task-list">
                {recentDone.map((t) => (
                  <div key={t.id} className="dash-task done-task">
                    <span className="dash-task-title">{t.title}</span>
                    <span className="dash-task-meta">
                      {t.priority} {t.endTime && `✅ ${new Date(t.endTime).toLocaleDateString()}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
