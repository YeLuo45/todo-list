// Activity Log storage utility
const ACTIVITY_KEY = 'hermes_activity_v1';
const MAX_ACTIVITIES = 1000;

// Action types
export const ACTIVITY_ACTIONS = {
  TASK_CREATED: 'created',
  TASK_UPDATED: 'updated',
  STATUS_CHANGED: 'status_changed',
  TASK_DELETED: 'deleted',
  TASK_ASSIGNED: 'assigned',
  COMMENT_ADDED: 'commented',
  DESCRIPTION_CHANGED: 'description_changed',
  PRIORITY_CHANGED: 'priority_changed',
  DUE_DATE_CHANGED: 'due_date_changed',
  SUBTASK_ADDED: 'subtask_added',
  SUBTASK_COMPLETED: 'subtask_completed',
  TAG_ADDED: 'tag_added',
  TAG_REMOVED: 'tag_removed',
};

// Get all activities
export const getActivities = () => {
  try {
    const stored = localStorage.getItem(ACTIVITY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (e) {
    console.error('Failed to load activities:', e);
    return [];
  }
};

// Get activities for a specific task
export const getTaskActivities = (taskId) => {
  try {
    const allActivities = getActivities();
    return allActivities
      .filter(a => a.taskId === taskId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (e) {
    console.error('Failed to load task activities:', e);
    return [];
  }
};

// Add a new activity
export const addActivity = (taskId, action, details = {}, actor = null) => {
  try {
    const stored = localStorage.getItem(ACTIVITY_KEY);
    let activities = stored ? JSON.parse(stored) : [];
    
    const activity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      action,
      details,
      timestamp: new Date().toISOString(),
      actor: actor || getCurrentActor(),
    };
    
    activities.unshift(activity); // Add to beginning
    
    // Keep only the most recent MAX_ACTIVITIES
    if (activities.length > MAX_ACTIVITIES) {
      activities = activities.slice(0, MAX_ACTIVITIES);
    }
    
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
    return activity;
  } catch (e) {
    console.error('Failed to add activity:', e);
    return null;
  }
};

// Get current actor (current user)
const getCurrentActor = () => {
  try {
    const stored = localStorage.getItem('hermes_users_v1');
    if (stored) {
      const users = JSON.parse(stored);
      const currentUserId = localStorage.getItem('hermes_current_user');
      const user = users.find(u => u.id === currentUserId);
      if (user) return user;
    }
  } catch (e) {
    console.error('Failed to get current actor:', e);
  }
  return { id: 'anonymous', name: '系统', avatar: '🤖', color: '#6b7280' };
};

// Clear all activities (for testing)
export const clearActivities = () => {
  localStorage.removeItem(ACTIVITY_KEY);
};

// Get activity count
export const getActivityCount = () => {
  const activities = getActivities();
  return activities.length;
};

// Format action for display
export const formatActivityAction = (action, details = {}) => {
  const actionLabels = {
    [ACTIVITY_ACTIONS.TASK_CREATED]: '创建了任务',
    [ACTIVITY_ACTIONS.TASK_UPDATED]: '更新了任务',
    [ACTIVITY_ACTIONS.STATUS_CHANGED]: `将状态改为"${details.newStatus || ''}"`,
    [ACTIVITY_ACTIONS.TASK_DELETED]: '删除了任务',
    [ACTIVITY_ACTIONS.TASK_ASSIGNED]: `指派给了 ${details.assigneeName || ''}`,
    [ACTIVITY_ACTIONS.COMMENT_ADDED]: '添加了评论',
    [ACTIVITY_ACTIONS.DESCRIPTION_CHANGED]: '更新了描述',
    [ACTIVITY_ACTIONS.PRIORITY_CHANGED]: `将优先级改为"${details.newPriority || ''}"`,
    [ACTIVITY_ACTIONS.DUE_DATE_CHANGED]: `将截止日期改为"${details.newDueDate || ''}"`,
    [ACTIVITY_ACTIONS.SUBTASK_ADDED]: '添加了子任务',
    [ACTIVITY_ACTIONS.SUBTASK_COMPLETED]: '完成了子任务',
    [ACTIVITY_ACTIONS.TAG_ADDED]: `添加了标签"${details.tag || ''}"`,
    [ACTIVITY_ACTIONS.TAG_REMOVED]: `移除了标签"${details.tag || ''}"`,
  };
  return actionLabels[action] || action;
};
