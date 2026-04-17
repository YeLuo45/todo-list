# Hermes TodoList

## 项目信息

- 提案: P-20250416-001
- 技术栈: React 18 + Vite + localStorage + Electron（桌面扩展）
- 状态: 已验收 accepted

## 功能特性

- 新建 / 编辑 / 删除任务
- 标签管理（支持多标签）
- 截止日期设置
- 优先级提醒（P0/P1/P2/P3）
- 搜索与筛选（按创建日期/截止日期/优先级）
- 本地持久化存储（localStorage）
- Electron 桌面客户端扩展（可选）

## 目录结构

```
./
├── index.html              # Vite 入口
├── package.json            # 项目配置
├── vite.config.js          # Vite 构建配置
├── electron/                # Electron 桌面端源码
│   └── main.js
├── src/                     # React 源码
│   ├── App.jsx
│   ├── main.jsx
│   └── components/
├── public/                  # 静态资源
├── dist/                    # 构建产物（GitHub Pages 部署用）
└── README.md                # 本文件
```

## 部署信息

- GitHub Pages: https://yeluo45.github.io/hermes-agent/
- 部署分支: gh-pages（`../todo-ghpages/`）
- 部署方式: GitHub Actions 自动构建推送至 gh-pages 分支

## 本地运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建（输出到 dist/）
npm run build

# Electron 桌面端
npm run electron:dev
```

## 构建产物部署

```bash
# 构建后复制到 todo-ghpages 目录
cp -r dist/* ../todo-ghpages/
cd ../todo-ghpages
git add . && git commit -m "Deploy" && git push origin gh-pages
```
