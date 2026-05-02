// Canvas 图表工具 — 柱状图 / 折线图 / 饼图

export function drawBarChart(canvas, data, options = {}) {
  const ctx = canvas.getContext('2d');
  const { labels, values, barColor = '#6366f1', labelColor = '#64748b' } = options;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const max = Math.max(...values, 1);
  const barW = (w - 40) / values.length - 8;
  const chartH = h - 50;

  ctx.clearRect(0, 0, w, h);

  values.forEach((v, i) => {
    const barH = (v / max) * chartH;
    const x = 20 + i * ((w - 40) / values.length) + 4;
    const y = chartH - barH + 10;

    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
    ctx.fill();

    ctx.fillStyle = labelColor;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(v, x + barW / 2, y - 5);
    ctx.fillText(labels[i] || '', x + barW / 2, h - 10);
  });
}

export function drawLineChart(canvas, data, options = {}) {
  const ctx = canvas.getContext('2d');
  const { labels, values, lineColor = '#6366f1', fillColor = 'rgba(99,102,241,0.1)' } = options;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const max = Math.max(...values, 1);
  const paddingX = 20;
  const paddingY = 20;
  const chartW = w - paddingX * 2;
  const chartH = h - paddingY * 2 - 20;

  ctx.clearRect(0, 0, w, h);

  const stepX = chartW / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => ({
    x: paddingX + i * stepX,
    y: paddingY + chartH - (v / max) * chartH,
  }));

  // Fill
  ctx.beginPath();
  ctx.moveTo(points[0].x, paddingY + chartH);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, paddingY + chartH);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Line
  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dots
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  });

  // Labels
  ctx.fillStyle = '#64748b';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  points.forEach((p, i) => {
    if (labels[i]) ctx.fillText(labels[i], p.x, h - 5);
  });
}

export function drawPieChart(canvas, data, options = {}) {
  const ctx = canvas.getContext('2d');
  const { values, labels, colors = ['#ef4444', '#f59e0b', '#22c55e', '#6366f1', '#8b5cf6'] } = options;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  const size = Math.min(w, h) * 0.7;
  const cx = w / 2;
  const cy = h / 2 + 10;
  const r = size / 2;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);

  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无数据', cx, cy);
    return;
  }

  let startAngle = -Math.PI / 2;
  values.forEach((v, i) => {
    const slice = (v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    startAngle += slice;
  });

  // Legend
  const legendY = h - 10;
  const itemW = w / values.length;
  values.forEach((v, i) => {
    const x = i * itemW + itemW / 2;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x - 8, legendY - 12, 12, 12);
    ctx.fillStyle = '#334155';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${labels[i] || ''} (${v})`, x, legendY);
  });
}
