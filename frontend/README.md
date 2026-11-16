# 前端工程

Vue 3 + TypeScript + Vite 工程。登录注册、个人中心、创作者入驻、管理员审核、两级品类管理及系统通知已接入后端，沿用原型“拾作”的纸张底色、深绿主操作和手作插画。实施及验收见 [T-002](../docs/development/tasks/T-002-frontend-auth.md)、[T-003](../docs/development/tasks/T-003-personal-center.md)、[T-004](../docs/development/tasks/T-004-creator-onboarding.md)；作品与交易页面尚未实现。

## 环境与依赖

- Node.js 24.22.2、npm 11.19.1；`.node-version` 标记 Node 版本，`package.json` 限定 Node 24 和 npm 11。
- Vue 3.5.45、TypeScript 5.9.3、Vite 8.3.7、Vue Router 4.6.4、Pinia 3.0.4、Axios 1.21.1、Element Plus 2.14.8。
- Router、Pinia 已注册；Axios 已封装直连后端、Session Cookie 与 CSRF。Element Plus 的 Cascader 按需引入组件及样式，使用 `element-china-area-data` 6.1.0 的本地省市区数据。
- vue-tsc 与 ESLint 已配置；Playwright 1.65.0 和 mysql2 3.24.6 用于账号浏览器联调回归。图表及其他测试依赖按实际业务需要引入。

`package-lock.json` 由 npm 生成；后续使用 `npm ci` 按锁文件安装，不手改锁文件。`.npmrc` 启用版本检查并使用官方 npm 仓库。Node 21 不符合工程要求，需要切换到上述 Node 24 环境。

## 目录

```text
frontend/
├── src/
│   ├── api/                    # 认证、本人资料/地址与健康检查接口
│   ├── assets/styles/          # 静态资源与基础样式
│   ├── components/             # 字标、字段、图标、地区联动与验证码按钮
│   ├── composables/            # 表单错误、焦点与提交状态
│   ├── layouts/                # 认证与个人中心统一品牌布局
│   ├── router/                 # 认证路由、业务页守卫与安全回跳
│   ├── stores/                 # 只在内存缓存的本人会话
│   ├── types/                  # 公共类型、Result 响应
│   ├── utils/                  # Axios 请求封装
│   ├── views/                  # 认证、会话、个人资料与收货地址页
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

先在 `backend/` 执行 `.\mvnw.cmd spring-boot:run` 启动后端。邮件注册与找回须按[后端说明](../backend/README.md#账号接口与邮件配置)在 `application.yml` 配置平台发件邮箱、SMTP 授权码和验证码密钥；缺少配置时页面显示后端返回的不可用原因，不伪装发送成功。注册后回登录页，登录后返回原站内目标页；`/` 确认会话，提供退出及个人中心入口。

个人中心的 `/account/profile`、`/account/addresses` 均需登录，直接访问及刷新时向服务端核验身份。资料页保存昵称和简介，登录邮箱只读；头像单独上传，上传中独立显示所选图片预览，服务端成功后才更换当前头像，失败保留原头像并清除预览，也不影响资料保存。上传超时或响应丢失时重新读取当前头像，明确提示结果尚未确认。头像短时访问地址到期前重新读取头像字段，保留表单中未保存的内容；OSS 尚未配置时上传显示暂不可用，其他功能仍可使用。

地址页使用本地省市区三级选择，数据未覆盖或已变更的地区可勾选“手动填写省市区”补全。最多保存 10 条；第一条自动默认，当前默认不能单独取消，删除默认后服务端自动选用最近新增的剩余地址。删除需确认；保存失败保留输入及字段错误。业务规则和本人归属仍由后端验证。

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

## 创作者入驻与审核

普通买家从首页或个人中心进入 `/account/creator-certification`，提交资料及 3—5 件作品的成品、过程图；图片独立上传，表单只保存在内存。待审核可撤回，驳回及撤回后复制原材料补正并新增申请，历史结论和材料可查；通过后姓名与收款资料只读。提交或撤回响应未知时重新查询服务端结果，材料保留用于核对或重试。

管理员登录后从“管理后台”进入 `/admin/creator-applications`，按状态查询队列，在详情比较上次材料并通过或填写理由驳回；`/admin/categories` 维护两级品类及启停。开发库没有演示品类时，先由管理员新增启用的一级品类，再由普通买家申请。管理员不申请创作者资格。

`/account/notifications` 查看审核通知、已读状态及未读数；全应用共享原生 WebSocket，多端同步未读，断线最多自动重试 5 次，失败后可手动连接，持久化列表始终独立查询。通过后页首可切换买家/创作者，仅改变当前会话入口，不延长登录有效期。作品发布和普通聊天随后续功能实现。

## 账号、个人中心与入驻浏览器回归

前提：Node/npm 版本符合工程要求，JDK 21 可从 PATH 启动，本机 MySQL 在 3306 可连接，账号与开发配置一致并有创建/删除测试库权限。先在 `backend/` 执行 `.\mvnw.cmd -B -ntp verify` 生成最新可执行 JAR，再回本目录执行：

```powershell
npm ci
npx playwright install msedge
npm run test:e2e
# 仅复测个人中心
npx playwright test e2e/personal-center.spec.ts
# 仅复测入驻与审核
npx playwright test e2e/creator-onboarding.spec.ts
```

已安装 Microsoft Edge 时无需执行安装命令。测试使用 Edge 的 Chromium 内核，自动启动 5173 的 Vite 和 18080 的真实后端；运行前释放这两个端口。夹具创建随机 `handcraft_browser_` 测试库、运行原有 Flyway、启动本地 SMTP 接收端，正常结束后停止测试服务并仅删除自己的测试库。生产 `application.yml` 不会改写，不使用假 API 或生产测试接口。只有断网、响应延迟用例使用浏览器网络故障注入。

测试源码位于 `e2e/`，截图、失败 trace 和后端日志写入被忽略的 `test-results/`。个人中心覆盖资料保存/刷新、Unicode 与长度校验、头像本地格式/大小拒绝及真实服务不可用反馈、地区联动与手动补全、字段错误及断网重试、默认地址维护和删除确认、十条容量与他人地址拒绝，并检查 1366/1440 及窄屏布局。常规夹具显式禁用 OSS，保证配置真实凭据后也不会向云端写测试对象；云端上传、签名读取、替换及浏览器计时器续签已单独联调，详见 [T-003 测试记录](../docs/testing/T-003-personal-center.md)。认证结果见 [T-002 测试记录](../docs/testing/T-002-frontend-auth.md)。本地 SMTP 只证明邮件协议与页面闭环，不代表 QQ/163 公网收件；公网收件仍须有效平台 SMTP 配置及真实收件验证。

入驻套件以 `storageMode: 'receiver'` 启动本地 OSS HTTP 接收器，真实 SDK 执行上传、签名读取和删除；管理员提权只作用于夹具随机库，无生产测试接口。用例覆盖撤回重提、驳回补正、丢失提交响应、审核通过、实时通知、已读保持、多会话身份及两级品类，结果见 [T-004 测试记录](../docs/testing/T-004-creator-onboarding.md)。
