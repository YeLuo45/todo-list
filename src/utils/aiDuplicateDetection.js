/**
 * AI Duplicate Task Detection
 * Detects potential duplicate tasks based on title similarity and deadline
 */

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

/**
 * Normalize date string for comparison (YYYY-MM-DD)
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

/**
 * Check if two tasks have the same deadline
 */
function haveSameDeadline(task1, task2) {
  const date1 = normalizeDate(task1.dueDate);
  const date2 = normalizeDate(task2.dueDate);
  if (!date1 || !date2) return false;
  return date1 === date2;
}

/**
 * Find potential duplicate tasks
 * @param {Array} tasks - Array of tasks
 * @param {number} threshold - Similarity threshold (default 0.7)
 * @returns {Array} Array of duplicate groups
 */
export function findDuplicates(tasks, threshold = 0.7) {
  const duplicates = [];
  const processed = new Set();

  for (let i = 0; i < tasks.length; i++) {
    if (processed.has(tasks[i].id)) continue;
    
    const group = [tasks[i]];
    let hasDuplicate = false;

    for (let j = i + 1; j < tasks.length; j++) {
      if (processed.has(tasks[j].id)) continue;

      const similarity = calculateSimilarity(tasks[i].title, tasks[j].title);
      const sameDeadline = haveSameDeadline(tasks[i], tasks[j]);
      
      // Consider as duplicate if:
      // 1. Exact same title, OR
      // 2. High similarity (> threshold) AND same deadline
      if (similarity === 1 || (similarity > threshold && sameDeadline)) {
        group.push(tasks[j]);
        processed.add(tasks[j].id);
        hasDuplicate = true;
      }
    }

    if (hasDuplicate) {
      processed.add(tasks[i].id);
      duplicates.push({
        tasks: group,
        reason: group[0].title === group[1]?.title 
          ? '标题完全相同' 
          : `标题相似度 ${Math.round(calculateSimilarity(group[0].title, group[1]?.title) * 100)}% + 相同截止日期`
      });
    }
  }

  return duplicates;
}

/**
 * Get summary statistics for duplicates
 */
export function getDuplicateStats(duplicates) {
  const totalDuplicateTasks = duplicates.reduce((sum, g) => sum + g.tasks.length, 0);
  const duplicateGroups = duplicates.length;
  
  return {
    totalDuplicateTasks,
    duplicateGroups,
    message: totalDuplicateTasks > 0 
      ? `发现 ${totalDuplicateTasks} 个疑似重复任务，分布在 ${duplicateGroups} 个组中`
      : '未发现重复任务'
  };
}

/**
 * Merge duplicate tasks into one
 * @param {Array} tasks - Original tasks array
 * @param {Array} duplicateGroup - Group of duplicate tasks to merge
 * @param {string} keepTaskId - ID of task to keep
 * @returns {Array} Updated tasks array
 */
export function mergeDuplicateTasks(tasks, duplicateGroup, keepTaskId) {
  const taskToKeep = tasks.find(t => t.id === keepTaskId);
  if (!taskToKeep) return tasks;

  const tasksToRemove = duplicateGroup.tasks.filter(t => t.id !== keepTaskId);
  
  // Merge subtasks from all tasks
  const allSubtasks = [];
  duplicateGroup.tasks.forEach(task => {
    if (task.subtasks) {
      task.subtasks.forEach(st => {
        if (!allSubtasks.find(s => s.title === st.title)) {
          allSubtasks.push({ ...st, id: `merged-${Date.now()}-${Math.random()}` });
        }
      });
    }
  });

  // Merge tags
  const allTags = [...new Set(duplicateGroup.tasks.flatMap(t => t.tags || []))];

  // Update the task to keep
  const updatedTasks = tasks.map(t => {
    if (t.id === keepTaskId) {
      return {
        ...t,
        subtasks: allSubtasks.length > 0 ? allSubtasks : t.subtasks,
        tags: allTags.length > 0 ? allTags : t.tags,
        // Take the earliest due date
        dueDate: duplicateGroup.tasks.reduce(( earliest, task) => {
          if (!task.dueDate) return earliest;
          if (!earliest) return task.dueDate;
          return task.dueDate < earliest ? task.dueDate : earliest;
        }, null)
      };
    }
    return t;
  });

  // Remove duplicate tasks
  return updatedTasks.filter(t => !tasksToRemove.find(r => r.id === t.id));
}

/**
 * Dismiss duplicate warning (mark as ignored)
 */
export function dismissDuplicateWarning(ignoredPairs, taskId1, taskId2) {
  const key = [taskId1, taskId2].sort().join('-');
  const dismissed = JSON.parse(localStorage.getItem('dismissed_duplicates') || '{}');
  dismissed[key] = true;
  localStorage.setItem('dismissed_duplicates', JSON.stringify(dismissed));
  return dismissed;
}

/**
 * Check if a duplicate pair has been dismissed
 */
export function isDuplicateDismissed(taskId1, taskId2) {
  const key = [taskId1, taskId2].sort().join('-');
  const dismissed = JSON.parse(localStorage.getItem('dismissed_duplicates') || '{}');
  return !!dismissed[key];
}
