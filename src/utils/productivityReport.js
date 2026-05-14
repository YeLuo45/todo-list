/**
 * 生产力报告生成器
 * 生成周报和月报统计数据
 */

/**
 * 生成周报
 * @param {Array} tasks - 任务列表
 * @returns {Object} 周报数据
 */
export function generateWeeklyReport(tasks) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // 本周起止
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  
  // 上周起止
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(weekStart);
  
  return generateReport(tasks, weekStart, weekEnd, lastWeekStart, lastWeekEnd, 'week');
}

/**
 * 生成月报
 * @param {Array} tasks - 任务列表
 * @returns {Object} 月报数据
 */
export function generateMonthlyReport(tasks) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // 本月起止
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  
  // 上月起止
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(monthStart);
  
  return generateReport(tasks, monthStart, monthEnd, lastMonthStart, lastMonthEnd, 'month');
}

/**
 * 通用报告生成器
 */
function generateReport(tasks, currentStart, currentEnd, lastStart, lastEnd, type) {
  // 过滤已完成的任务
  const completedTasks = tasks.filter(t => t.status === 'done');
  
  // 本期完成的任务
  const currentCompleted = completedTasks.filter(t => {
    const end = new Date(t.endTime || t.updatedAt);
    return end >= currentStart && end < currentEnd;
  });
  
  // 上期完成的任务
  const lastCompleted = completedTasks.filter(t => {
    const end = new Date(t.endTime || t.updatedAt);
    return end >= lastStart && end < lastEnd;
  });
  
  // 本期新增任务
  const currentNewTasks = tasks.filter(t => {
    const created = new Date(t.createdAt);
    return created >= currentStart && created < currentEnd;
  });
  
  // 计算平均完成时长（小时）
  const avgCompletionTime = calculateAvgCompletionTime(currentCompleted);
  
  // 优先级完成率
  const priorityStats = calculatePriorityStats(currentCompleted, tasks);
  
  // 项目完成分布（饼图数据）
  const projectDistribution = calculateProjectDistribution(currentCompleted, tasks);
  
  // 标签活跃度（词云数据）
  const tagActivity = calculateTagActivity(tasks, currentStart, currentEnd);
  
  // 高峰时段分析（柱状图数据）
  const peakHours = calculatePeakHours(tasks, currentStart, currentEnd);
  
  // 环比变化
  const growthRate = lastCompleted.length > 0
    ? ((currentCompleted.length - lastCompleted.length) / lastCompleted.length * 100).toFixed(1)
    : currentCompleted.length > 0 ? 100 : 0;
  
  return {
    type,
    period: {
      start: currentStart.toISOString(),
      end: currentEnd.toISOString(),
    },
    completedCount: currentCompleted.length,
    lastPeriodCount: lastCompleted.length,
    growthRate: parseFloat(growthRate),
    newTasksCount: currentNewTasks.length,
    avgCompletionHours: parseFloat(avgCompletionTime.toFixed(1)),
    priorityStats,
    projectDistribution,
    tagActivity,
    peakHours,
    // 图表数据
    charts: {
      pieChart: projectDistribution,
      barChart: peakHours,
    },
  };
}

/**
 * 计算平均完成时长（小时）
 */
function calculateAvgCompletionTime(completedTasks) {
  if (completedTasks.length === 0) return 0;
  
  let totalHours = 0;
  let countWithTime = 0;
  
  completedTasks.forEach(task => {
    if (task.startTime && task.endTime) {
      const start = new Date(task.startTime);
      const end = new Date(task.endTime);
      const hours = (end - start) / (1000 * 60 * 60);
      totalHours += hours;
      countWithTime++;
    } else if (task.estimatedHours) {
      totalHours += task.estimatedHours;
      countWithTime++;
    }
  });
  
  return countWithTime > 0 ? totalHours / countWithTime : 0;
}

/**
 * 计算各优先级完成率
 */
function calculatePriorityStats(completed, allTasks) {
  const priorities = ['P0', 'P1', 'P2'];
  const stats = {};
  
  priorities.forEach(p => {
    const total = allTasks.filter(t => t.priority === p && !t.parentId).length;
    const done = completed.filter(t => t.priority === p).length;
    stats[p] = {
      total,
      completed: done,
      rate: total > 0 ? ((done / total) * 100).toFixed(1) : '0.0',
    };
  });
  
  return stats;
}

/**
 * 计算项目完成分布
 */
function calculateProjectDistribution(completed, allTasks) {
  const projectStats = {};
  
  // 收集所有项目
  allTasks.forEach(t => {
    if (t.projectId && !t.parentId) {
      if (!projectStats[t.projectId]) {
        projectStats[t.projectId] = { total: 0, completed: 0 };
      }
      projectStats[t.projectId].total++;
    }
  });
  
  // 统计完成数
  completed.forEach(t => {
    if (t.projectId && projectStats[t.projectId]) {
      projectStats[t.projectId].completed++;
    }
  });
  
  // 转换为数组格式
  const distribution = Object.entries(projectStats).map(([projectId, data]) => ({
    projectId,
    label: projectId || '默认项目',
    value: data.completed,
    total: data.total,
  }));
  
  // 按完成数排序
  distribution.sort((a, b) => b.value - a.value);
  
  return distribution.slice(0, 5); // 最多5个项目
}

/**
 * 计算标签活跃度
 */
function calculateTagActivity(tasks, start, end) {
  const tagCounts = {};
  
  tasks.forEach(task => {
    const created = new Date(task.createdAt);
    if (created >= start && created < end) {
      (task.tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });
  
  // 转换为数组并排序
  const activity = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  
  return activity.slice(0, 10); // 最多10个标签
}

/**
 * 计算任务提交高峰时段
 */
function calculatePeakHours(tasks, start, end) {
  const hourCounts = {};
  
  // 初始化 0-23 小时
  for (let i = 0; i < 24; i++) {
    hourCounts[i] = 0;
  }
  
  tasks.forEach(task => {
    const created = new Date(task.createdAt);
    if (created >= start && created < end) {
      const hour = created.getHours();
      hourCounts[hour]++;
    }
  });
  
  // 转换为图表数据（按6小时分段）
  const segments = [
    { label: '0-6时', value: 0 },
    { label: '6-12时', value: 0 },
    { label: '12-18时', value: 0 },
    { label: '18-24时', value: 0 },
  ];
  
  Object.entries(hourCounts).forEach(([hour, count]) => {
    const h = parseInt(hour);
    if (h < 6) segments[0].value += count;
    else if (h < 12) segments[1].value += count;
    else if (h < 18) segments[2].value += count;
    else segments[3].value += count;
  });
  
  return segments;
}