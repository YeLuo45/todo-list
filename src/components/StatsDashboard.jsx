import { useEffect, useRef, useState } from 'react';
import { drawBarChart, drawLineChart, drawPieChart } from '../utils/charts';
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

export default function StatsDashboard({ tasks, onClose }) {
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

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="stats-modal">
        <div className="stats-header">
          <h3>📊 任务统计</h3>
          <button className="stats-close" onClick={onClose}>×</button>
        </div>

        <div className="stats-body">
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
        </div>
      </div>
    </div>
  );
}
