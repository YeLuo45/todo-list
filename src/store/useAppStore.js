import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 初始状态
const getInitialTheme = () => {
  // persist middleware 会从 localStorage 恢复，但首次需要检查 prefers-color-scheme
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
};

const initialState = {
  // theme
  theme: getInitialTheme(),

  // sync settings
  githubToken: null,
  githubRepo: 'YeLuo45/todo-list',
  syncSha: null,

  // kanban
  columnOrder: ['todo', 'in-progress', 'done'],
  laneColors: {},

  // comments/users
  users: [
    { id: 'user_1', name: '张三', avatar: '👤', color: '#3b82f6' },
    { id: 'user_2', name: '李四', avatar: '👤', color: '#22c55e' },
    { id: 'user_3', name: '王五', avatar: '👤', color: '#f59e0b' },
    { id: 'user_4', name: '赵六', avatar: '👤', color: '#8b5cf6' },
    { id: 'user_5', name: '钱七', avatar: '👤', color: '#ef4444' },
    { id: 'user_6', name: '孙八', avatar: '👤', color: '#06b6d4' },
  ],
  currentUserId: 'user_1',

  // comments store (keyed by taskId)
  comments: {}, // { taskId: [comment, ...] }

  // slack
  slackWebhookUrl: '',

  // projects/tags
  tagColors: {},
  tagGroups: [],
  projects: [],

  // tag colors (legacy key)
  hermesTagColors: {},

  // backup
  autoBackup: false,
  backupInterval: 1, // hours
  lastBackup: null,

  // ui
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  // ai token
  aiToken: null,
};

// Create store
export const useAppStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      // theme actions
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),

      // sync actions
      setGithubToken: (token) => set({ githubToken: token }),
      setGithubRepo: (repo) => set({ githubRepo: repo }),
      setSyncSha: (sha) => set({ syncSha: sha }),

      // kanban actions
      setColumnOrder: (order) => set({ columnOrder: order }),
      setLaneColors: (colors) => set({ laneColors: colors }),
      setLaneColor: (key, color) => set((s) => ({
        laneColors: { ...s.laneColors, [key]: color }
      })),

      // user actions
      setUsers: (users) => set({ users }),
      setCurrentUserId: (id) => set({ currentUserId: id }),
      getCurrentUser: () => {
        const s = get();
        return s.users.find(u => u.id === s.currentUserId) || s.users[0];
      },
      addUser: (user) => set((s) => ({ users: [...s.users, user] })),
      updateUser: (id, updates) => set((s) => ({
        users: s.users.map(u => u.id === id ? { ...u, ...updates } : u)
      })),
      deleteUser: (id) => set((s) => ({
        users: s.users.filter(u => u.id !== id),
        currentUserId: s.currentUserId === id ? s.users[0]?.id : s.currentUserId,
      })),

      // comment actions (stored per task)
      getComments: (taskId) => {
        const s = get();
        return s.comments[taskId] || [];
      },
      addComment: (taskId, comment) => set((s) => {
        const taskComments = s.comments[taskId] || [];
        return {
          comments: {
            ...s.comments,
            [taskId]: [...taskComments, comment]
          }
        };
      }),
      updateComment: (taskId, commentId, updates) => set((s) => {
        const taskComments = s.comments[taskId] || [];
        return {
          comments: {
            ...s.comments,
            [taskId]: taskComments.map(c => c.id === commentId ? { ...c, ...updates } : c)
          }
        };
      }),
      deleteComment: (taskId, commentId) => set((s) => {
        const taskComments = s.comments[taskId] || [];
        return {
          comments: {
            ...s.comments,
            [taskId]: taskComments.filter(c => c.id !== commentId)
          }
        };
      }),

      // slack
      setSlackWebhookUrl: (url) => set({ slackWebhookUrl: url }),

      // projects/tags
      setTagColors: (colors) => set({ tagColors: colors }),
      setHermesTagColors: (colors) => set({ hermesTagColors: colors }),
      setTagGroups: (groups) => set({ tagGroups: groups }),
      addTagGroup: (group) => set((s) => ({ tagGroups: [...s.tagGroups, group] })),
      updateTagGroup: (id, updates) => set((s) => ({
        tagGroups: s.tagGroups.map(g => g.id === id ? { ...g, ...updates } : g)
      })),
      deleteTagGroup: (id) => set((s) => ({
        tagGroups: s.tagGroups.filter(g => g.id !== id)
      })),
      setProjects: (projects) => set({ projects }),
      addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
      updateProject: (id, updates) => set((s) => ({
        projects: s.projects.map(p => p.id === id ? { ...p, ...updates } : p)
      })),
      deleteProject: (id) => set((s) => ({
        projects: s.projects.filter(p => p.id !== id)
      })),

      // backup
      setAutoBackup: (val) => set({ autoBackup: val }),
      setBackupInterval: (h) => set({ backupInterval: h }),
      setLastBackup: (ts) => set({ lastBackup: ts }),

      // online status
      setOnline: (val) => set({ isOnline: val }),

      // ai token
      setAiToken: (token) => set({ aiToken: token }),

      // init from legacy localStorage keys (migration)
      migrateFromLegacy: () => {
        // 迁移 hermes-tag-colors-v1 到 hermesTagColors
        try {
          const tc = localStorage.getItem('hermes-tag-colors-v1');
          if (tc && !get().hermesTagColors) {
            set({ hermesTagColors: JSON.parse(tc) });
          }
        } catch {}

        // 迁移 hermes_kanban_column_order 到 columnOrder
        try {
          const co = localStorage.getItem('hermes_kanban_column_order');
          if (co) {
            const parsed = JSON.parse(co);
            if (Array.isArray(parsed) && parsed.length > 0) {
              set({ columnOrder: parsed });
            }
          }
        } catch {}

        // 迁移 hermes_lane_colors 到 laneColors
        try {
          const lc = localStorage.getItem('hermes_lane_colors');
          if (lc) {
            set({ laneColors: JSON.parse(lc) });
          }
        } catch {}

        // 迁移 hermes_users_v1 到 users
        try {
          const users = localStorage.getItem('hermes_users_v1');
          if (users) {
            set({ users: JSON.parse(users) });
          }
        } catch {}

        // 迁移 hermes_current_user 到 currentUserId
        try {
          const cu = localStorage.getItem('hermes_current_user');
          if (cu) {
            set({ currentUserId: cu });
          }
        } catch {}

        // 迁移 hermes_comments_v1 到 comments
        try {
          const comments = localStorage.getItem('hermes_comments_v1');
          if (comments) {
            // 旧格式是扁平数组，新格式是按taskId索引
            const allComments = JSON.parse(comments);
            const byTask = {};
            allComments.forEach(c => {
              if (!byTask[c.taskId]) byTask[c.taskId] = [];
              byTask[c.taskId].push(c);
            });
            set({ comments: byTask });
          }
        } catch {}

        // 迁移 hermes-projects-v1 到 projects
        try {
          const proj = localStorage.getItem('hermes-projects-v1');
          if (proj) {
            set({ projects: JSON.parse(proj) });
          }
        } catch {}

        // 迁移 hermes-tag-groups-v1 到 tagGroups
        try {
          const tg = localStorage.getItem('hermes-tag-groups-v1');
          if (tg) {
            set({ tagGroups: JSON.parse(tg) });
          }
        } catch {}

        // 迁移 slack webhook
        try {
          const slack = localStorage.getItem('hermes_slack_webhook_v1');
          if (slack) {
            set({ slackWebhookUrl: slack });
          }
        } catch {}

        // 迁移 ai token
        try {
          const ai = localStorage.getItem('hermes_ai_token');
          if (ai) {
            set({ aiToken: ai });
          }
        } catch {}

        // 迁移 backup 设置
        try {
          const ab = localStorage.getItem('auto-backup');
          const bi = localStorage.getItem('backup-interval');
          const lb = localStorage.getItem('last-backup-time');
          set({
            autoBackup: ab === 'true',
            backupInterval: bi ? parseInt(bi) : 1,
            lastBackup: lb || null,
          });
        } catch {}
      },
    }),
    {
      name: 'hermes-app-store-v1',
      // 只持久化需要的 key，online 状态不持久化
      partialize: (state) => ({
        theme: state.theme,
        githubToken: state.githubToken,
        githubRepo: state.githubRepo,
        syncSha: state.syncSha,
        columnOrder: state.columnOrder,
        laneColors: state.laneColors,
        users: state.users,
        currentUserId: state.currentUserId,
        comments: state.comments,
        slackWebhookUrl: state.slackWebhookUrl,
        tagColors: state.tagColors,
        tagGroups: state.tagGroups,
        projects: state.projects,
        hermesTagColors: state.hermesTagColors,
        autoBackup: state.autoBackup,
        backupInterval: state.backupInterval,
        lastBackup: state.lastBackup,
        aiToken: state.aiToken,
        // isOnline 不持久化，每次页面加载从 navigator 读取
      }),
    }
  )
);