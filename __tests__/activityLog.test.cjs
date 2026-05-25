/**
 * ActivityLog Tests - CommonJS module test
 * Tests for getActivities, getTaskActivities, addActivity, clearActivities,
 * getActivityCount, formatActivityAction
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = value;
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};

global.localStorage = localStorageMock;

const { 
  getActivities, 
  getTaskActivities, 
  addActivity, 
  clearActivities,
  getActivityCount,
  formatActivityAction,
  ACTIVITY_ACTIONS 
} = require('../src/utils/activityLog.js');

describe('ActivityLog Module', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('ACTIVITY_ACTIONS', () => {
    it('should have all expected action types', () => {
      assert.strictEqual(ACTIVITY_ACTIONS.TASK_CREATED, 'created');
      assert.strictEqual(ACTIVITY_ACTIONS.TASK_UPDATED, 'updated');
      assert.strictEqual(ACTIVITY_ACTIONS.STATUS_CHANGED, 'status_changed');
      assert.strictEqual(ACTIVITY_ACTIONS.TASK_DELETED, 'deleted');
      assert.strictEqual(ACTIVITY_ACTIONS.TASK_ASSIGNED, 'assigned');
      assert.strictEqual(ACTIVITY_ACTIONS.COMMENT_ADDED, 'commented');
      assert.strictEqual(ACTIVITY_ACTIONS.DESCRIPTION_CHANGED, 'description_changed');
      assert.strictEqual(ACTIVITY_ACTIONS.PRIORITY_CHANGED, 'priority_changed');
      assert.strictEqual(ACTIVITY_ACTIONS.DUE_DATE_CHANGED, 'due_date_changed');
      assert.strictEqual(ACTIVITY_ACTIONS.SUBTASK_ADDED, 'subtask_added');
      assert.strictEqual(ACTIVITY_ACTIONS.SUBTASK_COMPLETED, 'subtask_completed');
      assert.strictEqual(ACTIVITY_ACTIONS.TAG_ADDED, 'tag_added');
      assert.strictEqual(ACTIVITY_ACTIONS.TAG_REMOVED, 'tag_removed');
    });
  });

  describe('getActivities', () => {
    it('should return empty array when no activities stored', () => {
      const activities = getActivities();
      assert.deepStrictEqual(activities, []);
    });

    it('should return stored activities', () => {
      const storedActivities = [
        { id: 'act-1', taskId: 'task-1', action: 'created', timestamp: '2024-01-01T00:00:00Z' }
      ];
      localStorageMock.setItem('hermes_activity_v1', JSON.stringify(storedActivities));
      
      const activities = getActivities();
      assert.strictEqual(activities.length, 1);
      assert.strictEqual(activities[0].id, 'act-1');
    });

    it('should return empty array for invalid JSON', () => {
      localStorageMock.setItem('hermes_activity_v1', 'invalid json');
      
      const activities = getActivities();
      assert.deepStrictEqual(activities, []);
    });
  });

  describe('getTaskActivities', () => {
    it('should return activities for specific task', () => {
      const storedActivities = [
        { id: 'act-1', taskId: 'task-1', action: 'created', timestamp: '2024-01-01T00:00:00Z' },
        { id: 'act-2', taskId: 'task-2', action: 'created', timestamp: '2024-01-02T00:00:00Z' },
        { id: 'act-3', taskId: 'task-1', action: 'updated', timestamp: '2024-01-03T00:00:00Z' }
      ];
      localStorageMock.setItem('hermes_activity_v1', JSON.stringify(storedActivities));
      
      const activities = getTaskActivities('task-1');
      assert.strictEqual(activities.length, 2);
      assert.strictEqual(activities[0].taskId, 'task-1');
    });

    it('should return activities sorted by timestamp descending', () => {
      const storedActivities = [
        { id: 'act-1', taskId: 'task-1', action: 'created', timestamp: '2024-01-01T00:00:00Z' },
        { id: 'act-2', taskId: 'task-1', action: 'updated', timestamp: '2024-01-03T00:00:00Z' },
        { id: 'act-3', taskId: 'task-1', action: 'status_changed', timestamp: '2024-01-02T00:00:00Z' }
      ];
      localStorageMock.setItem('hermes_activity_v1', JSON.stringify(storedActivities));
      
      const activities = getTaskActivities('task-1');
      assert.strictEqual(activities[0].action, 'updated');
      assert.strictEqual(activities[1].action, 'status_changed');
      assert.strictEqual(activities[2].action, 'created');
    });

    it('should return empty array for task with no activities', () => {
      localStorageMock.setItem('hermes_activity_v1', JSON.stringify([
        { id: 'act-1', taskId: 'task-1', action: 'created' }
      ]));
      
      const activities = getTaskActivities('task-999');
      assert.deepStrictEqual(activities, []);
    });
  });

  describe('addActivity', () => {
    it('should add activity to storage', () => {
      const activity = addActivity('task-1', ACTIVITY_ACTIONS.TASK_CREATED, {});
      
      assert.ok(activity.id);
      assert.strictEqual(activity.taskId, 'task-1');
      assert.strictEqual(activity.action, 'created');
      assert.ok(activity.timestamp);
    });

    it('should add activity to beginning of list', () => {
      localStorageMock.setItem('hermes_activity_v1', JSON.stringify([
        { id: 'act-old', taskId: 'task-1', action: 'created', timestamp: '2024-01-01T00:00:00Z' }
      ]));
      
      const newActivity = addActivity('task-2', ACTIVITY_ACTIONS.TASK_UPDATED, {});
      
      const activities = getActivities();
      assert.strictEqual(activities[0].id, newActivity.id);
      assert.strictEqual(activities.length, 2);
    });

    it('should include details in activity', () => {
      const details = { oldStatus: 'todo', newStatus: 'done' };
      const activity = addActivity('task-1', ACTIVITY_ACTIONS.STATUS_CHANGED, details);
      
      assert.deepStrictEqual(activity.details, details);
    });

    it('should generate unique IDs', () => {
      const activity1 = addActivity('task-1', ACTIVITY_ACTIONS.TASK_CREATED, {});
      const activity2 = addActivity('task-2', ACTIVITY_ACTIONS.TASK_CREATED, {});
      
      assert.notStrictEqual(activity1.id, activity2.id);
    });

    it('should limit activities to MAX_ACTIVITIES (1000)', () => {
      for (let i = 0; i < 1001; i++) {
        addActivity(`task-${i}`, ACTIVITY_ACTIONS.TASK_CREATED, {});
      }
      
      const activities = getActivities();
      assert.strictEqual(activities.length, 1000);
    });

    it('should use default actor when none provided', () => {
      const activity = addActivity('task-1', ACTIVITY_ACTIONS.TASK_CREATED, {});
      
      assert.deepStrictEqual(activity.actor, { 
        id: 'anonymous', 
        name: '系统', 
        avatar: '🤖', 
        color: '#6b7280' 
      });
    });
  });

  describe('clearActivities', () => {
    it('should remove all activities', () => {
      addActivity('task-1', ACTIVITY_ACTIONS.TASK_CREATED, {});
      addActivity('task-2', ACTIVITY_ACTIONS.TASK_CREATED, {});
      
      clearActivities();
      
      const activities = getActivities();
      assert.deepStrictEqual(activities, []);
    });
  });

  describe('getActivityCount', () => {
    it('should return 0 when no activities', () => {
      const count = getActivityCount();
      assert.strictEqual(count, 0);
    });

    it('should return correct count', () => {
      addActivity('task-1', ACTIVITY_ACTIONS.TASK_CREATED, {});
      addActivity('task-2', ACTIVITY_ACTIONS.TASK_CREATED, {});
      
      const count = getActivityCount();
      assert.strictEqual(count, 2);
    });
  });

  describe('formatActivityAction', () => {
    it('should format TASK_CREATED', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.TASK_CREATED);
      assert.strictEqual(result, '创建了任务');
    });

    it('should format TASK_UPDATED', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.TASK_UPDATED);
      assert.strictEqual(result, '更新了任务');
    });

    it('should format STATUS_CHANGED with details', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.STATUS_CHANGED, { newStatus: 'done' });
      assert.strictEqual(result, '将状态改为"done"');
    });

    it('should format TASK_DELETED', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.TASK_DELETED);
      assert.strictEqual(result, '删除了任务');
    });

    it('should format TASK_ASSIGNED with details', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.TASK_ASSIGNED, { assigneeName: '张三' });
      assert.strictEqual(result, '指派给了 张三');
    });

    it('should format COMMENT_ADDED', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.COMMENT_ADDED);
      assert.strictEqual(result, '添加了评论');
    });

    it('should format DESCRIPTION_CHANGED', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.DESCRIPTION_CHANGED);
      assert.strictEqual(result, '更新了描述');
    });

    it('should format PRIORITY_CHANGED with details', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.PRIORITY_CHANGED, { newPriority: 'P0' });
      assert.strictEqual(result, '将优先级改为"P0"');
    });

    it('should format DUE_DATE_CHANGED with details', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.DUE_DATE_CHANGED, { newDueDate: '2024-12-31' });
      assert.strictEqual(result, '将截止日期改为"2024-12-31"');
    });

    it('should format SUBTASK_ADDED', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.SUBTASK_ADDED);
      assert.strictEqual(result, '添加了子任务');
    });

    it('should format SUBTASK_COMPLETED', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.SUBTASK_COMPLETED);
      assert.strictEqual(result, '完成了子任务');
    });

    it('should format TAG_ADDED with details', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.TAG_ADDED, { tag: 'urgent' });
      assert.strictEqual(result, '添加了标签"urgent"');
    });

    it('should format TAG_REMOVED with details', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.TAG_REMOVED, { tag: 'work' });
      assert.strictEqual(result, '移除了标签"work"');
    });

    it('should return action as-is for unknown action type', () => {
      const result = formatActivityAction('unknown_action');
      assert.strictEqual(result, 'unknown_action');
    });

    it('should handle missing details gracefully', () => {
      const result = formatActivityAction(ACTIVITY_ACTIONS.STATUS_CHANGED, {});
      assert.strictEqual(result, '将状态改为""');
    });
  });
});