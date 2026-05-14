/**
 * AI Dependency Conflict Detection
 * Detects circular dependencies, dangling references, and time conflicts
 */

/**
 * Check for dependency conflicts in task list
 * @param {Array} tasks - All tasks
 * @returns {{ hasConflicts: boolean, conflicts: Array<{type, taskId, description}> }}
 */
export function checkDependencyConflicts(tasks) {
  const conflicts = [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  // 1. Check for dangling dependencies (tasks that depend on non-existent tasks)
  for (const task of tasks) {
    if (!task.dependsOn || task.dependsOn.length === 0) continue;

    for (const depId of task.dependsOn) {
      if (!taskMap.has(depId)) {
        conflicts.push({
          type: 'dangling',
          taskId: task.id,
          description: `任务"${task.title}"依赖的任务#${depId}不存在或已删除`
        });
      }
    }
  }

  // 2. Check for circular dependencies
  const circularDeps = detectCircularDependencies(tasks);
  for (const cycle of circularDeps) {
    conflicts.push({
      type: 'circular',
      taskId: cycle[0],
      description: `循环依赖：${cycle.join(' → ')}`
    });
  }

  // 3. Check for time conflicts (deadline before dependency's deadline)
  for (const task of tasks) {
    if (!task.dueDate || !task.dependsOn || task.dependsOn.length === 0) continue;

    const taskDeadline = new Date(task.dueDate);
    
    for (const depId of task.dependsOn) {
      const depTask = taskMap.get(depId);
      if (!depTask || !depTask.dueDate) continue;

      const depDeadline = new Date(depTask.dueDate);
      
      // If this task's deadline is before the dependency's deadline
      // (which doesn't make sense - you can't finish before your dependency)
      if (taskDeadline < depDeadline) {
        conflicts.push({
          type: 'time_conflict',
          taskId: task.id,
          description: `任务"${task.title}"截止日期(${task.dueDate})早于依赖任务"${depTask.title}"(${depTask.dueDate})`
        });
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
}

/**
 * Detect circular dependencies using DFS
 * @param {Array} tasks - All tasks
 * @returns {Array<Array<string>>} Array of cycles (each cycle is array of task IDs)
 */
function detectCircularDependencies(tasks) {
  const cycles = [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  // Build adjacency list
  const graph = new Map();
  for (const task of tasks) {
    if (!graph.has(task.id)) {
      graph.set(task.id, []);
    }
    if (task.dependsOn) {
      for (const depId of task.dependsOn) {
        if (taskMap.has(depId)) {
          graph.get(task.id).push(depId);
        }
      }
    }
  }

  // DFS to find all cycles
  const visited = new Set();
  const recStack = new Set();
  const path = [];

  function dfs(nodeId, startNodeId) {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const result = dfs(neighbor, startNodeId);
        if (result) return result;
      } else if (recStack.has(neighbor) && neighbor === startNodeId) {
        // Found a cycle - extract it
        const cycleStart = path.indexOf(neighbor);
        const cycle = [...path.slice(cycleStart), neighbor];
        cycles.push(cycle);
        return cycle;
      }
    }

    path.pop();
    recStack.delete(nodeId);
    return null;
  }

  // Run DFS from each node
  for (const taskId of taskMap.keys()) {
    if (!visited.has(taskId)) {
      dfs(taskId, taskId);
    }
  }

  // Deduplicate cycles (same cycle might be found multiple times)
  const uniqueCycles = [];
  const seen = new Set();
  
  for (const cycle of cycles) {
    // Normalize cycle to start from smallest ID for comparison
    const normalized = normalizeCycle(cycle);
    const key = normalized.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCycles.push(cycle);
    }
  }

  return uniqueCycles;
}

/**
 * Normalize a cycle to start from the smallest ID for deduplication
 */
function normalizeCycle(cycle) {
  if (cycle.length === 0) return cycle;
  
  let minIndex = 0;
  for (let i = 1; i < cycle.length; i++) {
    if (cycle[i] < cycle[minIndex]) {
      minIndex = i;
    }
  }
  
  return [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
}

/**
 * Get human-readable dependency chain for a task
 */
export function getDependencyChain(taskId, tasks) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const chain = [];
  let currentId = taskId;

  while (currentId && chain.length < 10) { // Prevent infinite loops
    if (chain.includes(currentId)) {
      chain.push(`${currentId} (循环)`);
      break;
    }
    chain.push(currentId);
    const task = taskMap.get(currentId);
    if (!task || !task.dependsOn || task.dependsOn.length === 0) break;
    currentId = task.dependsOn[0]; // Follow first dependency
  }

  return chain;
}

/**
 * Check if adding a dependency would create a cycle
 */
export function wouldCreateCircularDependency(taskId, newDepId, tasks) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  
  // DFS from the new dependency to see if we can reach the task
  const visited = new Set();
  const stack = [newDepId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    
    const task = taskMap.get(current);
    if (task && task.dependsOn) {
      stack.push(...task.dependsOn);
    }
  }

  return false;
}
