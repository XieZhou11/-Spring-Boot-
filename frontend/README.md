# 前端工程

Vue 3 + TypeScript + Vite 工程。登录注册、个人中心、创作者入驻、管理员审核、两级品类管理及系统通知已接入后端，沿用原型“拾作”的纸张底色、深绿主操作和手作插画。实施及验收见 [T-002](../docs/development/tasks/T-002-frontend-auth.md)、[T-003](../docs/development/tasks/T-003-personal-center.md)、[T-004](../docs/development/tasks/T-004-creator-onboarding.md)。作品发布、审核与浏览见 [T-005](../docs/development/tasks/T-005-work-publication.md)，交易和互动随后续任务接入。

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
│   ├── layouts/                # 前台、个人中心、创作者、消息与独立后台布局
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

先在 `backend/` 执行 `.\mvnw.cmd spring-boot:run` 启动后端。邮件注册与找回须按[后端说明](../backend/README.md#账号接口与邮件配置)在 `application.yml` 配置平台发件邮箱、SMTP 授权码和验证码密钥；缺少配置时页面显示后端返回的不可用原因，不伪装发送成功。注册后回登录页，登录后返回原站内目标页；普通用户访问 `/` 进入作品发现，管理员访问 `/` 默认进入 `/admin/works`。管理员从后台“查看前台作品”进入 `/discover`。

## 导航与工作区（T-008）

按原型 01、07、08、09 调整已实现业务的入口，范围及验收见 [T-008](../docs/development/tasks/T-008-navigation-layout.md)。前台一级导航包含发现作品、我的需求；具有创作者资格的账号另有需求大厅和创作者工作台。首页直接发布需求，消息图标进入独立消息中心；个人中心只维护资料、地址和入驻信息。

后台固定左侧菜单，作品与入驻审核以左队列、右材料详情并排；材料独立滚动，审核操作紧随其后。选择对象、刷新和返回保留 URL 中的筛选及页码，提交结论后同步队列。未提交意见离开须确认，取消后恢复原筛选；退出登录不受草稿确认阻拦。窄屏选择材料后展示详情，通过“返回队列”恢复列表。

创作者工作台统一提供作品、需求大厅、收到的邀约、沟通和认证入口。消息中心以会话列表和当前会话并排，窄屏通过“返回会话列表”切换；系统通知作为同级页签。原 `/account/requests`、`/account/conversations`、`/account/notifications` 兼容重定向到新入口，并保留参数和锚点。

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

管理员登录默认进入后台，从左栏进入 `/admin/creator-applications`，按状态查询队列，在右栏比较上次材料并通过或填写理由驳回；`/admin/categories` 维护两级品类及启停。开发库没有演示品类时，先由管理员新增启用的一级品类，再由普通买家申请。管理员不申请创作者资格。

`/messages/notifications` 查看审核通知、已读状态及未读数；全应用共享原生 WebSocket，多端同步未读，断线最多自动重试 5 次，失败后可手动连接，持久化列表始终独立查询。通过后页首可切换买家/创作者，仅改变当前会话入口，不延长登录有效期。创作者身份进入“我的作品”；T-007需求沟通入口及规则见下文。

## 账号、个人中心、入驻与作品浏览器回归

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

已安装 Microsoft Edge 时无需执行安装命令。测试使用 Edge 的 Chromium 内核，默认自动启动 5173 的 Vite 和 18080 的真实后端；运行前释放这两个测试端口，或按下文使用5174保留开发服务。夹具创建随机 `handcraft_browser_` 测试库、运行原有 Flyway、启动本地 SMTP 接收端，正常结束后停止测试服务并仅删除自己的测试库。生产 `application.yml` 不会改写，不使用假 API 或生产测试接口。只有断网、响应延迟用例使用浏览器网络故障注入。测试期间固定源码及后端JAR，避免热更新重置表单或替换运行中的包。

测试源码位于 `e2e/`，截图、失败 trace 和后端日志写入被忽略的 `test-results/`。个人中心覆盖资料保存/刷新、Unicode 与长度校验、头像本地格式/大小拒绝及真实服务不可用反馈、地区联动与手动补全、字段错误及断网重试、默认地址维护和删除确认、十条容量与他人地址拒绝，并检查 1366/1440 及窄屏布局。常规夹具显式禁用 OSS，保证配置真实凭据后也不会向云端写测试对象；云端上传、签名读取、替换及浏览器计时器续签已单独联调，详见 [T-003 测试记录](../docs/testing/T-003-personal-center.md)。认证结果见 [T-002 测试记录](../docs/testing/T-002-frontend-auth.md)。本地 SMTP 只证明邮件协议与页面闭环，不代表 QQ/163 公网收件；公网收件及找回密码补充验收用户明确暂缓，恢复后仍须真实收件验证。

入驻套件以 `storageMode: 'receiver'` 启动本地 OSS HTTP 接收器，真实 SDK 执行上传、签名读取和删除；管理员提权只作用于夹具随机库，无生产测试接口。用例覆盖撤回重提、驳回补正、丢失提交响应、审核通过、实时通知、已读保持、多会话身份及两级品类，结果见 [T-004 测试记录](../docs/testing/T-004-creator-onboarding.md)。

## 作品发布、审核与浏览

首页 `/` 按原型 01 展示横幅、两级品类、关键词、价格及交易属性组合筛选、排序和每页 20 条作品。`/works/:id` 展示图集、规格、创作说明与交易属性；`/creators/:id` 展示必要公开资料和真实口碑统计。上述页面均要求登录；无评价展示“暂无评价”。

认证创作者在 `/creator/works` 管理草稿、撤回、驳回补正和下架；`/creator/works/new`、`/creator/works/:id/edit` 为四段式表单，图片真实上传、排序并按短时签名续签。创建复用请求键，修改携带版本，响应未知时先核验；上传期间禁用提交，失败与版本冲突保留输入，离开未保存内容须确认。已上架作品的交易设置即时更新，图文修改转待审核并立即停止公开。管理员在 `/admin/works` 及详情审核、比较历史、驳回或说明原因下架。定制需求入口见T-007；购买和互动随对应任务实现。

复测作品链路：`npx playwright test e2e/work-publication.spec.ts`；完整回归：`npm run test:e2e`。作品套件使用隔离 MySQL、真实后端和本地 OSS 协议接收器，云端 OSS 另行验证，实际结果见 [T-005 测试记录](../docs/testing/T-005-work-publication.md)。QQ/163 公网收件及找回密码补充验收为“用户明确暂缓”，保留认证回归。

## 定制需求与需求沟通（T-007）

接口约定见 [T-007](../docs/development/tasks/T-007-custom-requests.md)，页面入口在 T-008 中调整。买家与双身份创作者在 `/my-requests` 管理本人需求，`/my-requests/new` 新建，`/my-requests/:id/edit` 编辑草稿。支持不完整草稿、版本冲突保留输入、真实参考图上传、公开或单人定向发布；发布后正文锁定，关闭或过期后复制新建。从作品详情“发起同类定制”带入作品、作者和品类，从创作者主页“邀请定制”带入作者后选择品类，表单也支持按品类和昵称选择创作者。

`/requests` 为仅认证创作者访问的公开需求大厅，默认主品类，可调整品类、预算交集及发布时间；`/creator/invitations` 为收到的定向邀约及历史。`/requests/:id` 按服务端权限读取，普通买家不能浏览大厅或他人需求。

消息中心并列展示系统通知与 `/messages/conversations` 需求沟通，分别统计未读，页首显示两者总数，超过99显示99+。`/messages/conversations/:id` 支持文字、最多3张私有图片、历史分页、只读归档、未知发送结果的幂等重试；复用唯一 `/api/ws` 连接，断线后HTTP按游标补拉。已读只推进到当前可见区域实际展示的消息，后台标签页和屏幕外消息保留未读。

复测：`npm run test:e2e -- custom-requests.spec.ts`。若5173正用于开发，可在PowerShell先设置 `$env:HANDCRAFT_E2E_PORT='5174'` 再执行测试；配置、所有浏览器上下文、测试后端CORS及本地OSS接收器使用同一来源，不停止开发服务器。18080仍须空闲。真实OSS云端验证在后端单独显式启用，浏览器常规测试只操作隔离库和本地协议接收器。

导航与双栏复测：`npm run test:e2e -- e2e/navigation-layout.spec.ts`；同时保留作品、入驻、需求与图文会话套件验证实际操作，结果见 [T-008 测试记录](../docs/testing/T-008-navigation-layout.md)。
