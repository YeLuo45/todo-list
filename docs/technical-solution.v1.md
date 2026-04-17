# Technical Solution — P-20250416-001

## 1. Overview

- **Project**: Web TodoList (个人任务管理)
- **Type**: 前端单页应用 (SPA)
- **Tech Stack**: React + localStorage
- **Deployment**: GitHub Pages (静态托管)
- **Browser Support**: Chrome / Firefox / Safari 最新版

---

## 2. 功能范围

### 2.1 核心功能（必须）

| 功能 | 描述 |
|------|------|
| 任务增删改 | 新建、编辑、删除任务 |
| 任务状态 | 待办 / 进行中 / 已完成 |
| 分类/标签 | 支持给任务打多个标签，支持按标签筛选 |
| 截止日期 | 任务到期日，支持日期选择器 |
| 优先级 | 高/中/低三级优先级 |
| 优先级提醒 | 任务到期前触发浏览器通知或页面内提醒 |

### 2.2 辅助功能（可选）

| 功能 | 描述 |
|------|------|
| 搜索 | 按标题/内容关键词搜索 |
| 排序 | 按截止日期、优先级、创建时间排序 |
| 统计 | 当日任务数、完成率等简单统计 |

---

## 3. Technical Architecture

### 3.1 项目结构

```
todo-app/
├── public/
│   └── index.html
├── src/
│   ├── components/          # React 组件
│   │   ├── TaskItem.jsx     # 单个任务行
│   │   ├── TaskForm.jsx     # 新建/编辑任务表单
│   │   ├── TaskList.jsx     # 任务列表
│   │   ├── FilterBar.jsx    # 标签筛选 + 搜索 + 排序
│   │   └── ReminderToast.jsx # 提醒通知
│   ├── hooks/
│   │   └── useTasks.js      # 任务 CRUD + localStorage 持久化
│   ├── context/
│   │   └── TaskContext.jsx  # 全局状态（任务列表）
│   ├── utils/
│   │   └── reminder.js      # 到期提醒逻辑
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── package.json
├── vite.config.js           # Vite 构建配置（GitHub Pages 适配）
└── README.md
```

### 3.2 数据模型

```js
// Task 对象
{
  id: string,           // UUID
  title: string,        // 任务标题
  content: string,      // 任务描述（可选）
  tags: string[],       // 标签数组
  priority: 'high' | 'medium' | 'low',
  status: 'todo' | 'in-progress' | 'done',
  dueDate: string | null, // ISO date string, e.g. "2026-04-20"
  createdAt: string,    // ISO datetime
  updatedAt: string,    // ISO datetime
  reminded: boolean,    // 是否已提醒过
}
```

### 3.3 localStorage 结构

```
Key: 'hermes-todo-tasks'
Value: Task[]  (JSON.stringify)
```

### 3.4 提醒机制

- 页面加载时检查所有 `status !== 'done'` 且有 `dueDate` 的任务
- 浏览器 Notification API 发送提醒（需用户授权）
- 降级：页面内 Toast 提醒（无需授权）
- 每人每天同一任务只提醒一次（`reminded` 字段控制）

---

## 4. 构建与部署

### 4.1 构建工具

- **Vite** — 快速构建 + HMR，输出静态文件到 `dist/`

### 4.2 GitHub Pages 部署

- GitHub Actions 自动构建部署
- `base` 配置为仓库名 `/hermes-agent/`（若仓库名非 `username.github.io`）
- 或使用 `gh-pages` 分支手动部署

### 4.3 性能目标

- 首屏加载 < 1s（Lighthouse Score ≥ 90）
- 无后端请求，纯 localStorage 读写

---

## 5. 技术约束

- 纯前端，无需后端 API
- 所有数据存储在浏览器 localStorage（5MB 限制）
- 使用 React 18 + Vite
- 样式：CSS Modules 或 Tailwind CSS（待确认）
- 不使用任何外部 UI 库（保持轻量）

---

## 6. 开发计划

| 阶段 | 内容 | 产出 |
|------|------|------|
| Phase 1 | 项目初始化 + 任务 CRUD | 可运行 Demo |
| Phase 2 | 标签系统 + 筛选/搜索/排序 | 完整列表功能 |
| Phase 3 | 截止日期 + 优先级 + 提醒 | 提醒功能 |
| Phase 4 | GitHub Pages 部署 + 验收 | 上线地址 |

---

*Technical Solution — P-20250416-001*
