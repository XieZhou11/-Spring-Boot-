# PC Web 前端重做开发指南

更新于 2026-11-25。新版前端按业务链路实施，第 1 至 6 批已完成真实后端联调及浏览器验收。 [T-021](../development/tasks/T-021-craftflow-auth-discovery.md) · [T-022](../development/tasks/T-022-craftflow-account-works.md) · [T-023](../development/tasks/T-023-craftflow-requests-quotes-messages.md) · [T-024](../development/tasks/T-024-craftflow-orders-payment-fulfillment.md) · [T-025](../development/tasks/T-025-craftflow-after-sale-reviews-consent.md) · [T-026](../development/tasks/T-026-craftflow-admin-governance.md)

## 1. 实现依据

在现有 Vue 3、TypeScript、Vite 工程中按业务链路分批替换页面。继续使用 Vue Router、Pinia、Axios 请求层和已有业务调用。每批从正常路由进入、接通真实后端并独立验收。 [技术选型](decisions/ADR-001-technology-stack.md) · [前端工程](../../frontend/README.md)

| 页面或接口情况 | 实现方式 |
| --- | --- |
| 原型已有页面，且符合真实业务 | 参照原型的布局、配色、间距、组件和交互，接入真实业务数据和操作。 |
| 原型已有页面，交互与真实业务不一致 | 按真实后端接口调整操作入口、表单字段、按钮资格、状态与反馈。验证码由服务器实际发送，角色切换由会话和账号资格决定，交易结果读取接口。 |
| 原型缺少页面、操作或状态 | 沿用原型的布局与样式自行设计。按业务需要补齐地址编辑、定向邀约、举报详情、后台综合订单、资金查询等页面，以及加载、空列表、拒绝、过期和失败重试等状态。 |
| V1.5 要求与当前后端行为不一致 | 记录需求条款、源码或接口位置及受影响的页面和验收项。前端按真实能力展示，缺口单独核实和补齐。V1.5 仍是完整业务验收依据。 |

每批从现有路由与接口封装定位页面和请求，查对应的后端 Controller、DTO、VO 以及 Service 的资格和状态规则。原型页从角色索引查找。 [V1.5 MVP 正文](../requirements/requirements.md) · [角色页面索引](../prototypes/README.md) · [现有路由](../../frontend/src/router/index.ts)

## 2. 开发顺序

| 批次 | 依赖 | 可独立验收的结果 |
| --- | --- | --- |
| 1. 认证、公共布局与作品浏览 | 已有账号和作品查询接口 | 登录后回到目标作品，能浏览、搜索、筛选和进入详情。 |
| 2. 个人中心、创作者入驻、作品与互动 | 第 1 批 | 能维护地址、完成入驻审核、发布作品并进行互动。 |
| 3. 定制需求、报价与消息 | 第 2 批的地址、认证和作品入口 | 公开与定向需求均能走到报价、定标和关联会话。 |
| 4. 现货与定制订单、支付及履约 | 第 2 批的作品和地址、第 3 批的定标订单与会话 | 两类订单按各自流程完成付款、履约和收货。 |
| 5. 售后、结算、评价与成品授权 | 第 4 批的付款及履约状态 | 售后裁定、收入查询、图文评价、案例授权与发布各自走通。 |
| 6. 后台管理与内容治理 | 前几批的审核、交易、售后及评价 | 管理员能跨模块处理审核、举报、暂停和恢复，并查询订单与资金。 |
| 7. 全站联验与新版切换 | 第 1 至 6 批 | 用真实后端走通跨角色流程，核对新版入口和 V1.5 验收范围。 |

### 第 1 批 · 认证、公共布局与作品浏览

已完成。浏览器回归和保留差异见 [T-021 测试记录](../testing/T-021-craftflow-auth-discovery.md)。

- 从登录、注册、找回密码和顶部导航建立样板。以「匠心集 CraftFlow」原型的浅色背景、白色内容区、深色主操作、细边框和状态徽章为参照，统一版心、字号、间距及按钮反馈。
- 重做作品广场与详情，接现有分页和图片读取。关键词、两级品类、交易属性、价格区间和排序走现有查询参数。保留普通用户与管理员的访问边界、登录回跳和管理员显式进入前台的 `/discover`。
- 用受保护的作品链接走一遍登录、回跳、刷新和继续浏览。校验注册后回登录、验证码发送失败与结果未知的反馈，并核对管理员默认跳转到 `/admin/dashboard`。复测 `auth.spec.ts`、`navigation-layout.spec.ts` 和 `work-publication.spec.ts` 的相关用例。 [认证原型](../prototypes/craftflow/AuthView.tsx) · [作品原型](../prototypes/craftflow/BuyerWorks.tsx) · [认证接口](../../frontend/src/api/auth.ts) · [作品广场](../../frontend/src/views/HomeView.vue)

### 第 2 批 · 个人中心、创作者入驻、作品与互动

已完成。浏览器回归和验证范围见 [T-022 测试记录](../testing/T-022-craftflow-account-works.md)。

- 补齐资料、头像、地址、收藏和关注列表。入驻保留材料上传、提交、撤回和补正，并同步接通后台品类与入驻审核入口。按会话资格显示买家和创作者切换，按访问权限展示收款资料。
- 重做作品管理、编辑及后台作品审核，保留草稿、审核历史、下架、两类交易设置及真实图片上传。作品详情和创作者主页继续支持点赞、收藏、关注和图文评论。管理员完成入驻与作品审核所需的页面随这批联调。
- 验收默认地址变更、上传失败保留输入、驳回补正、上架可见、互动状态刷新一致。复测 `personal-center.spec.ts`、`creator-onboarding.spec.ts`、`work-publication.spec.ts`、`work-interactions.spec.ts`。 [创作者原型](../prototypes/craftflow/CreatorViews.tsx) · [个人资料接口](../../frontend/src/api/account.ts) · [入驻接口](../../frontend/src/api/creator.ts) · [作品接口](../../frontend/src/api/work.ts) · [互动接口](../../frontend/src/api/interaction.ts)

### 第 3 批 · 定制需求、报价与消息

已完成。公开与定向需求均已验证定标建单及关联会话，浏览器回归和验证范围见 [T-023 测试记录](../testing/T-023-craftflow-requests-quotes-messages.md)。

- 完成买家需求、草稿、公开发布、单人定向、关闭和复制，以及创作者需求大厅、收到的定向邀约和我的报价。对比表展示实际成交金额、工期、方案、图片、口碑和有效期。定标选地址后读取后端订单与原有中标会话，未中标会话按服务端状态显示为只读。
- 重做会话列表、对话区与系统通知。复用 HTTP 图文发送、分页和已读接口及 WebSocket 实时通知，保留断线补拉、去重、重试与业务引用跳转。
- 分别验收公开和定向需求，核对报价可见范围、撤回重报、定标重试只有一笔订单，以及断线重连后的未读与消息。复测 `custom-requests.spec.ts`、`quote-award.spec.ts`、`request-navigation.spec.ts`、`chat-reliability.spec.ts`。 [需求与报价原型](../prototypes/craftflow/BuyerDemands.tsx) · [消息原型](../prototypes/craftflow/MessageView.tsx) · [需求接口](../../frontend/src/api/customRequest.ts) · [报价接口](../../frontend/src/api/quote.ts) · [通知状态](../../frontend/src/stores/notifications.ts)

### 第 4 批 · 现货与定制订单、支付及履约

已完成。实现及验收见 [T-024](../development/tasks/T-024-craftflow-orders-payment-fulfillment.md) 和 [专项测试记录](../testing/T-024-craftflow-orders-payment-fulfillment.md)。

- 作品详情通过地址弹窗直购，定标后打开共用订单详情。订单双栏保留交易身份、状态和页码，详情显示服务端金额、方案及地址快照。现货建单未知时用原请求键恢复，付款未知时查询详情并按订单重试原条款确认。依据服务端返回的操作资格与时间显示动作和期限。
- 现货付款后进入待发货，使用服务端的精确截止时间。定制付款后进入待开工，保留五节点计划、图文打卡、补充记录、偏差和超期提示。接通运单更正、确认收货及节点跳会话。在订单完成、取消或退款后保持双方会话可达。
- 验收现货付款、发货和收货，以及定制付款、开工、打卡、发货和收货。补查取消释放、付款应答丢失和满 48 小时未开工的无责退款。复测 `work-publication.spec.ts` 的现货主流程、`order-payment.spec.ts`、`order-fulfillment.spec.ts`。 [订单原型](../prototypes/craftflow/OrderView.tsx) · [订单详情](../../frontend/src/views/OrderDetailView.vue) · [订单返回字段](../../backend/src/main/java/com/handcraft/platform/modules/vo/OrderVO.java)

### 第 5 批 · 售后、结算、评价与成品授权

已完成。实现及验收见 [T-025](../development/tasks/T-025-craftflow-after-sale-reviews-consent.md) 和 [专项测试记录](../testing/T-025-craftflow-after-sale-reviews-consent.md)。

- 接入普通售后的买家申请和撤回、双方追加证据、管理员只读查证及裁定。保留按请求键查验和裁定版本校验，核对撤回、驳回或退款后的订单与会话。
- 重做创作者收入与后台资金查询，展示真实待结算、已结算及已取消记录。结算由服务端执行，页面提供只读查询。验证原完成时间、售后状态与金额口径，并按角色显示收款资料。
- 接通买家图文评价和创作者公开口碑，创作者主页支持评价独立分页。通过订单页发起成品公开授权，由买家明确同意或拒绝。授权通知定位原订单的授权区。获同意后从订单进入作品编辑器，经服务端核对后预选来源，案例关闭现货销售并按作品审核流程上架。
- 复测 `order-refund.spec.ts`、`order-refund-flow.spec.ts`、`order-refund-pagination.spec.ts`、`settlement-income.spec.ts`。按既有验收流程把图文评价、口碑变化及案例授权保存为可重复的 E2E。 [售后组件](../../frontend/src/components/OrderRefundPanel.vue) · [结算接口](../../frontend/src/api/income.ts) · [评价接口](../../frontend/src/api/review.ts) · [评价验收](../testing/T-017-order-reviews-reputation.md) · [案例验收](../testing/T-018-custom-publication-consent.md)

### 第 6 批 · 后台管理与内容治理

- 管理台统一使用 CraftFlow 布局。审核中心通过页签切换作品和入驻队列，保留已有详情深链接。看板显示真实汇总和北京时间更新时刻，用户管理分别展示后台暂停与本人暂停，综合订单优先显示售后及超期异常。订单与资金之间的跳转保留筛选。
- 内容举报队列支持四类举报。评价进入专用裁定，评论材料含原文及受保护图片。处置历史记录实际操作及恢复依据。通知和「我的举报」可进入相应详情，按资格补证或异议。
- 后台作品材料、关联用户摘要、历史和图片签名按已提交快照限制访问。举报恢复由服务端校验处置来源及作品版本。 [T-026](../development/tasks/T-026-craftflow-admin-governance.md) · [专项测试记录](../testing/T-026-craftflow-admin-governance.md) · [后台原型](../prototypes/craftflow/AdminViews.tsx)

### 第 7 批 · 全站联验与新版切换

- 用买家、创作者和管理员账号走完作品分享与现货交易、公开和定向定制、无责退款与普通裁定、评价、授权案例、举报处置及资金查询。按 V1.5 第 8 章核对 UC-01 至 UC-40 的验证结果。
- 替换剩余旧页面和旧样式，核对登录回跳、旧书签、列表与详情来回、通知及业务卡片链接。路由调整同步维护既有兼容跳转。
- 共享布局、会话和多个主流程替换后，运行前端类型检查、ESLint、生产构建及全量 Playwright 回归。记录当前结果、已复用的验证结果和仍未覆盖的验收路径。 [V1.5 MVP 正文](../requirements/requirements.md) · [现有路由](../../frontend/src/router/index.ts) · [前端检查说明](../../frontend/README.md)

## 3. 每批的核对方式

1. **接口与状态。** 从现有路由和 API 封装定位入口。复用带 Cookie、CSRF 与会话异常处理的请求层，以及已有的图像授权、并发保护和未知结果核验。网络中断后先查业务结果，字段校验或提交失败保留输入。 [请求层](../../frontend/src/utils/request.ts) · [登录状态](../../frontend/src/stores/auth.ts)
2. **页面呈现。** 选取相同视口和可对齐的数据状态，对照原型的排版、配色、组件和反馈。最终覆盖 PC Chrome 和 Edge，并检查 V1.5 的最小宽度 1366 像素。原型缺少或与业务不一致的界面，按同一视觉风格和真实操作逐项核查。
3. **浏览器回归。** 在 `frontend/` 执行 `npm run type-check`、`npm run lint`、`npm run build`，专项命令示例为 `npm run test:e2e -- e2e/auth.spec.ts`。现有 Playwright 夹具使用后端 JAR、隔离 MySQL 及按需配置的本地 SMTP 和 OSS 接收器。按变更风险覆盖权限、状态、金额、重复请求等分支。 [Playwright 配置](../../frontend/playwright.config.ts) · [测试夹具](../../frontend/e2e/fixtures.ts) · [环境与命令](../../frontend/README.md)
4. **核对已有断言。** 开始开发时记下基线。第 1 批已将管理员默认路由断言同步为 `/admin/dashboard`，并从后台导航进入 `/admin/works` 验证原审核双栏。新版可同步更新标题、元素定位与已变化的导航目标，权限、状态、金额及流水等业务断言继续覆盖。 [导航用例](../../frontend/e2e/navigation-layout.spec.ts) · [路由源码](../../frontend/src/router/index.ts)
5. **记录结果。** 业务开发开始后按仓库约定记录可独立验收的任务和实际验证，沿用相关历史记录及其入口。各批写明实际命令、结果和未覆盖项。 [任务约定](../development/README.md) · [测试记录约定](../testing/README.md)

## 4. 已知业务差异

截至 2026-11-25，静态核对发现 V1.5 §4.2.1 和 UC-19 要求现货全额退款后，创作者确认成品仍可出售时可手动恢复直购。当前普通退款接口只受理定制订单，现货释放逻辑覆盖未付款取消。T-016 也将现货退款和重新销售留待补齐。第 4、5 批依据接口展示现货的实际操作资格。现货退款和手动恢复销售单独补齐后再验收 UC-19 中的对应路径。 [V1.5 MVP 正文](../requirements/requirements.md) · [T-016 现货建单](../development/tasks/T-016-stock-order.md) · [退款资格源码](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/RefundApplicationServiceImpl.java) · [库存更新源码](../../backend/src/main/java/com/handcraft/platform/modules/mapper/WorkMapper.java)

V1.5 §4.9.1 要求处置更正记录依据并保留原结论。当前入驻和作品的审核接口对已有结论仅支持幂等重试，审核结论更正由独立业务任务补齐。 [V1.5 §4.9.1](../requirements/requirements.md#491-审核中心) · [入驻审核](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/CreatorApplicationServiceImpl.java) · [作品审核](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/WorkServiceImpl.java)
