/**
 * AI Work Pattern Analysis
 * Analyzes completed tasks to find optimal work times and patterns
 */

const MINIMUM_COMPLETED_TASKS = 10;

/**
 * Analyze work patterns from completed tasks
 * @param {Array} tasks - All tasks
 * @returns {Object} Work pattern analysis results
 */
export function analyzeWorkPatterns(tasks) {
  const completedTasks = tasks.filter(t => t.status === 'done' && t.endTime);
  
  if (completedTasks.length < MINIMUM_COMPLETED_TASKS) {
    return {
      sufficient: false,
      message: `需要至少 ${MINIMUM_COMPLETED_TASKS} 个已完成任务才能分析，当前仅有 ${completedTasks.length} 个`,
      completedCount: completedTasks.length
    };
  }

  // Extract hour from ISO timestamp
  const getHour = (isoString) => new Date(isoString).getHours();
  
  // Extract day of week (0 = Sunday, 6 = Saturday)
  const getDayOfWeek = (isoString) => new Date(isoString).getDay();

  // Hour distribution
  const hourCounts = {};
  for (let i = 0; i < 24; i++) hourCounts[i] = 0;
  
  // Day of week distribution
  const dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  
  // Duration by hour
  const hourDurations = {};
  for (let i = 0; i < 24; i++) hourDurations[i] = { total: 0, count: 0 };
  
  // Task type performance (based on tags)
  const tagPerformance = {};

  completedTasks.forEach(task => {
    const hour = getHour(task.endTime);
    const day = getDayOfWeek(task.endTime);
    
    // Count tasks by hour
    hourCounts[hour]++;
    
    // Count tasks by day
    dayCounts[day]++;
    
    // Calculate duration if startTime exists
    if (task.startTime && task.endTime) {
      const durationMs = new Date(task.endTime) - new Date(task.startTime);
      const durationMinutes = durationMs / (1000 * 60);
      hourDurations[hour].total += durationMinutes;
      hourDurations[hour].count++;
    }
    
    // Track tag performance
    if (task.tags && task.tags.length > 0) {
      task.tags.forEach(tag => {
        if (!tagPerformance[tag]) {
          tagPerformance[tag] = { completed: 0, totalDuration: 0 };
        }
        tagPerformance[tag].completed++;
        if (task.startTime && task.endTime) {
          const durationMs = new Date(task.endTime) - new Date(task.startTime);
          tagPerformance[tag].totalDuration += durationMs / (1000 * 60);
        }
      });
    }
  });

  // Find peak hours (top 3)
  const hourEntries = Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    .sort((a, b) => b.count - a.count);
  
  const peakHours = hourEntries.slice(0, 3).map(h => h.hour);
  
  // Calculate average duration per hour
  const avgDurationByHour = {};
  Object.entries(hourDurations).forEach(([hour, data]) => {
    avgDurationByHour[hour] = data.count > 0 ? Math.round(data.total / data.count) : 0;
  });

  // Weekday vs Weekend analysis
  const weekdayTotal = dayCounts[1] + dayCounts[2] + dayCounts[3] + dayCounts[4] + dayCounts[5];
  const weekendTotal = dayCounts[0] + dayCounts[6];
  const weekdayAvg = weekdayTotal / 5;
  const weekendAvg = weekendTotal / 2;
  
  const isWeekdayBetter = weekdayAvg >= weekendAvg;
  const productivityRatio = Math.max(weekdayAvg, weekendAvg) / Math.min(weekdayAvg, weekendAvg);

  // Find best day of week
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayEntries = Object.entries(dayCounts)
    .map(([day, count]) => ({ day: parseInt(day), count, name: dayNames[parseInt(day)] }))
    .sort((a, b) => b.count - a.count);
  const bestDay = dayEntries[0];

  // Best performing tags
  const tagEntries = Object.entries(tagPerformance)
    .map(([tag, data]) => ({
      tag,
      avgDuration: data.completed > 0 ? Math.round(data.totalDuration / data.completed) : 0,
      completedCount: data.completed
    }))
    .filter(t => t.completedCount >= 2) // Only tags with at least 2 tasks
    .sort((a, b) => b.completedCount - a.completedCount);

  return {
    sufficient: true,
    peakHours,
    hourDistribution: hourCounts,
    avgDurationByHour,
    bestDay,
    dayDistribution: dayCounts,
    weekdayVsWeekend: {
      weekdayAvg: Math.round(weekdayAvg * 10) / 10,
      weekendAvg: Math.round(weekendAvg * 10) / 10,
      isWeekdayBetter,
      productivityRatio: Math.round(productivityRatio * 10) / 10
    },
    topTags: tagEntries.slice(0, 5),
    totalAnalyzed: completedTasks.length
  };
}

/**
 * Get optimal work time recommendation
 * @param {Array} tasks - All tasks
 * @returns {{ recommendedHours: number[], reason: string } | null}
 */
export function getOptimalWorkTime(tasks) {
  const analysis = analyzeWorkPatterns(tasks);
  
  if (!analysis.sufficient) {
    return null;
  }

  const { peakHours, weekdayVsWeekend, bestDay } = analysis;
  
  // Build recommendation reason
  const reasons = [];
  
  if (peakHours.length > 0) {
    const hourLabels = peakHours.map(h => {
      if (h >= 6 && h < 9) return '清晨';
      if (h >= 9 && h < 12) return '上午';
      if (h >= 12 && h < 14) return '中午';
      if (h >= 14 && h < 17) return '下午';
      if (h >= 17 && h < 19) return '傍晚';
      if (h >= 19 && h < 22) return '晚上';
      return `${h}点`;
    });
    reasons.push(`你在 ${[...new Set(hourLabels)].join('、')} 时段完成任务最多`);
  }
  
  if (weekdayVsWeekend.isWeekdayBetter) {
    reasons.push(`工作日效率更高（平均 ${weekdayVsWeekend.weekdayAvg} vs ${weekdayVsWeekend.weekendAvg} 个任务/天）`);
  } else {
    reasons.push(`周末效率更高（平均 ${weekdayVsWeekend.weekendAvg} vs ${weekdayVsWeekend.weekdayAvg} 个任务/天）`);
  }
  
  if (bestDay) {
    reasons.push(`${bestDay.name} 是你最忙碌的一天`);
  }

  return {
    recommendedHours: peakHours,
    reason: reasons.join('；')
  };
}

/**
 * Get AI work habit summary text
 */
export function getWorkHabitSummary(tasks) {
  const analysis = analyzeWorkPatterns(tasks);
  
  if (!analysis.sufficient) {
    return {
      hasData: false,
      summary: `📊 数据不足：需要 ${MINIMUM_COMPLETED_TASKS} 个已完成任务进行分析，当前仅有 ${analysis.completedCount} 个任务数据。`
    };
  }

  const { peakHours, weekdayVsWeekend, bestDay, topTags } = analysis;
  
  const hourLabels = peakHours.map(h => {
    if (h >= 6 && h < 12) return `${h}:00`;
    if (h >= 12 && h < 18) return `${h}:00`;
    if (h >= 18 && h < 22) return `${h}:00`;
    return `${h}:00`;
  });
  
  const uniqueHours = [...new Set(peakHours.map(h => {
    if (h >= 6 && h < 12) return '上午';
    if (h >= 12 && h < 18) return '下午';
    if (h >= 18 && h < 22) return '晚上';
    return '深夜';
  }))];

  let summary = `🧠 AI 工作习惯分析（基于 ${analysis.totalAnalyzed} 个已完成任务）\n\n`;
  summary += `⏰ 最佳工作时段：${uniqueHours.join('、')}（推荐安排重要任务）\n`;
  summary += `📅 ${weekdayVsWeekend.isWeekdayBetter ? '工作日' : '周末'}效率更高\n`;
  
  if (bestDay && bestDay.count > 0) {
    summary += `📆 ${bestDay.name} 是你最忙碌的一天（完成 ${bestDay.count} 个任务）\n`;
  }
  
  if (topTags.length > 0) {
    const tagInfo = topTags.slice(0, 3).map(t => `${t.tag}（${t.completedCount}个）`).join('、');
    summary += `🏷️ 常处理任务类型：${tagInfo}\n`;
  }

  return {
    hasData: true,
    summary,
    details: analysis
  };
}
