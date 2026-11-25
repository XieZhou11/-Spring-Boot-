# T-027 全站联验与新版切换测试记录

- 关联任务：[T-027](../development/tasks/T-027-craftflow-cutover.md)
- 环境：Windows、JDK 21、Node 24.22.3、npm 11.6.0、MySQL 8.0。Playwright 使用隔离测试库、真实 Spring Boot JAR、本地 SMTP 和 OSS 协议接收器。

## 本次复测结果

| 检查 | 结果 | 覆盖 |
| --- | --- | --- |
| 后端 Maven `verify` | 执行 339 项，325 通过、0 失败、0 错误、14 条件跳过 | 7 项跳过真实云端 OSS，另 7 项缺少指定的迁移测试数据库。 |
| Edge 全量 Playwright | 101/101 通过 | 两片分别通过 55 和 46 项。包含旧书签、举报加载反馈及单件现货双买家并发。 |
| Chrome 1366 专项 | 10/10 通过 | 登录回跳、定向邀约、公开报价对比、现货竞争、五节点履约、无责退款、评价、举报、后台订单与资金查询。 |
| Chrome 旧详情书签专项 | 1/1 通过 | 原草稿登录回跳、原会话刷新、创作者布局冷启动和后台作品审核筛选栏对齐。 |
| Edge 生产预览复测 | 4/4 通过 | 旧书签、举报通知与补证、授权案例通知锚点及换号、作品详情登录回跳与签名图。 |
| Chrome 和 Edge 页面走查 | 每浏览器 56 次访问通过 | 各在 1366×900 访问 53 个页面和状态，另在 1440×900 抽查作品广场、报价对比和售后裁定。走查未见页面横向溢出、破图或未捕获脚本异常。 |
| 前端类型、ESLint、生产构建 | 通过 | 生产构建、差异检查和 V1.5 正文与副本逐字节一致。 |

后端操作在 `backend/` 执行。前端静态检查和 Edge 全量两片在 `frontend/` 执行，浏览器各运行使用独立端口、测试库和同一后端构建产物。

```powershell
# backend
.\mvnw.cmd -B -ntp '-Dspring.test.context.cache.maxSize=4' '-Dspring.datasource.hikari.maximum-pool-size=4' '-Dspring.datasource.hikari.minimum-idle=1' '-Dlogging.level.root=WARN' verify

# frontend
npm run type-check
npm run lint
npm run build
npm run test:e2e -- --shard=1/2 --output=test-results-t027-edge-1
npm run test:e2e -- --shard=2/2 --output=test-results-t027-edge-2
```

- Chrome 专项沿用本地 `test-results-t023-config/chrome.ts`。生产预览使用 `npm exec -- vite build` 生成指向隔离 API 的产物，再由本地 `test-results-t027-config/preview.ts` 通过 `vite preview` 运行 `auth`、`content-report`、`publication-consent` 和 `work-publication` 的四个目标用例。角色截图和单页原图位于前端本地 `test-results-t027-walk-output/`。
- 后端首次运行触发 MySQL 连接上限。缩小测试上下文缓存和连接池后，定位余下的 SMTP 主机名解析、旧成功日志和旧订单接口断言。修正三处本地测试后，账号邮件闭环、支付事务回滚与提交后记录、共用订单接口的两类订单权限及取消互斥均经专项和全量复测。相关后端测试源码按仓库约定仅保留在本地。
- 生产预览曾复现换号问题。旧会话失效后清除了作品表单，新买家会话恢复时没有显示认证提示。提示改为从当前会话计算后，再次经过旧会话失效和新会话恢复，验证提示出现、旧表单清除且认证入口可用。新增的会话复查用例及受影响的作品编辑路径已定向复测。
- 作品专项曾因地址页和登录页的 Vite 模块读取未完成而超时。两个路径在全量 Edge 中通过，各使用独立缓存定向复测亦通过。类型检查后的一次 ESLint 扫到了本地生产预览产物，将产物移出前端目录后按原命令复测通过。
- 小数据量性能抽查按浏览器 GET 发送至收到响应计时。5 条需求列表为 Edge 62 ms、Chrome 232 ms，2 份报价对比为 Edge 47 ms、Chrome 113 ms。在线消息的历史验收条件见 T-007、T-010。本轮未执行 V1.5 §5.1 参考数据量及 50 并发压测。
- QQ／163 公网收件与找回密码沿用 2026-11-23 用户手动验收。真实云端 OSS 和专用 MySQL 迁移证据沿用对应历史记录。 [账号验收](T-002-frontend-auth.md) · [头像与 OSS](T-003-personal-center.md) · [作品与 OSS](T-005-work-publication.md) · [聊天可靠性](T-010-chat-reliability.md)

## V1.5 验收依据

按需求第 8 章逐项核对。既有记录保留实际条件和覆盖边界。 [V1.5 验收要点](../requirements/requirements.md#8-验收要点)

| 条目 | 核对点及证据 |
| --- | --- |
| UC-01 | `auth.spec.ts` 注册、改发和失败反馈，后端 `AuthIntegrationTest` 错码、过期、重用，公网实收沿用用户验收。 [T-001](T-001-backend-auth.md) · [T-002](T-002-frontend-auth.md) |
| UC-02 | `auth.spec.ts` 重置与旧会话失效，后端覆盖多端撤销。 [T-001](T-001-backend-auth.md) · [T-002](T-002-frontend-auth.md) |
| UC-03 | `creator-onboarding.spec.ts` 上传材料，后端覆盖作品数量、过程图与收款信息校验。 [T-004](T-004-creator-onboarding.md) |
| UC-04 | `creator-onboarding.spec.ts` 撤回、驳回补正与审核，后端覆盖管理员竞争。 [T-004](T-004-creator-onboarding.md) |
| UC-05 | `personal-center.spec.ts` 昵称和地址容量，`creator-onboarding.spec.ts` 多会话角色，`quote-award.spec.ts` 建单地址快照。 [T-003](T-003-personal-center.md) · [T-004](T-004-creator-onboarding.md) · [T-009](T-009-quote-award.md) |
| UC-06 | 后端 `WorkPublicationIntegrationTest` 首发并发额度、草稿重提与跨日额度，编辑器显示原创发布提醒。 [T-005](T-005-work-publication.md) |
| UC-07 | `work-publication.spec.ts` 交易选项、即时更新与重新审核，后端覆盖四种组合。 [T-005](T-005-work-publication.md) |
| UC-08 | `work-interactions.spec.ts` 点赞、收藏、评论、关注，后端覆盖重复、文字长度及附图归属。 [T-006](T-006-work-interactions.md) |
| UC-09 | `work-publication.spec.ts` 受保护入口、回跳、搜索筛选与价格排序，`auth.spec.ts` 旧书签回跳。 [T-021](T-021-craftflow-auth-discovery.md) |
| UC-10 | `custom-requests.spec.ts` 单人定向，后端覆盖资格和其他账号查看、报价拒绝。 [T-007](T-007-custom-requests.md) |
| UC-11 | `custom-requests.spec.ts` 定向首报和定标，后端通用到期与有效报价覆盖 7 天边界。定向路径的 7 天边界沿用通用规则证据。 [T-007](T-007-custom-requests.md) · [T-009](T-009-quote-award.md) |
| UC-12 | 定向报价、原会话关联，以及撤回重报、未成单归档和终态聊天。 [T-023](T-023-craftflow-requests-quotes-messages.md) · [T-009](T-009-quote-award.md) · [T-014](T-014-refund-adjudication.md) |
| UC-13 | `custom-requests.spec.ts` 草稿、发布、关闭复制，后端覆盖发布锁定。 [T-007](T-007-custom-requests.md) |
| UC-14 | 后端 `QuoteAwardIntegrationTest` 每人一份、并发五份和当日 20 次限额。 [T-009](T-009-quote-award.md) |
| UC-15 | `quote-award.spec.ts` 撤回重报，后端覆盖历史、固定有效期和每日限额。 [T-009](T-009-quote-award.md) |
| UC-16 | `quote-award.spec.ts` 对比表与角色权限，后端覆盖对比只读与报价隐私。 [T-023](T-023-craftflow-requests-quotes-messages.md) |
| UC-17 | `quote-award.spec.ts` 定标结果未知后核对，后端覆盖并发唯一、失败回滚与通知。 [T-009](T-009-quote-award.md) |
| UC-18 | 定制和现货取消，后端覆盖 24 小时扫描、现货释放、定制关闭。 [T-009](T-009-quote-award.md) · [T-016](T-016-stock-order.md) |
| UC-19 | `work-publication.spec.ts` 两位买家同时购买、唯一有效单、付款后售出。现货全额退款后手动恢复销售待独立补齐。 [T-016](T-016-stock-order.md) |
| UC-20 | `work-publication.spec.ts` 现货付款直接待发货，页面和接口使用现货状态路径。 [T-024](T-024-craftflow-orders-payment-fulfillment.md) |
| UC-21 | `order-fulfillment.spec.ts` 满 48 小时无责退款，后端覆盖边界、开工竞争和退款幂等。 [T-013](T-013-order-fulfillment.md) |
| UC-22 | `order-fulfillment.spec.ts` 五节点、打样可跳过、图文和发货，后端覆盖回滚。 [T-013](T-013-order-fulfillment.md) |
| UC-23 | 节点图文追加、会话定位、终态只读及会话补证。 [T-013](T-013-order-fulfillment.md) |
| UC-24 | 付款生成初始计划、实际偏差及超期，后端覆盖售后期间及恢复后的去重通知。 [T-011](T-011-order-payment.md) · [T-013](T-013-order-fulfillment.md) |
| UC-25 | 发货、单号更正历史、自动收货与售后占用时长。 [T-013](T-013-order-fulfillment.md) · [T-014](T-014-refund-adjudication.md) |
| UC-26 | `order-refund-flow.spec.ts` 定制售后、双方补证和裁定，后端覆盖暂停履约、恢复和同事务退款。现货申请仍受 UC-19 缺口影响。 [T-014](T-014-refund-adjudication.md) |
| UC-27 | `order-refund-flow.spec.ts` 退回和免退核验，后端覆盖裁定原因与流水。 [T-014](T-014-refund-adjudication.md) |
| UC-28 | 模拟付款和退款重试、唯一流水，以及前台资金操作入口检查。 [T-011](T-011-order-payment.md) · [T-014](T-014-refund-adjudication.md) |
| UC-29 | 现货 100 元付款、定制成交与支付快照、定制原额退款及结算。现货退款金额随 UC-19 补验。 [T-011](T-011-order-payment.md) · [T-015](T-015-settlement-income.md) · [T-016](T-016-stock-order.md) |
| UC-30 | `settlement-income.spec.ts` 资金状态与金额，复用原完成时间、窗口、互斥及扫描幂等的后端记录。 [T-015](T-015-settlement-income.md) |
| UC-31 | 收款审核后只读、已审核账户快照与脱敏展示。 [T-004](T-004-creator-onboarding.md) · [T-015](T-015-settlement-income.md) |
| UC-32 | `order-review.spec.ts` 图文、一次提交、口碑，后端覆盖时限、资格和图片边界。 [T-017](T-017-order-reviews-reputation.md) |
| UC-33 | `order-review.spec.ts` 评价举报分流、处置更正、退款及口碑变化。 [T-017](T-017-order-reviews-reputation.md) · [T-026](T-026-craftflow-admin-governance.md) |
| UC-34 | 多端 WebSocket、持久化补查、去重及归档。在线推送时间采用原隔离环境记录。 [T-007](T-007-custom-requests.md) · [T-010](T-010-chat-reliability.md) |
| UC-35 | 会话角色及归属、终态只读与纯图，后端覆盖 60 秒第 21 条拒绝。 [T-007](T-007-custom-requests.md) |
| UC-36 | `admin-management.spec.ts` 两类暂停独立、旧单履约与沟通，`content-report.spec.ts` 处置和历史，综合订单及资金查询。入驻和作品审核更正仍有 §4.9.1 缺口。 [T-019](T-019-admin-management.md) · [T-026](T-026-craftflow-admin-governance.md) |
| UC-37 | 售出作品仍显示同类定制入口、从源作品发布定向需求且现货库存保持售出。 [T-007](T-007-custom-requests.md) · [T-016](T-016-stock-order.md) |
| UC-38 | `publication-consent.spec.ts` 申请、通知定位、同意或拒绝及重复操作。 [T-018](T-018-custom-publication-consent.md) |
| UC-39 | `publication-consent.spec.ts` 权限、审核上架、来源关联和交易区，案例仅展示与定制。 [T-018](T-018-custom-publication-consent.md) |
| UC-40 | `quote-award.spec.ts` 取消后沟通，`order-fulfillment.spec.ts` 完成及退款后会话，`order-refund-flow.spec.ts` 后续补证。 [T-009](T-009-quote-award.md) · [T-013](T-013-order-fulfillment.md) · [T-014](T-014-refund-adjudication.md) |
