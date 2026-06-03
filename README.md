# todolist

离线优先的待办 / 任务管理 Web 应用，支持标签筛选、智能排序与批量操作。界面已针对桌面端与移动端重新设计，支持浅色 / 深色主题自动切换。

## 基本信息

| 项 | 值 |
|---|---|
| 项目 ID | `todolist` |
| 本地路径（WSL） | `/home/hermes/projects/todolist` |
| Windows 访问路径 | `\\wsl$\Ubuntu\home\hermes\projects\todolist`（仅浏览/编辑文件，**不要**在此路径下执行 `npm` / `pnpm`） |
| Git 仓库（canonical） | https://github.com/YeLuo45/todo-list |
| 技术栈 | React 18 + Vite 5 + Zustand + Electron（可选） |
| 线上 Pages | `gh-pages` 分支 → https://yeluo45.github.io/todo-list/ |

## 功能概览

- 任务增删改查、完成状态、优先级与截止日期
- 标签筛选与任务标签徽章
- 智能排序（可配置权重与场景预设）
- 批量选择与批量完成 / 删除
- 本地持久化（Zustand persist）
- 响应式布局：移动端工具栏横滑、卡片式任务列表、深浅色主题
- UI：紫色设计系统（`src/styles/theme.css` + `shell.css`），覆盖合并后的 todo-list 组件样式

## 环境要求

- **Node.js 20.19+** 或 **22.12+**（Vite 8 要求；WSL 下若系统默认是 Node 18，请使用 `~/.n/bin` 或 nvm 切换版本）
- [pnpm](https://pnpm.io/)（推荐）

## 本地启动

开发服务器默认地址：**http://127.0.0.1:5173/**

### Windows 用户必读

项目在 WSL 文件系统时，**请勿**在 PowerShell 中这样启动：

```powershell
cd \\wsl$\Ubuntu\home\hermes\projects\todolist
pnpm dev   # ❌ 会失败
```

典型报错：

```text
用作为当前目录的以上路径启动了 CMD.EXE。
UNC 路径不受支持。默认值设为 Windows 目录。
'vite' 不是内部或外部命令，也不是可运行的程序或批处理文件。
```

| 问题 | 说明 |
|------|------|
| UNC 路径 | `\\wsl$\...` 不能作为 CMD / npm / pnpm 的当前工作目录 |
| 依赖位置 | `node_modules` 在 WSL 内，Windows 侧无法直接调用 `vite` |
| Node 版本 | Vite 8 需要 Node 20.19+；WSL 系统自带的 Node 18 需改用 `~/.n/bin` |

**正确做法**：使用下方「方式一」`dev.ps1`、方式三单行 `wsl`，或打开 **Ubuntu (WSL)** 终端后执行 `bash scripts/dev.sh`。

---

### 方式一：一键脚本（推荐）

**Windows PowerShell**

在 Cursor / 资源管理器中打开项目后，于 PowerShell 执行。

> **注意**：在 `\\wsl$\...` UNC 目录下，`.\scripts\dev.ps1` 可能报「无法识别」。请用下面任一方式。

**推荐（项目根目录 `dev.ps1`）：**

```powershell
cd \\wsl$\Ubuntu\home\hermes\projects\todolist
.\dev.ps1
```

**或 WSL 单行（不依赖 ps1 路径）：**

```powershell
wsl -d Ubuntu bash -lc "export PATH=/home/hermes/.n/bin:/home/hermes/.npm-global/bin:`$PATH; cd /home/hermes/projects/todolist && bash scripts/dev.sh"
```

**或使用 scripts 绝对路径调用：**

```powershell
& "\\wsl$\Ubuntu\home\hermes\projects\todolist\scripts\dev.ps1"
```

可选参数：

```powershell
.\scripts\dev.ps1 -Distro Ubuntu -ProjectPath /home/hermes/projects/todolist -WslUser hermes
```

**WSL / Linux / macOS**

```bash
cd /home/hermes/projects/todolist
pnpm install   # 首次运行
bash scripts/dev.sh
```

---

### 方式二：在 WSL 内手动启动

打开 **Ubuntu (WSL)** 终端：

```bash
cd /home/hermes/projects/todolist
export PATH="$HOME/.n/bin:$HOME/.npm-global/bin:$PATH"   # 若默认 Node 为 18
pnpm install          # 首次需要
pnpm dev --host 127.0.0.1
```

---

### 方式三：PowerShell 单行调用 WSL（不依赖 dev.ps1）

**启动开发服务器：**

```powershell
wsl -d Ubuntu -- bash -lc "cd /home/hermes/projects/todolist && bash scripts/dev.sh"
```

**带 Node 路径（使用 `n` / 用户目录 Node 时推荐）：**

```powershell
wsl -d Ubuntu -- env "HOME=/home/hermes" "PATH=/home/hermes/.n/bin:/home/hermes/.npm-global/bin:/usr/bin:/bin" bash --noprofile --norc -c "cd /home/hermes/projects/todolist && pnpm dev --host 127.0.0.1"
```

**首次安装依赖：**

```powershell
wsl -d Ubuntu -- bash -lc "export PATH=/home/hermes/.n/bin:/home/hermes/.npm-global/bin:\$PATH; cd /home/hermes/projects/todolist && pnpm install"
```

**构建 / 测试（同样在 WSL 内执行）：**

```powershell
wsl -d Ubuntu -- bash -lc "export PATH=/home/hermes/.n/bin:/home/hermes/.npm-global/bin:\$PATH; cd /home/hermes/projects/todolist && pnpm build"
wsl -d Ubuntu -- bash -lc "export PATH=/home/hermes/.n/bin:/home/hermes/.npm-global/bin:\$PATH; cd /home/hermes/projects/todolist && pnpm test"
```

> 若发行版名称不是 `Ubuntu`，将 `-d Ubuntu` 改为 `wsl -l -v` 中列出的名称（如 `Ubuntu-22.04`）。

---

### 常用命令（在 WSL 内执行）

| 命令 | 说明 |
|------|------|
| `.\scripts\dev.ps1` | Windows 下一键启动（走 WSL） |
| `bash scripts/dev.sh` | WSL / Linux 下一键启动 |
| `pnpm dev --host 127.0.0.1` | Vite 开发服务器 |
| `pnpm build` | 生产构建，输出到 `dist/` |
| `pnpm preview` | 预览构建结果 |
| `pnpm test` | 单元测试 |
| `pnpm lint` | ESLint 检查 |

### 常见问题

| 现象 | 处理 |
|------|------|
| `Vite requires Node.js version 20.19+` | 在 WSL 中执行 `export PATH=$HOME/.n/bin:$PATH` 或升级 Node，再重试 |
| `UNC 路径不受支持` / `'vite' 不是内部或外部命令` | 勿在 `\\wsl$\...` 下运行 `pnpm`；改用 `.\scripts\dev.ps1` 或方式三 `wsl` 命令 |
| 5173 端口被占用 | 结束占用进程，或 `pnpm dev --host 127.0.0.1 --port 5174` |

## 项目结构

```
todolist/
├── public/              # 静态资源
├── src/
│   ├── components/      # UI 组件（TaskInput、TaskList、FilterBar 等）
│   ├── store/           # Zustand 状态与 SmartSorter
│   ├── App.tsx
│   ├── App.css          # 主界面与响应式样式
│   └── index.css        # 主题变量（浅色 / 深色）
├── scripts/
│   ├── dev.ps1          # Windows 启动脚本
│   └── dev.sh           # WSL / Linux 启动脚本
├── index.html
├── vite.config.ts
└── package.json
```

## 合并 gh-pages 到本地开发分支

```bash
cd /home/hermes/projects/todolist
bash scripts/merge-gh-pages.sh
```

## 部署

```bash
npm run build
# 将 dist/ 推送到 gh-pages 或走 GitHub Actions
```

具体流程可参考仓库内 `docs/` 或 `.github/workflows`。
