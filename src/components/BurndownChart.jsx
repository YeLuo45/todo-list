import { useEffect, useRef, useState } from 'react';
import './BurndownChart.css';

export default function BurndownChart({ tasks }) {
  const svgRef = useRef();
  const [mode, setMode] = useState('count'); // 'count' | 'hours'
  const [data, setData] = useState(null);

  // Calculate burndown data
  useEffect(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = 30;
    
    // Get all tasks that are not deleted (non-recurring children)
    const activeTasks = tasks.filter(t => !t.parentId);
    
    // Group by completion date (updatedAt when status=done)
    const completedByDate = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().split('T')[0];
      completedByDate[key] = { count: 0, hours: 0 };
    }

    activeTasks.forEach(task => {
      if (task.status === 'done' && task.endTime) {
        const key = new Date(task.endTime).toISOString().split('T')[0];
        if (completedByDate[key]) {
          completedByDate[key].count++;
          completedByDate[key].hours += (task.estimatedHours || 1);
        }
      }
    });

    // Calculate cumulative remaining
    const totalCount = activeTasks.filter(t => t.status !== 'done').length;
    const totalHours = activeTasks
      .filter(t => t.status !== 'done')
      .reduce((sum, t) => sum + (t.estimatedHours || 1), 0);

    const dateLabels = [];
    const idealCount = [];
    const actualCount = [];
    const idealHours = [];
    const actualHours = [];

    let remainingCount = totalCount;
    let remainingHours = totalHours;

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().split('T')[0];
      const dayStr = `${d.getMonth() + 1}/${d.getDate()}`;
      dateLabels.push(dayStr);

      // Ideal line (linear decrease)
      idealCount.push(remainingCount - (i / (days - 1)) * totalCount);
      idealHours.push(remainingHours - (i / (days - 1)) * totalHours);

      // Actual remaining
      const completed = completedByDate[key];
      if (i === 0) {
        actualCount.push(remainingCount);
        actualHours.push(remainingHours);
      }
      remainingCount -= completed.count;
      remainingHours -= completed.hours;
      if (i > 0) {
        actualCount.push(Math.max(0, remainingCount));
        actualHours.push(Math.max(0, remainingHours));
      }
    }

    setData({
      labels: dateLabels,
      idealCount,
      actualCount,
      idealHours,
      actualHours,
      totalInitial: mode === 'count' ? totalCount : totalHours,
    });
  }, [tasks, mode]);

  // Draw SVG chart
  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const W = rect.width || 600;
    const H = rect.height || 280;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const values = mode === 'count' 
      ? [...data.idealCount, ...data.actualCount]
      : [...data.idealHours, ...data.actualHours];
    const max = Math.max(...values, 1);
    const min = 0;

    const toX = (i) => padding.left + (i / (data.labels.length - 1)) * chartW;
    const toY = (v) => padding.top + ((max - v) / (max - min)) * chartH;

    // Build paths
    const buildPath = (arr) => {
      return arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');
    };

    const idealPath = buildPath(mode === 'count' ? data.idealCount : data.idealHours);
    const actualPath = buildPath(mode === 'count' ? data.actualCount : data.actualHours);

    // X-axis labels (every 5 days)
    const xLabels = data.labels.map((l, i) => ({ i, l })).filter((_, i) => i % 5 === 0 || i === data.labels.length - 1);

    svg.innerHTML = `
      <defs>
        <linearGradient id="idealGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#94a3b8" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#94a3b8" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#6366f1" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
        </linearGradient>
      </defs>
      
      <!-- Grid lines -->
      ${[0, 0.25, 0.5, 0.75, 1].map(ratio => {
        const y = toY(max - (max - min) * ratio);
        return `<line x1="${padding.left}" y1="${y}" x2="${W - padding.right}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
      }).join('')}
      
      <!-- Y-axis labels -->
      ${[0, max].map(v => `
        <text x="${padding.left - 8}" y="${toY(v) + 4}" text-anchor="end" font-size="11" fill="#64748b">${Math.round(v)}</text>
      `).join('')}
      
      <!-- X-axis labels -->
      ${xLabels.map(({ i, l }) => `
        <text x="${toX(i)}" y="${H - 10}" text-anchor="middle" font-size="10" fill="#64748b">${l}</text>
      `).join('')}
      
      <!-- Ideal line area fill -->
      <path d="${idealPath} L ${toX(data.labels.length - 1)} ${toY(0)} L ${toX(0)} ${toY(0)} Z" fill="url(#idealGrad)"/>
      
      <!-- Actual line area fill -->
      <path d="${actualPath} L ${toX(data.labels.length - 1)} ${toY(0)} L ${toX(0)} ${toY(0)} Z" fill="url(#actualGrad)"/>
      
      <!-- Ideal line -->
      <path d="${idealPath}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6,4"/>
      
      <!-- Actual line -->
      <path d="${actualPath}" fill="none" stroke="#6366f1" stroke-width="2.5"/>
      
      <!-- Actual line dots -->
      ${(mode === 'count' ? data.actualCount : data.actualHours).map((v, i) => `
        <circle cx="${toX(i).toFixed(1)}" cy="${toY(v).toFixed(1)}" r="4" fill="#6366f1"/>
      `).join('')}
      
      <!-- Legend -->
      <g transform="translate(${W - 160}, ${padding.top})">
        <line x1="0" y1="6" x2="24" y2="6" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6,4"/>
        <text x="30" y="10" font-size="11" fill="#64748b">理想燃尽</text>
        <line x1="80" y1="6" x2="104" y2="6" stroke="#6366f1" stroke-width="2.5"/>
        <circle cx="92" cy="6" r="4" fill="#6366f1"/>
        <text x="110" y="10" font-size="11" fill="#64748b">实际燃尽</text>
      </g>
      
      <!-- No data message -->
      ${data.totalInitial === 0 ? `
        <text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="14" fill="#94a3b8">暂无任务数据</text>
      ` : ''}
    `;
  }, [data, mode]);

  return (
    <div className="burndown-chart">
      <div className="burndown-header">
        <h4>🔥 燃尽图</h4>
        <div className="burndown-toggle">
          <button 
            className={mode === 'count' ? 'active' : ''} 
            onClick={() => setMode('count')}
          >按任务数</button>
          <button 
            className={mode === 'hours' ? 'active' : ''} 
            onClick={() => setMode('hours')}
          >按工时</button>
        </div>
      </div>
      <svg 
        ref={svgRef} 
        className="burndown-svg"
        viewBox="0 0 600 280"
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
}