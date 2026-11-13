# 前端工程

Vue 3 + TypeScript + Vite 工程。登录、注册、找回密码及本人会话页接入现有后端，沿用原型“拾作”的纸张底色、深绿主操作和手作插画。实施及验收见 [T-002](../docs/development/tasks/T-002-frontend-auth.md)；作品与交易页面尚未实现，不填充演示业务数据。

## 环境与依赖

- Node.js 24.22.2、npm 11.19.1；`.node-version` 标记 Node 版本，`package.json` 限定 Node 24 和 npm 11。
- Vue 3.5.45、TypeScript 5.9.3、Vite 8.3.7、Vue Router 4.6.4、Pinia 3.0.4、Axios 1.21.1、Element Plus 2.14.8。
- Router、Pinia 已注册；Axios 已封装直连后端、Session Cookie 与 CSRF。Element Plus 已安装，组件及样式按页面实际需要引入。
- vue-tsc 与 ESLint 已配置；Playwright 1.65.0 和 mysql2 3.24.6 用于账号浏览器联调回归。图表及其他测试依赖按实际业务需要引入。

`package-lock.json` 由 npm 生成；后续使用 `npm ci` 按锁文件安装，不手改锁文件。`.npmrc` 启用版本检查并使用官方 npm 仓库。Node 21 不符合工程要求，需要切换到上述 Node 24 环境。

## 目录

```text
frontend/
├── src/
│   ├── api/                    # 账号认证与健康检查接口
│   ├── assets/styles/          # 静态资源与基础样式
│   ├── components/             # 字标、字段、图标与验证码按钮
│   ├── composables/            # 表单错误、焦点与提交状态
│   ├── layouts/                # 认证页面统一品牌布局
│   ├── router/                 # 认证路由、业务页守卫与安全回跳
│   ├── stores/                 # 只在内存缓存的本人会话
│   ├── types/                  # 公共类型、Result 响应
│   ├── utils/                  # Axios 请求封装
│   ├── views/                  # 登录、注册、找回密码与会话确认页
│   ├── main.ts                 # 注册 Router、Pinia 并挂载 Vue
│   ├── App.vue                 # RouterView 入口
│   └── env.d.ts                # Vite 类型
├── e2e/                        # 真实 HTTP/MySQL/本地 SMTP 浏览器回归
├── playwright.config.ts        # 测试服务及 Chromium 配置
├── public/                     # 原样输出的静态文件，当前空目录
├── .env.example                # 公开的后端 API 地址样例
├── index.html
├── vite.config.ts
├── tsconfig*.json
├── eslint.config.js
├── .node-version / .npmrc
└── package.json / package-lock.json
```

`@/` 指向 `src/`，Vite 与 TypeScript 配置一致。不创建空目录占位文件；源码仅按已开始的业务任务增加。

## 安装、启动与检查

在本目录执行：

```powershell
node --version
npm --version
npm ci
npm run dev
```

开发地址为 `http://localhost:5173`，未登录访问 `/` 自动进入登录页；也可直接访问 `/login`、`/register`、`/forgot-password`。预览为 `http://localhost:4173`，端口占用时直接报错，避免超出后端 CORS 白名单。不配置 Vite API 代理，跨域统一由后端处理。

Axios 默认直连 `http://localhost:8080/api`，可复制 `.env.example` 为 `.env.local` 并修改 `VITE_API_BASE_URL`，修改后重启 Vite。前后端须统一使用 `localhost`，或都使用 `127.0.0.1`；例如前端从 127.0.0.1 打开时，API 地址也应改为 `http://127.0.0.1:8080/api`。VITE 变量会公开到浏览器，不能放密码或密钥。

接口使用 `@/utils/request`，业务调用放在 `api/`；响应为后端 `Result<T>`，失败统一转换为保留 HTTP 状态、业务码及字段错误的 `ApiError`，由页面呈现。封装启用 `withCredentials`；写请求先获取 `/api/csrf` 的当前令牌，不关闭 CSRF。登录后会话只缓存在内存，刷新及业务页导航向服务端重新核验；密码、验证码、会话凭证不写入本地存储。身份变更后忽略旧查询及旧请求 401，避免响应乱序覆盖新身份。

先在 `backend/` 执行 `.\mvnw.cmd spring-boot:run` 启动后端。邮件注册与找回须按[后端说明](../backend/README.md#账号接口与邮件配置)在 `application.yml` 配置平台发件邮箱、SMTP 授权码和验证码密钥；缺少配置时页面显示后端返回的不可用原因，不伪装发送成功。注册后回登录页，登录后返回原站内目标页；当前 `/` 只确认会话及提供退出入口。

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

## 账号浏览器回归

前提：Node/npm 版本符合工程要求，JDK 21 可从 PATH 启动，本机 MySQL 在 3306 可连接，账号与开发配置一致并有创建/删除测试库权限。先在 `backend/` 执行 `.\mvnw.cmd -B -ntp verify` 生成最新可执行 JAR，再回本目录执行：

```powershell
npm ci
npx playwright install msedge
npm run test:e2e
```

已安装 Microsoft Edge 时无需执行安装命令。测试使用 Edge 的 Chromium 内核，自动启动 5173 的 Vite 和 18080 的真实后端；运行前释放这两个端口。夹具创建随机 `handcraft_browser_` 测试库、运行原有 Flyway、启动本地 SMTP 接收端，正常结束后停止测试服务并仅删除自己的测试库。生产 `application.yml` 不会改写，不使用假 API 或生产测试接口。只有断网、响应延迟用例使用浏览器网络故障注入。

测试源码位于 `e2e/`，截图、失败 trace 和后端日志写入被忽略的 `test-results/`。详细结果见 [T-002 测试记录](../docs/testing/T-002-frontend-auth.md)。本地 SMTP 只证明邮件协议与页面闭环，不代表 QQ/163 公网收件；公网收件仍须有效平台 SMTP 配置及真实收件验证。
