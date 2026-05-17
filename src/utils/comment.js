import { useAppStore } from '../store/useAppStore';

// User management - delegate to store
export const getUsers = () => {
  return useAppStore.getState().users;
};

export const saveUsers = (users) => {
  useAppStore.getState().setUsers(users);
};

export const addUser = (user) => {
  const newUser = {
    id: `user_${Date.now()}`,
    name: user.name,
    avatar: user.avatar || '👤',
    color: user.color || '#6b7280',
  };
  useAppStore.getState().addUser(newUser);
  return newUser;
};

export const updateUser = (id, updates) => {
  const s = useAppStore.getState();
  s.updateUser(id, updates);
  return s.users.find(u => u.id === id) || null;
};

export const deleteUser = (id) => {
  useAppStore.getState().deleteUser(id);
};

export const getUserById = (id) => {
  const users = useAppStore.getState().users;
  return users.find(u => u.id === id) || null;
};

// Get current user
export const getCurrentUser = () => {
  const s = useAppStore.getState();
  return s.users.find(u => u.id === s.currentUserId) || s.users[0];
};

export const setCurrentUser = (userId) => {
  useAppStore.getState().setCurrentUserId(userId);
};

// Comment functions - delegate to store
export const getComments = (taskId) => {
  return useAppStore.getState().getComments(taskId);
};

export const getAllComments = () => {
  const s = useAppStore.getState();
  return Object.values(s.comments).flat();
};

export const addComment = (taskId, content, mentions = []) => {
  const s = useAppStore.getState();
  const comment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    taskId,
    author: s.getCurrentUser(),
    content,
    mentions,
    createdAt: new Date().toISOString(),
  };
  s.addComment(taskId, comment);
  return comment;
};

export const deleteComment = (taskId, commentId) => {
  useAppStore.getState().deleteComment(taskId, commentId);
};

export const getTaskCommentCount = (taskId) => {
  const comments = useAppStore.getState().getComments(taskId);
  return comments.length;
};