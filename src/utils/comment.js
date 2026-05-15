// Comment storage utility
const COMMENTS_KEY = 'hermes_comments_v1';

// Default preset users
const DEFAULT_USERS = [
  { id: 'user_1', name: '张三', avatar: '👤', color: '#3b82f6' },
  { id: 'user_2', name: '李四', avatar: '👤', color: '#22c55e' },
  { id: 'user_3', name: '王五', avatar: '👤', color: '#f59e0b' },
  { id: 'user_4', name: '赵六', avatar: '👤', color: '#8b5cf6' },
  { id: 'user_5', name: '钱七', avatar: '👤', color: '#ef4444' },
  { id: 'user_6', name: '孙八', avatar: '👤', color: '#06b6d4' },
];

// User management
export const getUsers = () => {
  try {
    const stored = localStorage.getItem('hermes_users_v1');
    if (stored) {
      return JSON.parse(stored);
    }
    // Initialize with default users
    localStorage.setItem('hermes_users_v1', JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  } catch (e) {
    console.error('Failed to load users:', e);
    return DEFAULT_USERS;
  }
};

export const saveUsers = (users) => {
  try {
    localStorage.setItem('hermes_users_v1', JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save users:', e);
  }
};

export const addUser = (user) => {
  const users = getUsers();
  const newUser = {
    id: `user_${Date.now()}`,
    name: user.name,
    avatar: user.avatar || '👤',
    color: user.color || '#6b7280',
  };
  users.push(newUser);
  saveUsers(users);
  return newUser;
};

export const updateUser = (id, updates) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index !== -1) {
    users[index] = { ...users[index], ...updates };
    saveUsers(users);
    return users[index];
  }
  return null;
};

export const deleteUser = (id) => {
  const users = getUsers();
  const filtered = users.filter(u => u.id !== id);
  saveUsers(filtered);
};

export const getUserById = (id) => {
  const users = getUsers();
  return users.find(u => u.id === id) || null;
};

// Get current user (first user by default, can be changed)
export const getCurrentUser = () => {
  const users = getUsers();
  const currentUserId = localStorage.getItem('hermes_current_user') || users[0]?.id;
  return users.find(u => u.id === currentUserId) || users[0] || { id: 'anonymous', name: '匿名', avatar: '👤', color: '#6b7280' };
};

export const setCurrentUser = (userId) => {
  localStorage.setItem('hermes_current_user', userId);
};

// Comment functions
export const getComments = (taskId) => {
  try {
    const stored = localStorage.getItem(COMMENTS_KEY);
    if (stored) {
      const allComments = JSON.parse(stored);
      return allComments.filter(c => c.taskId === taskId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return [];
  } catch (e) {
    console.error('Failed to load comments:', e);
    return [];
  }
};

export const getAllComments = () => {
  try {
    const stored = localStorage.getItem(COMMENTS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (e) {
    console.error('Failed to load comments:', e);
    return [];
  }
};

export const addComment = (taskId, content, mentions = []) => {
  try {
    const stored = localStorage.getItem(COMMENTS_KEY);
    const allComments = stored ? JSON.parse(stored) : [];
    
    const comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      author: getCurrentUser(),
      content,
      mentions,
      createdAt: new Date().toISOString(),
    };
    
    allComments.push(comment);
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(allComments));
    return comment;
  } catch (e) {
    console.error('Failed to add comment:', e);
    return null;
  }
};

export const deleteComment = (commentId) => {
  try {
    const stored = localStorage.getItem(COMMENTS_KEY);
    if (stored) {
      const allComments = JSON.parse(stored);
      const filtered = allComments.filter(c => c.id !== commentId);
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    console.error('Failed to delete comment:', e);
  }
};

export const getTaskCommentCount = (taskId) => {
  const comments = getComments(taskId);
  return comments.length;
};
