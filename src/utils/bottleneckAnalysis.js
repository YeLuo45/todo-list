/**
 * 任务流瓶颈分析
 * 检测影响效率的任务问题
 */

/**
 * 分析任务流瓶颈
 * @param {Array} tasks - 任务列表
 * @returns {Object} 瓶颈分析结果
 */
export function analyzeBottlenecks(tasks) {
  const bottlenecks = [];
  const now = new Date();
  
  // 过滤活跃任务（非子任务）
  const activeTasks = tasks.filter(t => !t.parentId);
  
  // 1. 长期卡住任务：已完成但超过7天未更新的任务
  analyzeStalledTasks(activeTasks, now, bottlenecks);
  
  // 2. 预估时长过长任务：超过20小时未拆分子任务
  analyzeLongTasks(activeTasks, bottlenecks);
  
  // 3. 频繁拖延任务：deadline 延迟3次以上的任务
  analyzeDelayedTasks(activeTasks, bottlenecks);
  
  // 4. 依赖链过长：依赖深度超过5层的任务链
  analyzeDependencyChains(activeTasks, bottlenecks);
  
  // 按严重程度排序
  bottlenecks.sort((a, b) => {
    const severityOrder = { danger: 0, warning: 1 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
  
  return {
    bottlenecks,
    summary: {
      total: bottlenecks.length,
      danger: bottlenecks.filter(b => b.severity === 'danger').length,
      warning: bottlenecks.filter(b => b.severity === 'warning').length,
    },
  };
}

/**
 * 检测长期卡住的任务
 * 已完成但超过7天未更新，可能是无效完成
 */
function analyzeStalledTasks(tasks, now, bottlenecks) {
  tasks.forEach(task => {
    if (task.status === 'done' && task.updatedAt) {
      const updatedDate = new Date(task.updatedAt);
      const daysSinceUpdate = (now - updatedDate) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate > 7) {
        bottlenecks.push({
          type: 'stalled',
          taskId: task.id,
          taskTitle: task.title,
          severity: 'warning',
          description: `任务已完成但超过 ${Math.floor(daysSinceUpdate)} 天未更新，可能需要验证完成状态`,
          daysSinceUpdate: Math.floor(daysSinceUpdate),
        });
      }
    }
  });
}

/**
 * 检测预估时长过长的任务
 * 超过20小时且未拆分子任务
 */
function analyzeLongTasks(tasks, bottlenecks) {
  tasks.forEach(task => {
    // 跳过已完成的子任务检查
    if (task.status === 'done') return;
    
    const estimatedHours = task.estimatedHours || 0;
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    
    if (estimatedHours > 20 && !hasSubtasks) {
      bottlenecks.push({
        type: 'long_task',
        taskId: task.id,
        taskTitle: task.title,
        severity: estimatedHours > 40 ? 'danger' : 'warning',
        description: `任务预估 ${estimatedHours} 小时但未拆分子任务，建议分解以提高可追踪性`,
        estimatedHours,
      });
    }
  });
}

/**
 * 检测频繁拖延的任务
 * deadline 延迟3次以上
 */
function analyzeDelayedTasks(tasks, bottlenecks) {
  tasks.forEach(task => {
    if (!task.dueDate) return;
    
    const delayCount = task.delayCount || 0;
    const originalDueDate = task.originalDueDate;
    
    // 如果当前日期已超过截止日期且有延迟记录
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    
    if (now > dueDate && delayCount >= 3) {
      bottlenecks.push({
        type: 'delayed',
        taskId: task.id,
        taskTitle: task.title,
        severity: delayCount >= 5 ? 'danger' : 'warning',
        description: `任务已延迟 ${delayCount} 次，可能需要重新评估计划或资源`,
        delayCount,
        dueDate: task.dueDate,
      });
    }
  });
}

/**
 * 检测依赖链过长的问题
 * 依赖深度超过5层
 */
function analyzeDependencyChains(tasks, bottlenecks) {
  const taskMap = new Map();
  tasks.forEach(t => taskMap.set(t.id, t));
  
  const computedDepths = new Map();
  
  const getDependencyDepth = (taskId, visited = new Set()) => {
    if (visited.has(taskId)) return 0; // 循环依赖
    if (computedDepths.has(taskId)) return computedDepths.get(taskId);
    
    const task = taskMap.get(taskId);
    if (!task || !task.dependsOn || task.dependsOn.length === 0) {
      computedDepths.set(taskId, 0);
      return 0;
    }
    
    visited.add(taskId);
    let maxDepth = 0;
    
    task.dependsOn.forEach(depId => {
      const depDepth = getDependencyDepth(depId, new Set(visited));
      maxDepth = Math.max(maxDepth, depDepth);
    });
    
    const depth = maxDepth + 1;
    computedDepths.set(taskId, depth);
    return depth;
  };
  
  tasks.forEach(task => {
    const depth = getDependencyDepth(task.id);
    if (depth > 5) {
      bottlenecks.push({
        type: 'deep_dependency',
        taskId: task.id,
        taskTitle: task.title,
        severity: depth > 7 ? 'danger' : 'warning',
        description: `任务依赖链深度为 ${depth} 层，过长的依赖链可能影响进度可控性`,
        depth,
        dependsOn: task.dependsOn,
      });
    }
  });
}

/**
 * 获取瓶颈类型标签
 */
export function getBottleneckTypeLabel(type) {
  const labels = {
    stalled: '长期卡住',
    long_task: '预估过长',
    delayed: '频繁拖延',
    deep_dependency: '依赖过深',
  };
  return labels[type] || type;
}

/**
 * 获取严重程度颜色
 */
export function getSeverityColor(severity) {
  return severity === 'danger' ? '#ef4444' : '#f59e0b';
}