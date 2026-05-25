/**
 * AI Priority Tests
 * Tests for getAIPriorityScore function
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getAIPriorityScore } from '../src/utils/aiPriority.js';

describe('AI Priority Module', () => {
  describe('getAIPriorityScore', () => {
    it('should return null for task without dueDate', () => {
      const task = { title: 'Test Task' };
      const result = getAIPriorityScore(task, []);
      assert.strictEqual(result, null);
    });

    it('should calculate overdue task score', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const task = { 
        id: 'task-1', 
        title: 'Overdue Task',
        dueDate: yesterday.toISOString().split('T')[0],
        subtasks: []
      };
      
      const result = getAIPriorityScore(task, []);
      assert.ok(result.score >= 40);
      assert.ok(result.reason.includes('逾期'));
    });

    it('should calculate deadline score based on urgency', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const task = { 
        id: 'task-1', 
        title: 'Tomorrow Task',
        dueDate: tomorrow.toISOString().split('T')[0],
        subtasks: []
      };
      
      const result = getAIPriorityScore(task, []);
      assert.ok(result.score >= 30);
      assert.ok(result.reason.includes('明天到期'));
    });

    it('should calculate 2-3 days deadline score', () => {
      const in3days = new Date();
      in3days.setDate(in3days.getDate() + 2);
      const task = { 
        id: 'task-1', 
        title: 'Soon Task',
        dueDate: in3days.toISOString().split('T')[0],
        subtasks: []
      };
      
      const result = getAIPriorityScore(task, []);
      assert.ok(result.score >= 20);
    });

    it('should calculate 4-7 days deadline score', () => {
      const in5days = new Date();
      in5days.setDate(in5days.getDate() + 5);
      const task = { 
        id: 'task-1', 
        title: 'Week Task',
        dueDate: in5days.toISOString().split('T')[0],
        subtasks: []
      };
      
      const result = getAIPriorityScore(task, []);
      assert.ok(result.score >= 10);
    });

    it('should calculate base score for far deadline', () => {
      const in30days = new Date();
      in30days.setDate(in30days.getDate() + 30);
      const task = { 
        id: 'task-1', 
        title: 'Far Task',
        dueDate: in30days.toISOString().split('T')[0],
        subtasks: []
      };
      
      const result = getAIPriorityScore(task, []);
      assert.ok(result.score >= 5);
    });

    it('should add points for incomplete subtasks', () => {
      const in7days = new Date();
      in7days.setDate(in7days.getDate() + 7);
      const task = { 
        id: 'task-1', 
        title: 'Task with Subtasks',
        dueDate: in7days.toISOString().split('T')[0],
        subtasks: [
          { done: false, title: 'Subtask 1' },
          { done: false, title: 'Subtask 2' },
          { done: true, title: 'Subtask 3' }
        ]
      };
      
      const result = getAIPriorityScore(task, []);
      assert.ok(result.score >= 10);
      assert.ok(result.reason.includes('子任务未完成'));
    });

    it('should add points for blocked dependencies', () => {
      const in7days = new Date();
      in7days.setDate(in7days.getDate() + 7);
      const task = { 
        id: 'task-1', 
        title: 'Blocked Task',
        dueDate: in7days.toISOString().split('T')[0],
        dependsOn: ['dep-1', 'dep-2'],
        subtasks: []
      };
      const allTasks = [
        { id: 'dep-1', status: 'todo' },
        { id: 'dep-2', status: 'in-progress' }
      ];
      
      const result = getAIPriorityScore(task, allTasks);
      assert.ok(result.score >= 10);
      assert.ok(result.reason.includes('依赖任务'));
    });

    it('should not add points for completed dependencies', () => {
      const in7days = new Date();
      in7days.setDate(in7days.getDate() + 7);
      const task = { 
        id: 'task-1', 
        title: 'Task',
        dueDate: in7days.toISOString().split('T')[0],
        dependsOn: ['dep-1'],
        subtasks: []
      };
      const allTasks = [
        { id: 'dep-1', status: 'done' }
      ];
      
      const result = getAIPriorityScore(task, allTasks);
      assert.ok(!result.reason.includes('依赖任务'));
    });

    it('should add points for P0 priority', () => {
      const in30days = new Date();
      in30days.setDate(in30days.getDate() + 30);
      const task = { 
        id: 'task-1', 
        title: 'P0 Task',
        dueDate: in30days.toISOString().split('T')[0],
        priority: 'P0',
        subtasks: []
      };
      
      const result = getAIPriorityScore(task, []);
      assert.ok(result.score >= 15);
      assert.ok(result.reason.includes('P0'));
    });

    it('should add points for P1 priority', () => {
      const in30days = new Date();
      in30days.setDate(in30days.getDate() + 30);
      const task = { 
        id: 'task-1', 
        title: 'P1 Task',
        dueDate: in30days.toISOString().split('T')[0],
        priority: 'P1',
        subtasks: []
      };
      
      const result = getAIPriorityScore(task, []);
      assert.ok(result.score >= 10);
    });

    it('should add points for Q1 importance/urgency', () => {
      const in30days = new Date();
      in30days.setDate(in30days.getDate() + 30);
      const task = { 
        id: 'task-1', 
        title: 'Urgent Important Task',
        dueDate: in30days.toISOString().split('T')[0],
        importance: 5,
        urgency: 5,
        subtasks: []
      };
      
      const result = getAIPriorityScore(task, []);
      assert.ok(result.score >= 20);
      assert.ok(result.reason.includes('Q1'));
    });

    it('should add points for high importance', () => {
      const in30days = new Date();
      in30days.setDate(in30days.getDate() + 30);
      const task = { 
        id: 'task-1', 
        title: 'Important Task',
        dueDate: in30days.toISOString().split('T')[0],
        importance: 4,
        urgency: 3,
        subtasks: []
      };
      
      const result = getAIPriorityScore(task, []);
      assert.ok(result.score >= 15);
    });

    it('should normalize score to max 100', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const task = { 
        id: 'task-1', 
        title: 'Max Task',
        dueDate: yesterday.toISOString().split('T')[0],
        priority: 'P0',
        importance: 5,
        urgency: 5,
        subtasks: [{ done: false }, { done: false }, { done: false }, { done: false }],
        dependsOn: ['dep-1', 'dep-2', 'dep-3']
      };
      const allTasks = [
        { id: 'dep-1', status: 'todo' },
        { id: 'dep-2', status: 'todo' },
        { id: 'dep-3', status: 'todo' }
      ];
      
      const result = getAIPriorityScore(task, allTasks);
      assert.ok(result.score <= 100);
    });

    it('should return "high" label for high score', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const task = { 
        id: 'task-1', 
        title: 'High Priority Task',
        dueDate: yesterday.toISOString().split('T')[0],
        priority: 'P0',
        importance: 5,
        urgency: 5,
        subtasks: [{ done: false }, { done: false }]
      };
      
      const result = getAIPriorityScore(task, []);
      assert.strictEqual(result.label, 'high');
    });

    it('should return "low" label for low score', () => {
      const in30days = new Date();
      in30days.setDate(in30days.getDate() + 30);
      const task = { 
        id: 'task-1', 
        title: 'Low Priority Task',
        dueDate: in30days.toISOString().split('T')[0],
        subtasks: []
      };
      
      const result = getAIPriorityScore(task, []);
      assert.strictEqual(result.label, 'low');
    });

    it('should combine multiple factors correctly', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const task = { 
        id: 'task-1', 
        title: 'Complex Task',
        dueDate: yesterday.toISOString().split('T')[0],
        priority: 'P0',
        importance: 4,
        urgency: 4,
        subtasks: [{ done: false }],
        dependsOn: ['dep-1']
      };
      const allTasks = [{ id: 'dep-1', status: 'todo' }];
      
      const result = getAIPriorityScore(task, allTasks);
      assert.ok(result.score > 50);
      assert.ok(result.reason.includes('逾期'));
      assert.ok(result.reason.includes('P0'));
    });
  });
});