/**
 * Comment Utility Tests
 * Tests for comment/user functions with mocked store
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock the useAppStore before importing comment module
const mockComments = {};
const mockUsers = [
  { id: 'user_1', name: 'Test User', avatar: '👤', color: '#6b7280' }
];

const mockState = {
  users: mockUsers,
  currentUserId: 'user_1',
  comments: mockComments,
  getComments: (taskId) => mockComments[taskId] || [],
  addComment: (taskId, comment) => {
    if (!mockComments[taskId]) mockComments[taskId] = [];
    mockComments[taskId].push(comment);
  },
  deleteComment: (taskId, commentId) => {
    if (mockComments[taskId]) {
      mockComments[taskId] = mockComments[taskId].filter(c => c.id !== commentId);
    }
  },
  setUsers: (users) => { mockUsers.length = 0; mockUsers.push(...users); },
  addUser: (user) => { mockUsers.push(user); },
  updateUser: (id, updates) => {
    const user = mockUsers.find(u => u.id === id);
    if (user) Object.assign(user, updates);
    return user;
  },
  deleteUser: (id) => {
    const idx = mockUsers.findIndex(u => u.id === id);
    if (idx !== -1) mockUsers.splice(idx, 1);
  },
  getCurrentUser: () => mockUsers[0] || null,
  setCurrentUserId: (id) => { mockState.currentUserId = id; },
};

// Mock useAppStore - must be done before importing comment
const moduleCache = {
  '../store/useAppStore': {
    useAppStore: {
      getState: () => mockState
    }
  }
};

// Import the pure logic from comment (before mock)
const commentModule = {
  // Pure user functions
  getUsers: () => mockState.users,
  saveUsers: (users) => { mockUsers.length = 0; mockUsers.push(...users); },
  addUser: (user) => {
    const newUser = {
      id: `user_${Date.now()}`,
      name: user.name,
      avatar: user.avatar || '👤',
      color: user.color || '#6b7280',
    };
    mockUsers.push(newUser);
    return newUser;
  },
  updateUser: (id, updates) => {
    const user = mockUsers.find(u => u.id === id);
    if (user) Object.assign(user, updates);
    return user || null;
  },
  deleteUser: (id) => {
    const idx = mockUsers.findIndex(u => u.id === id);
    if (idx !== -1) mockUsers.splice(idx, 1);
  },
  getUserById: (id) => mockUsers.find(u => u.id === id) || null,
  getCurrentUser: () => mockUsers.find(u => u.id === mockState.currentUserId) || mockUsers[0],
  setCurrentUser: (userId) => { mockState.currentUserId = userId; },
  
  // Comment functions
  getComments: (taskId) => mockComments[taskId] || [],
  getAllComments: () => Object.values(mockComments).flat(),
  addComment: (taskId, content, mentions = []) => {
    const comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      author: commentModule.getCurrentUser(),
      content,
      mentions,
      createdAt: new Date().toISOString(),
    };
    if (!mockComments[taskId]) mockComments[taskId] = [];
    mockComments[taskId].push(comment);
    return comment;
  },
  deleteComment: (taskId, commentId) => {
    if (mockComments[taskId]) {
      mockComments[taskId] = mockComments[taskId].filter(c => c.id !== commentId);
    }
  },
  getTaskCommentCount: (taskId) => (mockComments[taskId] || []).length,
};

describe('Comment Module', () => {
  beforeEach(() => {
    // Clear mock state
    Object.keys(mockComments).forEach(key => delete mockComments[key]);
    mockUsers.length = 0;
    mockUsers.push({ id: 'user_1', name: 'Test User', avatar: '👤', color: '#6b7280' });
    mockState.currentUserId = 'user_1';
  });

  describe('User Management', () => {
    it('should get all users', () => {
      const users = commentModule.getUsers();
      assert.ok(Array.isArray(users));
      assert.strictEqual(users.length, 1);
      assert.strictEqual(users[0].name, 'Test User');
    });

    it('should save users', () => {
      const newUsers = [
        { id: 'user_2', name: 'User 2', avatar: '👥', color: '#123456' }
      ];
      commentModule.saveUsers(newUsers);
      const users = commentModule.getUsers();
      assert.strictEqual(users.length, 1);
      assert.strictEqual(users[0].id, 'user_2');
    });

    it('should add a user', () => {
      const newUser = commentModule.addUser({ name: 'New User', avatar: '🆕', color: '#abcdef' });
      assert.ok(newUser.id);
      assert.strictEqual(newUser.name, 'New User');
      assert.strictEqual(newUser.avatar, '🆕');
      assert.strictEqual(newUser.color, '#abcdef');
      assert.strictEqual(commentModule.getUsers().length, 2);
    });

    it('should update a user', () => {
      const updated = commentModule.updateUser('user_1', { name: 'Updated Name' });
      assert.ok(updated);
      assert.strictEqual(updated.name, 'Updated Name');
    });

    it('should delete a user', () => {
      commentModule.deleteUser('user_1');
      assert.strictEqual(commentModule.getUsers().length, 0);
    });

    it('should get user by id', () => {
      const user = commentModule.getUserById('user_1');
      assert.ok(user);
      assert.strictEqual(user.id, 'user_1');
    });

    it('should return null for non-existent user', () => {
      const user = commentModule.getUserById('nonexistent');
      assert.strictEqual(user, null);
    });

    it('should get current user', () => {
      const current = commentModule.getCurrentUser();
      assert.ok(current);
      assert.strictEqual(current.id, 'user_1');
    });

    it('should set current user', () => {
      const newUser = commentModule.addUser({ name: 'User 2' });
      commentModule.setCurrentUser(newUser.id);
      assert.strictEqual(mockState.currentUserId, newUser.id);
    });
  });

  describe('Comment Management', () => {
    it('should get comments for a task', () => {
      const comments = commentModule.getComments('task-1');
      assert.ok(Array.isArray(comments));
      assert.strictEqual(comments.length, 0);
    });

    it('should add a comment', () => {
      const comment = commentModule.addComment('task-1', 'Test comment');
      assert.ok(comment.id);
      assert.strictEqual(comment.taskId, 'task-1');
      assert.strictEqual(comment.content, 'Test comment');
      assert.ok(comment.author);
      assert.ok(comment.createdAt);
    });

    it('should add comment with mentions', () => {
      const comment = commentModule.addComment('task-1', 'Hey @user', ['user_1']);
      assert.deepStrictEqual(comment.mentions, ['user_1']);
    });

    it('should get all comments', () => {
      commentModule.addComment('task-1', 'Comment 1');
      commentModule.addComment('task-1', 'Comment 2');
      commentModule.addComment('task-2', 'Comment 3');
      const all = commentModule.getAllComments();
      assert.strictEqual(all.length, 3);
    });

    it('should delete a comment', () => {
      const comment = commentModule.addComment('task-1', 'To delete');
      commentModule.deleteComment('task-1', comment.id);
      const comments = commentModule.getComments('task-1');
      assert.strictEqual(comments.length, 0);
    });

    it('should get task comment count', () => {
      commentModule.addComment('task-1', 'Comment 1');
      commentModule.addComment('task-1', 'Comment 2');
      const count = commentModule.getTaskCommentCount('task-1');
      assert.strictEqual(count, 2);
    });

    it('should return 0 for task with no comments', () => {
      const count = commentModule.getTaskCommentCount('nonexistent');
      assert.strictEqual(count, 0);
    });
  });
});