import { useTaskMemory } from '../hooks/useTaskMemory';
import './InsightsPanel.css';

export default function InsightsPanel({ tasks = [], collapsed, onToggle }) {
  const { total, completedCount, overdueCount, thisWeekCompleted, streakDays, weekTrend, recurringTasks, topTags } = useTaskMemory(tasks);

  // SVG trend line max height
  const maxCount = Math.max(...weekTrend.map(d => d.count), 1);
  const chartH = 60;

  return (
    <div className={`insights-panel ${collapsed ? 'collapsed' : ''}`}>
      <button className="insights-toggle" onClick={onToggle}>
        <span className="insights-toggle-icon">💡</span>
        <span className="insights-toggle-text">洞察</span>
      </button>

      {!collapsed && (
        <div className="insights-content">
          {/* 本周趋势 */}
          <div className="insights-section">
            <div className="insights-section-title">本周完成</div>
            <div className="insights-week-trend">
              <svg viewBox={`0 0 ${weekTrend.length * 36} ${chartH}`} className="trend-svg">
                {weekTrend.map((d, i) => {
                  const barH = Math.round((d.count / maxCount) * (chartH - 8));
                  return (
                    <g key={i}>
                      <rect
                        x={i * 36 + 8}
                        y={chartH - barH - 4}
                        width={24}
                        height={barH || 2}
                        rx={3}
                        className="trend-bar"
                      />
                      <text
                        x={i * 36 + 20}
                        y={chartH + 12}
                        textAnchor="middle"
                        className="trend-label"
                      >
                        {d.label}
                      </text>
                      {d.count > 0 && (
                        <text
                          x={i * 36 + 20}
                          y={chartH - barH - 8}
                          textAnchor="middle"
                          className="trend-count"
                        >
                          {d.count}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="insights-stat-row">
              <span className="stat-badge">{thisWeekCompleted} 本周完成</span>
              {streakDays > 0 && (
                <span className="stat-badge streak">🔥 {streakDays}天连续</span>
              )}
            </div>
          </div>

          {/* 关键指标 */}
          <div className="insights-section">
            <div className="insights-stats-grid">
              <div className="stat-card">
                <div className="stat-value">{total}</div>
                <div className="stat-label">总任务</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{completedCount}</div>
                <div className="stat-label">已完成</div>
              </div>
              {overdueCount > 0 && (
                <div className="stat-card overdue">
                  <div className="stat-value">{overdueCount}</div>
                  <div className="stat-label">已过期</div>
                </div>
              )}
            </div>
          </div>

          {/* 高频任务 */}
          {recurringTasks.length > 0 && (
            <div className="insights-section">
              <div className="insights-section-title">高频任务</div>
              {recurringTasks.map((r, i) => (
                <div key={i} className="recurring-item">
                  <span className="recurring-title">{r.title}</span>
                  <span className="recurring-count">{r.count}次</span>
                </div>
              ))}
            </div>
          )}

          {/* 标签统计 */}
          {topTags.length > 0 && (
            <div className="insights-section">
              <div className="insights-section-title">热门标签</div>
              <div className="tag-list">
                {topTags.map((t, i) => (
                  <span key={i} className="tag-badge">
                    {t.tag} <span className="tag-count">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}