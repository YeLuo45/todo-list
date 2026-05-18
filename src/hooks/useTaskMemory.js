import { useMemo } from 'react';

/**
 * Task Memory Hook — 基于 generic-agent-design L1 Insight Index 概念
 * 实时计算任务洞见，不持久化（刷新重算，体现"记忆"即上下文）
 */
export function useTaskMemory(tasks = []) {
  const insights = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // 周日

    // 基础统计
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed');
    const completedCount = completed.length;
    const overdueCount = tasks.filter(t => {
      if (t.status === 'completed' || !t.dueDate) return false;
      return new Date(t.dueDate) < today;
    }).length;

    // 本周完成（周一到周日为一周）
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const thisWeekCompleted = completed.filter(t => {
      if (!t.completedAt) return false;
      const ct = new Date(t.completedAt);
      return ct >= weekStart && ct < weekEnd;
    }).length;

    // 连续完成天数（streak）
    let streakDays = 0;
    const completedByDay = {};
    completed.forEach(t => {
      if (!t.completedAt) return;
      const d = new Date(t.completedAt).toISOString().split('T')[0];
      completedByDay[d] = (completedByDay[d] || 0) + 1;
    });
    const sortedDays = Object.keys(completedByDay).sort().reverse();
    let checkDate = new Date(today);
    for (let i = 0; i < 365; i++) {
      const key = checkDate.toISOString().split('T')[0];
      if (completedByDay[key]) {
        streakDays++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // 本周7天趋势
    const weekTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0];
      weekTrend.push({
        label: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
        count: completedByDay[key] || 0,
      });
    }

    // 高频任务（创建≥3次的任务名）
    const taskNameCount = {};
    tasks.forEach(t => {
      if (t.title) taskNameCount[t.title] = (taskNameCount[t.title] || 0) + 1;
    });
    const recurringTasks = Object.entries(taskNameCount)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([title, count]) => ({ title, count }));

    // 标签统计
    const tagCount = {};
    tasks.forEach(t => {
      (t.tags || []).forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    return {
      total,
      completedCount,
      overdueCount,
      thisWeekCompleted,
      streakDays,
      weekTrend,
      recurringTasks,
      topTags,
    };
  }, [tasks]);

  return insights;
}