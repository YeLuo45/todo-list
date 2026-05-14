/**
 * AI Priority Scoring Algorithm
 * Calculates priority score (0-100) based on multiple factors
 */

/**
 * Get AI priority score for a task
 * @param {Object} task - The task to evaluate
 * @param {Array} allTasks - All tasks for dependency analysis
 * @returns {{ score: number, label: string, reason: string } | null}
 */
export function getAIPriorityScore(task, allTasks) {
  if (!task.dueDate) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadline = new Date(task.dueDate);
  deadline.setHours(0, 0, 0, 0);

  // Calculate days until deadline
  const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

  let score = 0;
  const reasons = [];

  // Factor 1: Deadline urgency (0-40 points)
  if (daysUntilDeadline < 0) {
    // Overdue - highest priority
    score += 40;
    reasons.push(`已逾期 ${Math.abs(daysUntilDeadline)} 天`);
  } else if (daysUntilDeadline === 0) {
    score += 35;
    reasons.push('今天到期');
  } else if (daysUntilDeadline === 1) {
    score += 30;
    reasons.push('明天到期');
  } else if (daysUntilDeadline <= 3) {
    score += 20;
    reasons.push(` ${daysUntilDeadline} 天内到期`);
  } else if (daysUntilDeadline <= 7) {
    score += 10;
    reasons.push(`${daysUntilDeadline} 天后到期`);
  } else {
    score += 5;
    reasons.push(`到期日较远 (${daysUntilDeadline} 天)`);
  }

  // Factor 2: Incomplete subtasks (0-20 points)
  const subtasks = task.subtasks || [];
  if (subtasks.length > 0) {
    const completedCount = subtasks.filter(st => st.done).length;
    const incompleteCount = subtasks.length - completedCount;
    const completionRatio = completedCount / subtasks.length;
    
    if (incompleteCount > 0) {
      // More points for tasks with incomplete subtasks (needs attention)
      const subtaskScore = Math.min(20, incompleteCount * 5);
      score += subtaskScore;
      reasons.push(`${incompleteCount} 个子任务未完成`);
    }
  }

  // Factor 3: Blocked by dependencies (0-15 points)
  if (task.dependsOn && task.dependsOn.length > 0) {
    const blockedDeps = task.dependsOn.filter(depId => {
      const dep = allTasks.find(t => t.id === depId);
      return dep && dep.status !== 'done';
    });
    
    if (blockedDeps.length > 0) {
      score += Math.min(15, blockedDeps.length * 5);
      reasons.push(`等待 ${blockedDeps.length} 个依赖任务`);
    }
  }

  // Factor 4: Task importance score (Eisenhower matrix) (0-15 points)
  const importance = task.importance ?? 3;
  const urgency = task.urgency ?? 3;
  const taskScore = importance * urgency;
  
  if (taskScore >= 12) {
    score += 15;
    reasons.push('重要且紧急 (Q1)');
  } else if (taskScore >= 9) {
    score += 10;
    reasons.push('高重要性');
  } else if (taskScore >= 6) {
    score += 5;
    reasons.push('中等重要性');
  }

  // Factor 5: Priority tag boost (0-10 points)
  if (task.priority === 'P0') {
    score += 10;
    reasons.push('P0 优先级');
  } else if (task.priority === 'P1') {
    score += 5;
  }

  // Normalize score to 0-100
  score = Math.min(100, Math.max(0, score));

  // Determine label
  let label = 'medium';
  if (score >= 70) label = 'high';
  else if (score <= 40) label = 'low';

  return {
    score,
    label,
    reason: reasons.join(' · ')
  };
}
