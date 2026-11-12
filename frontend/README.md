# 前端工程骨架

Vue 3 + TypeScript + Vite 的基础工程。已接入 Router、Pinia、Axios 及常用目录，首页保持空白，无业务页面或演示数据。

## 环境与依赖

- Node.js 24.22.2、npm 11.19.1；`.node-version` 标记 Node 版本，`package.json` 限定 Node 24 和 npm 11。
- Vue 3.5.45、TypeScript 5.9.3、Vite 8.3.7、Vue Router 4.6.4、Pinia 3.0.4、Axios 1.21.1、Element Plus 2.14.8。
- Router、Pinia 已注册；Axios 已封装直连后端、Session Cookie 与 CSRF。Element Plus 已安装，组件及样式按页面实际需要引入。
- vue-tsc 与 ESLint 已配置；ECharts、Vitest、Vue Test Utils、Playwright 在相应图表或测试任务中引入，当前没有业务测试。

`package-lock.json` 由 npm 生成；后续使用 `npm ci` 按锁文件安装，不手改锁文件。`.npmrc` 启用版本检查并使用官方 npm 仓库。Node 21 不符合工程要求，需要切换到上述 Node 24 环境。

## 目录

```text
frontend/
├── src/
│   ├── api/                    # 按业务域组织接口，已有 system.ts 联调入口
│   ├── assets/styles/          # 静态资源与基础样式
│   ├── components/             # 复用组件，当前空目录
│   ├── composables/            # Vue 组合函数，当前空目录
│   ├── layouts/                # 公共布局，当前空目录
│   ├── router/                 # 路由，目前仅空白首页
│   ├── stores/                 # Pinia 业务状态，当前空目录
│   ├── types/                  # 公共类型、Result 响应
│   ├── utils/                  # Axios 请求封装
│   ├── views/                  # 页面，当前只有空白 HomeView
│   ├── main.ts                 # 注册 Router、Pinia 并挂载 Vue
│   ├── App.vue                 # RouterView 入口
│   └── env.d.ts                # Vite 类型
├── public/                     # 原样输出的静态文件，当前空目录
├── .env.example                # 公开的后端 API 地址样例
├── index.html
├── vite.config.ts
├── tsconfig*.json
├── eslint.config.js
├── .node-version / .npmrc
└── package.json / package-lock.json
```

`@/` 指向 `src/`，Vite 与 TypeScript 配置一致。不创建 `.gitkeep` 或其他空目录占位文件；components、composables、layouts、stores、public 等空目录当前只在本地保留，Git 克隆时不会包含，业务开发产生实际文件时再纳入版本库。不提前编写业务组件、store 或工具。

## 安装、启动与检查

在本目录执行：

```powershell
node --version
npm --version
npm ci
npm run dev
```

开发地址为 `http://localhost:5173`，预览为 `http://localhost:4173`，端口占用时直接报错，避免自动切换端口后超出后端 CORS 白名单。页面应为空白。不配置 Vite API 代理，跨域统一由后端处理。

Axios 默认直连 `http://localhost:8080/api`，可复制 `.env.example` 为 `.env.local` 并修改 `VITE_API_BASE_URL`，修改后重启 Vite。前后端须统一使用 `localhost`，或都使用 `127.0.0.1`；例如前端从 127.0.0.1 打开时，API 地址也应改为 `http://127.0.0.1:8080/api`。VITE 变量会公开到浏览器，不能放密码或密钥。

接口使用 `@/utils/request`，业务调用放在 `api/`；响应为后端 `Result<T>`，成功保留 Axios 响应结构，业务失败拒绝 Promise，HTTP/网络错误继续抛出给调用方。封装启用 `withCredentials`；POST/PUT/PATCH/DELETE 等写请求会先获取 `/api/csrf` 的当前令牌再发送请求，不关闭服务端 CSRF 校验。登录与权限流程在后续业务任务中实现。

前后端启动后，可在浏览器开发者工具执行以下命令检查实际封装（仅限 Vite 开发模式）：

```javascript
const { getHealth } = await import('/src/api/system.ts')
await getHealth() // { status: 'UP' }
```

```powershell
npm run type-check
npm run lint
npm run build
npm run preview
```

`build` 包含类型检查，产物写入被 Git 忽略的 `dist/`。`preview` 用于预览本机构建，不是部署方案。网络必须经代理时，在当前终端设置 `HTTP_PROXY`、`HTTPS_PROXY` 或个人 npm 配置，不把个人代理写入项目。

2026-11-12 使用 Node 24.22.2 执行 `npm run lint`、`npm run build`（含类型检查）均通过；使用 Chromium/Playwright 临时验证空白路由、实际 Axios 健康请求、JSON 写请求预检、Session Cookie、无令牌拒绝和携带令牌后返回未登录状态，无页面运行错误。这是框架联调验证，当前没有业务功能或业务测试，尚未安装项目级 Playwright。
