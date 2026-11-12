# 前端工程骨架

Vue 3 + TypeScript + Vite 的最小空白应用。仅保留 HTML 入口、Vue 挂载和空根组件，没有演示页面、业务组件、路由、状态或请求封装。

## 环境与依赖

- Node.js 24.22.2、npm 11.19.1；`.node-version` 标记 Node 版本，`package.json` 限定 Node 24 和 npm 11。
- Vue 3.5.45、TypeScript 5.9.3、Vite 8.3.7、Vue Router 4.6.4、Pinia 3.0.4、Axios 1.21.1、Element Plus 2.14.8。
- Router、Pinia、Axios、Element Plus 仅安装，尚未注册、配置或使用；组件样式和按需导入在实际页面任务中处理。
- vue-tsc 与 ESLint 已配置；ECharts、Vitest、Vue Test Utils、Playwright 在相应图表或测试任务中引入，当前没有业务测试。

`package-lock.json` 由 npm 生成；后续使用 `npm ci` 按锁文件安装，不手改锁文件。`.npmrc` 启用版本检查并使用官方 npm 仓库。Node 21 不符合工程要求，需要切换到上述 Node 24 环境。

## 目录

```text
frontend/
├── src/
│   ├── main.ts                 # 仅挂载 Vue
│   ├── App.vue                 # 空白根组件
│   └── env.d.ts                # Vite 类型
├── index.html
├── vite.config.ts
├── tsconfig*.json
├── eslint.config.js
├── .node-version / .npmrc
└── package.json / package-lock.json
```

页面、路由、组件、资源、状态及接口目录随实际任务建立。

## 安装、启动与检查

在本目录执行：

```powershell
node --version
npm --version
npm ci
npm run dev
```

Vite 终端显示本地访问地址；页面应为空白。没有后端服务或 API 代理，不需要数据库、SMTP 或 OSS 配置。

```powershell
npm run type-check
npm run lint
npm run build
npm run preview
```

`build` 包含类型检查，产物写入被 Git 忽略的 `dist/`。`preview` 用于预览本机构建，不是部署方案。网络必须经代理时，在当前终端设置 `HTTP_PROXY`、`HTTPS_PROXY` 或个人 npm 配置，不把个人代理写入项目。

当前没有业务功能或业务测试；环境要求见本说明的“环境与依赖”。
