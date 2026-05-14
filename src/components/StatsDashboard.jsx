import { useEffect, useRef, useState } from 'react';
import { drawBarChart, drawLineChart, drawPieChart } from '../utils/charts';
import BurndownChart from './BurndownChart';
import { analyzeBottlenecks, getBottleneckTypeLabel, getSeverityColor } from '../utils/bottleneckAnalysis';
import { generateWeeklyReport, generateMonthlyReport } from '../utils/productivityReport';
import './StatsDashboard.css';

const DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function StatCard({ label, value, icon, subtext }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {subtext && <div className="stat-sub">{subtext}</div>}
    </div>
  );
}

function BarChart({ title, labels, values, color }) {
  const canvasRef = useRef();

  useEffect(() => {
    if (canvasRef.current && values.length > 0) {
      drawBarChart(canvasRef.current, null, { labels, values, barColor: color });
    }
  }, [labels, values, color]);

  return (
    <div className="chart-section">
      <h4>{title}</h4>
      <canvas ref={canvasRef} className="chart-canvas" style={{ width: '100%', height: '160px' }} />
    </div>
  );
}

function LineChart({ title, labels, values, color }) {
  const canvasRef = useRef();

  useEffect(() => {
    if (canvasRef.current && values.length > 0) {
      drawLineChart(canvasRef.current, null, { labels, values, lineColor: color });
    }
  }, [labels, values, color]);

  return (
    <div className="chart-section">
      <h4>{title}</h4>
      <canvas ref={canvasRef} className="chart-canvas" style={{ width: '100%', height: '160px' }} />
    </div>
  );
}

function PieChart({ title, labels, values, colors }) {
  const canvasRef = useRef();

  useEffect(() => {
    if (canvasRef.current) {
      drawPieChart(canvasRef.current, null, { labels, values, colors });
    }
  }, [labels, values, colors]);

  return (
    <div className="chart-section">
      <h4>{title}</h4>
      <canvas ref={canvasRef} className="chart-canvas" style={{ width: '100%', height: '180px' }} />
    </div>
  );
}

function BottleneckCard({ bottleneck }) {
  const color = getSeverityColor(bottleneck.severity);
  return (
    <div className={`bottleneck-card ${bottleneck.severity}`}>
      <div className="bottleneck-type" style={{ backgroundColor: color }}>
        {getBottleneckTypeLabel(bottleneck.type)}
      </div>
      <div className="bottleneck-content">
        <div className="bottleneck-title">{bottleneck.taskTitle}</div>
        <div className="bottleneck-desc">{bottleneck.description}</div>
      </div>
    </div>
  );
}

function ProductivityReport({ report }) {
  if (!report) return null;
  
  return (
    <div className="productivity-report">
      <div className="report-summary">
        <div className="report-card">
          <span className="report-label">完成数</span>
          <span className="report-value">{report.completedCount}</span>
          {report.growthRate !== 0 && (
            <span className={`report-growth ${report.growthRate > 0 ? 'positive' : 'negative'}`}>
              {report.growthRate > 0 ? '↑' : '↓'} {Math.abs(report.growthRate)}%
            </span>
          )}
        </div>
        <div className="report-card">
          <span className="report-label">平均完成时长</span>
          <span className="report-value">{report.avgCompletionHours}h</span>
        </div>
        <div className="report-card">
          <span className="report-label">新增任务</span>
          <span className="report-value">{report.newTasksCount}</span>
        </div>
      </div>
      
      {/* 优先级完成率 */}
      <div className="chart-section">
        <h4>📊 优先级完成率</h4>
        <div className="priority-bars">
          {['P0', 'P1', 'P2'].map(p => {
            const stats = report.priorityStats?.[p] || { total: 0, completed: 0, rate: '0.0' };
            return (
              <div key={p} className="priority-bar-item">
                <span className="priority-label">{p}</span>
                <div className="priority-bar-track">
                  <div 
                    className="priority-bar-fill" 
                    style={{ width: `${stats.rate}%`, backgroundColor: p === 'P0' ? '#ef4444' : p === 'P1' ? '#f59e0b' : '#9ca3b8' }}
                  />
                </div>
                <span className="priority-rate">{stats.rate}%</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* 高峰时段柱状图 */}
      {report.peakHours && report.peakHours.length > 0 && (
        <div className="chart-section">
          <h4>⏰ 任务提交时段分布</h4>
          <div className="peak-hours-bars">
            {report.peakHours.map((segment, i) => (
              <div key={i} className="peak-hours-bar">
                <div 
                  className="peak-hours-fill" 
                  style={{ height: `${Math.min(100, (segment.value / Math.max(...report.peakHours.map(s => s.value), 1)) * 100)}%` }}
                />
                <div className="peak-hours-label">{segment.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 活跃标签 */}
      {report.tagActivity && report.tagActivity.length > 0 && (
        <div className="chart-section">
          <h4>🏷️ 活跃标签 TOP</h4>
          <div className="tag-cloud">
            {report.tagActivity.slice(0, 8).map((item, i) => (
              <span 
                key={item.tag} 
                className="tag-item"
                style={{ fontSize: `${Math.max(11, Math.min(18, 11 + item.count * 2))}px` }}
              >
                {item.tag} ({item.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StatsDashboard({ tasks, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [bottleneckResult, setBottleneckResult] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  
  // 计算统计数据
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 各列数量
  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'in-progress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  // 超期任务
  const overdueCount = tasks.filter(t => {
    if (!t.dueDate || t.status === 'done') return false;
    return new Date(t.dueDate) < today;
  }).length;

  // 本周新增
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const thisWeekNew = tasks.filter(t => new Date(t.createdAt) >= weekStart).length;

  // 本周完成
  const thisWeekDone = tasks.filter(t => {
    if (t.status !== 'done') return false;
    const updated = new Date(t.updatedAt);
    return updated >= weekStart && updated < today;
  }).length;

  // 近7天每日完成任务
  const last7Days = [];
  const last7Done = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);
    last7Days.push(DAYS[d.getDay()]);
    const done = tasks.filter(t => {
      if (t.status !== 'done') return false;
      const ud = new Date(t.updatedAt);
      return ud >= d && ud < nextD;
    }).length;
    last7Done.push(done);
  }

  // 优先级分布
  const p0Count = tasks.filter(t => t.priority === 'P0').length;
  const p1Count = tasks.filter(t => t.priority === 'P1').length;
  const p2Count = tasks.filter(t => t.priority === 'P2').length;

  // 分析瓶颈
  useEffect(() => {
    const result = analyzeBottlenecks(tasks);
    setBottleneckResult(result);
  }, [tasks]);

  // 生成报告
  useEffect(() => {
    setWeeklyReport(generateWeeklyReport(tasks));
    setMonthlyReport(generateMonthlyReport(tasks));
  }, [tasks]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="stats-modal">
        <div className="stats-header">
          <h3>📊 数据分析</h3>
          <button className="stats-close" onClick={onClose}>×</button>
        </div>

        <div className="stats-tabs">
          <button 
            className={`stats-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📈 概览
          </button>
          <button 
            className={`stats-tab ${activeTab === 'burndown' ? 'active' : ''}`}
            onClick={() => setActiveTab('burndown')}
          >
            🔥 燃尽图
          </button>
          <button 
            className={`stats-tab ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            📋 报告
          </button>
          <button 
            className={`stats-tab ${activeTab === 'bottlenecks' ? 'active' : ''}`}
            onClick={() => setActiveTab('bottlenecks')}
          >
            ⚠️ 瓶颈 {bottleneckResult?.summary?.total > 0 && <span className="bottleneck-badge">{bottleneckResult.summary.total}</span>}
          </button>
        </div>

        <div className="stats-body">
          {activeTab === 'overview' && (
            <>
              <div className="stat-cards-row">
                <StatCard icon="📋" value={todoCount} label="待办" />
                <StatCard icon="🔄" value={inProgressCount} label="进行中" />
                <StatCard icon="✅" value={doneCount} label="已完成" />
                <StatCard icon="⚠️" value={overdueCount} label="已超期" subtext="待办+进行中" />
                <StatCard icon="🆕" value={thisWeekNew} label="本周新增" />
                <StatCard icon="🎯" value={thisWeekDone} label="本周完成" />
              </div>

              <div className="charts-grid">
                <BarChart
                  title="各列任务分布"
                  labels={['待办', '进行中', '已完成']}
                  values={[todoCount, inProgressCount, doneCount]}
                  color="#6366f1"
                />
                <LineChart
                  title="近7天完成任务趋势"
                  labels={last7Days}
                  values={last7Done}
                  color="#22c55e"
                />
                <PieChart
                  title="优先级分布"
                  labels={['P0 紧急', 'P1 一般', 'P2 次要']}
                  values={[p0Count, p1Count, p2Count]}
                  colors={['#ef4444', '#f59e0b', '#9ca3b8']}
                />
              </div>
            </>
          )}

          {activeTab === 'burndown' && (
            <BurndownChart tasks={tasks} />
          )}

          {activeTab === 'report' && (
            <div className="report-tabs">
              <div className="report-tab-content">
                <h4>📅 周报</h4>
                <ProductivityReport report={weeklyReport} />
              </div>
              <div className="report-tab-content">
                <h4>📆 月报</h4>
                <ProductivityReport report={monthlyReport} />
              </div>
            </div>
          )}

          {activeTab === 'bottlenecks' && (
            <div className="bottlenecks-section">
              {bottleneckResult && bottleneckResult.summary.total > 0 ? (
                <>
                  <div className="bottleneck-summary">
                    <span className="summary-danger">危险: {bottleneckResult.summary.danger}</span>
                    <span className="summary-warning">警告: {bottleneckResult.summary.warning}</span>
                  </div>
                  <div className="bottleneck-list">
                    {bottleneckResult.bottlenecks.map((b, i) => (
                      <BottleneckCard key={i} bottleneck={b} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="no-bottlenecks">
                  🎉 暂无瓶颈任务，一切运行良好！
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}