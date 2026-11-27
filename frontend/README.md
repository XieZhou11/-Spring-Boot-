# 前端工程

**PC Web 使用匠心集 CraftFlow 界面。** 页面接入真实后端，未提供原型的页面沿用新版布局。全站联验及旧书签兼容见 [T-027](../docs/development/tasks/T-027-craftflow-cutover.md)。 [前端重做开发指南](../docs/design/frontend-rebuild-guide.md)

以下为当前 Vue 前端的运行说明和已实现功能记录。

Vue 3 + TypeScript + Vite 工程。前台提供作品发现、定制需求、订单、消息和个人中心，认证创作者可以进入工作台。后台提供审核、用户管理、内容治理、订单和资金查询。业务实现及历史验收从[项目文档中心](../docs/README.md)查阅。

## 环境与依赖

[T-014普通售后与管理员退款裁定](../docs/development/tasks/T-014-refund-adjudication.md)在`/orders/:id`提供售后申请、原窗口、申请历史、双方补证和撤回；后台`/admin/refunds`及`/admin/refunds/:id`提供筛选队列、订单证据/只读聊天和退回核验裁定。未知写入结果按账号和对象保留必要原始输入，刷新后精确核验；管理员新补证版本必须重新查阅确认。实际检查及浏览器验证见[测试记录](../docs/testing/T-014-refund-adjudication.md)。

[T-028 现货普通售后与恢复直购](../docs/development/tasks/T-028-stock-refund-recovery.md) 在现货订单页接入普通售后，在后台售后详情展示成交作品、物流及证据。现货全额退款后，作品作者可以在 `/creator/works` 确认商品未寄出或已退回且可售，设置售价并恢复直购。

现货订单和关联售后详情可以查看并放大成交主图与规格图。后台订单页展示会话摘要，并在能明确定位申请时直达售后详情。售后及评价举报页可分页查阅会话，附件使用对应查证入口取得短期签名。 [T-029 现货快照图片与后台查证](../docs/development/tasks/T-029-stock-snapshot-evidence.md)

从存量作品发起同类定制时，原品类已细分的，表单保留参考作品和受邀作者，并引导选择原主品类下启用的末级。编辑期间品类发生变化时，发布校验会提示重新选择并保留输入。 [T-030 存量品类与定标截止](../docs/development/tasks/T-030-category-continuity-quote-deadline.md)

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

先在 `backend/` 执行 `.\mvnw.cmd spring-boot:run` 启动后端。注册与找回密码使用后端配置的发件邮箱、SMTP 授权码和验证码密钥。注册后回登录页，登录后返回原站内目标页。普通用户访问 `/` 进入作品广场，管理员默认进入 `/admin/dashboard`，可从后台「查看前台作品」进入 `/discover`。 [后端邮件配置](../backend/README.md#账号接口与邮件配置)

## 导航与工作区（T-008）

按原型 01、07、08、09 调整已实现业务的入口，范围及验收见 [T-008](../docs/development/tasks/T-008-navigation-layout.md)。前台一级导航包含发现作品、我的需求及 T-009 新增的我的订单；具有创作者资格的账号另有需求大厅和创作者工作台。首页直接发布需求，消息图标进入独立消息中心；个人中心维护资料、地址和入驻信息，并由T-006增加收藏作品、关注创作者入口。

后台固定左侧菜单，作品与入驻审核以左队列、右材料详情并排；材料独立滚动，审核操作紧随其后。选择对象、刷新和返回保留 URL 中的筛选及页码，提交结论后同步队列。未提交意见离开须确认，取消后恢复原筛选；退出登录不受草稿确认阻拦。窄屏选择材料后展示详情，通过“返回队列”恢复列表。

创作者工作台统一提供作品、需求大厅、收到的邀约、报价、承接订单、沟通和认证入口。交易会话、系统通知和我的举报（`/me/reports`）共用消息中心的页签导航。交易会话以列表和详情并排，窄屏通过「返回会话列表」切换。原 `/account/requests`、`/account/conversations`、`/account/notifications` 兼容重定向到新入口，并保留参数和锚点。

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

普通买家从个人中心的「创作者入驻」进入 `/account/creator-certification`，提交资料及 3—5 件作品的成品、过程图；图片独立上传，表单只保存在内存。待审核可撤回，驳回及撤回后复制原材料补正并新增申请，历史结论和材料可查；通过后姓名与收款资料只读。提交或撤回响应未知时重新查询服务端结果，材料保留用于核对或重试。

管理员登录默认进入后台，从左栏进入 `/admin/creator-applications`，按状态查询队列，在右栏比较上次材料并通过或填写理由驳回；`/admin/categories` 维护两级品类及启停。开发库没有演示品类时，先由管理员新增启用的一级品类，再由普通买家申请。管理员不申请创作者资格。

`/messages/notifications` 查看审核通知、已读状态及未读数；全应用共享原生 WebSocket，多端同步未读，断线最多自动重试 5 次，失败后可手动连接，持久化列表始终独立查询。通过后页首可切换买家/创作者，仅改变当前会话入口，不延长登录有效期。创作者身份进入“我的作品”；T-007需求沟通入口及规则见下文。

## 账号、个人中心、作品、互动与交易浏览器回归

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

验证范围按本次改动选择：优先运行受影响的专项 E2E 用例，确认正面主流程和验收演示路径；`npm run test:e2e` 是全量回归入口，不是每次改动的默认要求。已有测试结果在代码、配置、依赖及共享链路均未受本次改动影响时可复用，不重复执行。边界、并发、权限拒绝和冲突用例按改动风险定向运行；涉及权限、状态、事务、并发、金额或退款等关键规则时，仍须验证受影响分支。完成记录说明本次运行范围、复用的既有结果以及未运行项和原因。各任务记录中的专项命令及全量回归结果是对应任务当时的验证证据，不代表以后每次都需照单全跑。

已安装 Microsoft Edge 时无需执行安装命令。测试使用 Edge 的 Chromium 内核，默认自动启动 5173 的 Vite 和 18080 的真实后端；运行前确认测试端口空闲，或按下文设置独立前后端端口。夹具创建随机 `handcraft_browser_` 测试库、运行原有 Flyway、启动本地 SMTP 接收端，正常结束后停止测试服务并仅删除自己的测试库。互动使用独立随机库组，避免其已发布作品污染既有空首页断言。生产 `application.yml` 不会改写，不使用假 API 或生产测试接口。只有断网、响应延迟用例使用浏览器网络故障注入。测试期间固定源码及后端JAR，避免热更新重置表单或替换运行中的包。

测试源码位于 `e2e/`，截图、失败 trace 和后端日志写入被忽略的 `test-results/`。个人中心覆盖资料保存/刷新、Unicode 与长度校验、头像本地格式/大小拒绝及真实服务不可用反馈、地区联动与手动补全、字段错误及断网重试、默认地址维护和删除确认、十条容量与他人地址拒绝，并检查 1366/1440 及窄屏布局。常规夹具显式禁用 OSS，保证配置真实凭据后也不会向云端写测试对象；云端上传、签名读取、替换及浏览器计时器续签已单独联调，详见 [T-003 测试记录](../docs/testing/T-003-personal-center.md)。认证结果见 [T-002 测试记录](../docs/testing/T-002-frontend-auth.md)。本地 SMTP 只证明邮件协议与页面闭环，不代表 QQ/163 公网收件；公网收件及找回密码补充验收已由用户于 2026-11-23 手动验证通过，见 [T-002 测试记录](../docs/testing/T-002-frontend-auth.md)。

入驻套件以 `storageMode: 'receiver'` 启动本地 OSS HTTP 接收器，真实 SDK 执行上传、签名读取和删除；管理员提权只作用于夹具随机库，无生产测试接口。用例覆盖撤回重提、驳回补正、丢失提交响应、审核通过、实时通知、已读保持、多会话身份及两级品类，结果见 [T-004 测试记录](../docs/testing/T-004-creator-onboarding.md)。

## 作品发布、审核与浏览

CraftFlow 第 2 批覆盖个人中心、入驻、收藏关注、创作者主页、作品管理与编辑，以及后台品类和审核队列。新版编辑器分为基本信息、工艺参数、交易信息、图文详情。作品详情右栏提供点赞、收藏、举报与作者关注，左栏展示公开评论。审核队列沿用详情深链及筛选参数。 [T-022](../docs/development/tasks/T-022-craftflow-account-works.md)

作品广场 `/` 和管理员前台入口 `/discover` 使用 CraftFlow 页面。列表把关键词、两级品类、价格、交易属性、排序和页码写入 URL，每页显示 20 条作品。详情 `/works/:id` 展示图集、规格、创作说明及交易属性，从广场进入时可返回原筛选。创作者主页 `/creators/:id` 复用新版页头和作品卡，展示必要公开资料与真实口碑统计。上述页面均要求登录，无评价时展示“暂无评价”。 [T-021](../docs/development/tasks/T-021-craftflow-auth-discovery.md)

认证创作者在 `/creator/works` 管理草稿、撤回、驳回补正和下架；`/creator/works/new`、`/creator/works/:id/edit` 为四段式表单，图片真实上传、排序并按短时签名续签。创建复用请求键，修改携带版本，响应未知时先核验；上传期间禁用提交，失败与版本冲突保留输入，离开未保存内容须确认。已上架作品的交易设置即时更新，图文修改转待审核并立即停止公开。管理员在 `/admin/works` 及详情审核、比较历史、驳回或说明原因下架。定制需求入口见T-007；互动见T-006，现货购买随后续任务实现。

复测作品链路：`npx playwright test e2e/work-publication.spec.ts`；完整回归：`npm run test:e2e`。作品套件使用隔离 MySQL、真实后端和本地 OSS 协议接收器，云端 OSS 另行验证，实际结果见 [T-005 测试记录](../docs/testing/T-005-work-publication.md)。QQ/163 公网收件及找回密码补充验收已由用户于 2026-11-23 手动验证通过，保留认证回归。

## 作品互动与个人收藏、关注（T-006）

作品详情接入点赞、收藏和图文评论；作者区与创作者主页提供关注，并保留“发起同类定制”和“邀请定制”。个人中心 `/account/favorites`、`/account/following` 支持分页和取消，失效收藏显示“已下架”。评论失败保留文字图片；响应未知时先核对结果，由用户确认后再发。图片按原鉴权端点续签，切换账号或作品清除私有草稿并忽略旧响应；管理员仅读公开内容。

互动回归位于`e2e/work-interactions.spec.ts`，包含真实入驻、发布、审核前置及当前需求邀约共存流程。`e2e/environment.ts`统一测试地址：`HANDCRAFT_E2E_FRONTEND_PORT`优先于兼容变量`HANDCRAFT_E2E_PORT`，后端使用`HANDCRAFT_E2E_BACKEND_PORT`；不设置时保持5173/18080。所有浏览器上下文、HTTP请求、CORS及本地OSS接收器使用同一配置，不修改共享开发配置。

```powershell
$env:HANDCRAFT_E2E_FRONTEND_PORT='15173'
$env:HANDCRAFT_E2E_BACKEND_PORT='19081'
npm run test:e2e
# 只复测互动
npm run test:e2e -- e2e/work-interactions.spec.ts
```

接口与集成交接见[T-006](../docs/development/tasks/T-006-work-interactions.md)，实际验证及本轮云端测试边界见[测试记录](../docs/testing/T-006-work-interactions.md)。

## 定制需求与需求沟通（T-007）

CraftFlow 第 3 批重做买家需求双栏、定向邀约、大厅、报价工作区和消息中心。需求列表的筛选与页码保存在 URL 中，详情和对比页可返回来源列表。报价按创作者分列，定标后通过订单进入原中标会话。消息中心按需求、订单的实际关联提供跳转，已读状态和历史由服务端保存。 [T-023](../docs/development/tasks/T-023-craftflow-requests-quotes-messages.md)

接口约定见 [T-007](../docs/development/tasks/T-007-custom-requests.md)，页面入口在 T-008 中调整。买家与双身份创作者在 `/my-requests` 管理本人需求，`/my-requests/new` 新建，`/my-requests/:id/edit` 编辑草稿。支持不完整草稿、版本冲突保留输入、真实参考图上传、公开或单人定向发布；发布后正文锁定，关闭或过期后复制新建。从作品详情“发起同类定制”带入作品、作者和品类，从创作者主页“邀请定制”带入作者后选择品类，表单也支持按品类和昵称选择创作者。

`/requests` 为仅认证创作者访问的公开需求大厅，默认主品类，可调整品类、预算交集及发布时间；`/creator/invitations` 为收到的定向邀约及历史。`/requests/:id` 按服务端权限读取，普通买家不能浏览大厅或他人需求。

消息中心并列展示系统通知与 `/messages/conversations` 需求沟通，分别统计未读，页首显示两者总数，超过99显示99+。`/messages/conversations/:id` 支持文字、最多3张私有图片、历史分页、只读归档、未知发送结果的幂等重试；复用唯一 `/api/ws` 连接，断线后HTTP按游标补拉。已读只推进到当前可见区域实际展示的消息，后台标签页和屏幕外消息保留未读。

点击聊天输入区的相册图标选择图片。选图后可预览或移除附件，点击「发送」提交。详情页面从有效站内来路打开时，页面返回与浏览器后退恢复原页面的筛选、分页和浏览位置。 [T-036](../docs/development/tasks/T-036-contextual-navigation-chat-icon.md)

[T-010 聊天可靠性优化](../docs/development/tasks/T-010-chat-reliability.md)增加应用心跳：连接建立即发送 PING，收到 PONG 后20秒再次发送，10秒未回应则主动释放旧连接，按1/2/4/8/16秒最多自动重试5次；连接持续至少30秒且再次收到有效 PONG 才恢复重试额度。退出或切换账号时清理旧计时器。首次未读查询独立于实时握手，连接失败时仍显示已保存消息的未读数，重连成功再核对遗漏。聊天事件在100毫秒内合并，详情只补拉当前会话，列表合并在途刷新；重新激活页面和手动刷新仍查询持久化未读。专项复测：`npm run test:e2e -- e2e/chat-reliability.spec.ts`，实际结果见 [T-010 测试记录](../docs/testing/T-010-chat-reliability.md)。

复测：`npm run test:e2e -- custom-requests.spec.ts`。若5173正用于开发，可在PowerShell先设置 `$env:HANDCRAFT_E2E_PORT='5174'` 再执行测试；后端端口也可按T-006说明独立设置，所选测试端口须空闲。配置、所有浏览器上下文、测试后端CORS及本地OSS接收器使用同一来源，不停止开发服务器。真实OSS云端验证在后端单独显式启用，浏览器常规测试只操作隔离库和本地协议接收器。

导航与双栏复测：`npm run test:e2e -- e2e/navigation-layout.spec.ts`；同时保留作品、入驻、需求与图文会话套件验证实际操作，结果见 [T-008 测试记录](../docs/testing/T-008-navigation-layout.md)。

## 报价对比、定标与待付款订单（T-009）

接口与实施状态见 [T-009](../docs/development/tasks/T-009-quote-award.md)。`/requests/:id` 报价区域按服务端 `canQuote` 和原因展示资格，创作者填写金额、自然日工期、方案、补充约定及最多五张私有方案图；本人记录可撤回并保留历史，重报计入每日额度。`/creator/quotes` 集中查看本人报价、按状态筛选及撤回，仅要求登录，失去创作者资格仍可查看本人历史；新报价入口只向当前创作者显示，其他创作者方案不可见。

买家从需求详情进入 `/requests/:id/quotes`，一张表比较最多五份有效报价，按金额、工期或平均评分排序，标记最低价与最短工期；无评价显示“暂无评价”。定标前核对完整方案、测算发货日期与本人收货地址；晚于期望须再次确认，没有地址先到地址管理页补充。未知提交结果锁定原报价、地址、测算日期和请求键，保留原内容重试；明确拒绝后保留输入或要求刷新核对。订单金额来自服务端报价，页面不发送成交价格。

`/orders` 区分我购买的与我承接的订单，身份筛选仅要求登录，失去创作者资格也能继续查看承接历史；`/orders/:id` 展示金额、方案与需求快照、付款截止、状态历史及订单沟通。买家可查看固定的地址快照并取消未付款订单。取消或24小时到期不恢复原报价，需重新发布需求；中标原会话关联订单并继续沟通。报价和订单通知均有相应资源入口。定制付款由T-011接入，制作履约与未开工退款由T-013承接，普通售后由T-014承接；现货建单和结算执行留待后续任务。

复测：`npm run test:e2e -- e2e/quote-award.spec.ts`，先生成最新后端 JAR。测试使用隔离 MySQL、真实 HTTP/WebSocket 及本地 OSS 协议接收器，覆盖撤回重报、上传、排序、资格和方案隐私、晚发货确认、报价与定标丢响应重试、临时刷新失败保留未知提交、本人历史仅登录可读、地址快照、取消时导航保护与旧查询隔离及取消后会话。浏览器图片测试不替代真实 OSS 云端验证；实际结果以任务及测试记录为准。

## 定制订单付款与待开工（T-011）

[T-011](../docs/development/tasks/T-011-order-payment.md)在订单详情内展开模拟付款确认，核对固定地址、金额、自然日工期、定标预计日期及付款测算日期，勾选条款后提交。支付成功显示待开工、支付信息、最终发货日和固定五节点计划，创作者另见脱敏待结算摘要；订单列表支持待开工筛选。开工、打卡及满48小时未开工退款入口由T-013按服务端资格展示。

付款中冻结取消并作废旧查询。网络中断、超时或服务端错误显示“付款结果尚未确认”，先查询再允许用原参数重试；仅查到待付款不能认定原请求失败。确认参数按用户和订单存于sessionStorage，刷新继续核验，不保存金额、地址或账户。临时查询失败保留上下文，权限失效清除敏感内容，退出清理本人待核验记录。订单、需求及会话在通知、连接恢复、页面恢复时核对持久化结果。

付款专项复测：`npm run test:e2e -- e2e/order-payment.spec.ts`，先生成最新后端JAR；实际执行结果见T-011测试记录。

## 定制订单履约与制作进度（T-013）

[T-013](../docs/development/tasks/T-013-order-fulfillment.md)将订单详情制作计划扩展为双方共用的五节点时间轴，按服务端资格显示开工、打卡、跳过、补充、原子发货、更正和收货入口，订单列表补齐履约状态筛选。首次图文、纯文字/纯图片补充及退款凭证都使用私有图片上传、预览与签名续签；上传期间禁止提交，拒绝时保留输入。物流更正展示历史并保持原收货期限；未开工退款按服务端48小时资格开放，确认时显示原实付金额。

履约写入与付款共享查询失效及页面忙碌控制。发送前按用户和订单保存原请求；未知响应先核验，未确认前只能重试同一键和输入，刷新继续恢复；存储失败不发送请求，权限失效清空内容。通知、连接恢复和窗口重新激活均读取最新详情。点击“讨论此进度”进入既有会话并附待发送节点引用，保留本次应用内的既有消息草稿，由用户手动发送。

专项回归：`npm run test:e2e -- e2e/order-fulfillment.spec.ts`，先执行后端verify生成最新JAR；若开发后端正占用标准产物，可用`HANDCRAFT_E2E_BACKEND_JAR`指定独立构建的可执行JAR，路径相对于frontend或使用绝对路径。夹具仅对隔离随机库内由真实业务链建立的订单调整时间，用于48小时退款、自动收货与需求窗口；不增加生产测试接口。实际结果见[T-013测试记录](../docs/testing/T-013-order-fulfillment.md)，普通售后由T-014接入，结算执行继续独立验收。

## CraftFlow 第 4 批 · 订单、支付与履约

从作品详情选择已有地址直购，或从定标结果进入订单详情。`/orders` 支持买入与承接、状态筛选和分页，`/orders/:id` 保留列表条件与进度引用。模拟付款确认及未知结果恢复使用已有接口。现货展示准确发货截止时间和物流，定制展示五节点计划、图文及偏差。两类订单结案后仍可从详情进入原会话。 [T-024](../docs/development/tasks/T-024-craftflow-orders-payment-fulfillment.md) · [测试记录](../docs/testing/T-024-craftflow-orders-payment-fulfillment.md)

## CraftFlow 第 5 批 · 售后、结算、评价与成品授权

订单详情提供定制售后、买家图文评价和成品授权。管理员从 `/admin/refunds` 查证并裁定定制普通售后。创作者从 `/creator/income` 查收入，管理员从 `/admin/settlements` 查资金并打开对应订单。买家可通过通知定位授权区，创作者获同意后可从订单进入作品编辑器关联来源并提交审核。 [T-025](../docs/development/tasks/T-025-craftflow-after-sale-reviews-consent.md) · [测试记录](../docs/testing/T-025-craftflow-after-sale-reviews-consent.md)

## 普通售后与管理员裁定（T-014）

专项：`npm run test:e2e -- e2e/order-refund.spec.ts e2e/order-refund-pagination.spec.ts e2e/order-refund-flow.spec.ts`。`order-refund.spec.ts`通过受控网络验证未知结果、原键核验、版本冲突重阅、存储失败、终态草稿只读与乱序隔离；`order-refund-pagination.spec.ts`验证双方和后台证据/聊天分页及队列条件保留；`order-refund-flow.spec.ts`从注册、入驻、定标及付款的真实链路建立订单，验证双方图文证据、状态恢复、管理员聊天只读、退回核验与原子退款。真实OSS独立结果在后端测试记录中区分，浏览器协议接收器不代替云端验证。详细结果见[T-014测试记录](../docs/testing/T-014-refund-adjudication.md)。

## 收入记录与资金记录（T-015）

创作者工作台新增`/creator/income`收入记录页（导航入口与我的报价同级），后台新增`/admin/settlements`资金记录页；两页均为只读查询，支持结算状态筛选与分页，焦点恢复静默刷新。收入页展示应结算金额、结算状态、结算时间与脱敏收款账户；资金记录页面向管理员展示收款人姓名与账号明文快照。订单详情创作者/管理员视角结算信息区补充结算时间，买家不可见应结算金额。专项：`npm run test:e2e -- e2e/settlement-income.spec.ts`；详细结果见[T-015测试记录](../docs/testing/T-015-settlement-income.md)。

## 订单评价与创作者口碑（T-017）

订单详情在原完成后展示买家评价资格与历史评价；创作者主页展示有效评价列表、平均分、好评率、评价数和完成订单数，报价对比展示同一口碑摘要。买家可上传最多三张图并一次提交；访客可从创作者主页举报评价并附文字/图片。后台 `/admin/review-reports` 提供举报核查、隐藏/删除与更正恢复。评论图片私有上传服务同时保护评价及举报证据引用。浏览器 E2E 由用户指定的其他 AI 执行；本轮静态检查及后端验证见 [T-017 测试记录](../docs/testing/T-017-order-reviews-reputation.md)。
