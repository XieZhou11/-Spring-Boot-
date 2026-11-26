# MVP 后端专项审查修复实施计划

- 前四批已通过验收，第五批待开始。制定日期为 2026-11-25。
- 开发基线为 `main` 的 `8a556dc`。需求、业务状态和验收口径见 [V1.5 MVP 需求正文](../requirements/requirements.md)。
- 每次选定一个批次实施。完成该批的关键后端验证和前端主流程联调后，记录结果并交接到下一批。开始实际修复时按仓库约定登记业务任务，验证结果写入对应测试记录。

## 批次及交接条件

| 顺序 | 批次 | 依赖 | 本批验收交付 |
| --- | --- | --- | --- |
| 1 | 现货普通售后与恢复直购 | 现有现货订单、会话、资金记录及定制售后流程 | 现货从付款、申请、补证到全额退款走通，创作者确认商品可售后可恢复直购 |
| 2 | 现货快照图片与后台查证 | 第 1 批的现货售后上下文 | 买卖双方可读订单原图。普通后台订单提供会话摘要，管理员经售后或评价举报查看相关会话及图片 |
| 3 | 存量品类与定标 | 现有作品、需求和报价接口 | 新发布继续校验末级品类，旧需求和作品在新增子品类后仍可交易，到期报价不能定标 |
| 4 | 评论锁序与输入校验 | 可与第 3 批独立实施 | 评论正常举报与删除可用，定制打卡和发货缺图有明确提示，超长图片编号返回字段错误 |
| 5 | 订单日期、关闭与结算通知、看板 | 第 1 批的退款和通知改动 | 两种订单日期口径正确，相关双方能收到通知，看板金额与资金记录一致 |

第 1 批一并处理现货通知允许省略 `requestId`，第 5 批在同一通知入口补充收件方与事件。暂缓的举报事项集中记录在 [T-020 的“待理解和解决的举报问题”](tasks/T-020-content-report-governance.md#待理解和解决的举报问题)。已上架作品首次关联授权案例沿用现有审核行为。

## 第 1 批 · 现货普通售后与恢复直购

**目标。** 现货买家付款后提交合法退款申请，首次提交返回 `201`。申请进入后台队列并通知双方，退款成功时以原实付金额全额退款并取消待结算。实物可售后，创作者可手动恢复直购。对应 §4.2.1、§4.5.4、UC-19、UC-26、UC-27、UC-30。

- [x] **接通申请、补证、撤回和后台队列。** 沿用 `POST /api/orders/{orderId}/refund-applications` 和既有后续接口。调整 `RefundApplicationServiceImpl`、`OrderImageServiceImpl`、`AdminRefundServiceImpl` 和 `AdminRefundMapper`。现货可从待发货、已发货和原完成时间起七天窗口内申请。通过 `orderId` 查找会话并核对双方，现货凭证沿用 `REFUND` 用途。管理员队列查询和总数使用同一份类型条件，聊天图片按订单会话关联校验，兼容现货的空 `requestId`。
- [x] **复用原子退款。** `OrderRefundExecutionServiceImpl` 共用订单锁、原支付校验、唯一退款流水和待结算取消。只有定制分支校验五个制作节点并关闭原需求。现货退款完成后保持 `SOLD_OUT`，旧订单、会话和资金证据继续可查。已发货申请继续走原退回核验。驳回或撤回恢复原状态，已发货的自动收货按售后实际占用时间顺延。
- [x] **恢复直购。** 在 `WorkController`、`WorkService` 和 `WorkMapper` 增加独立动作，采用 `PUT /api/me/works/{id}/stock-availability`。请求携带作品版本、原售出订单编号、未发出或已退回且可售的确认及有效售价。按品类、相关账号、作品、原订单的顺序取得所需锁，校验创作者资格、作品归属、当前售出关联和全额退款。原子写入 `AVAILABLE`、清除 `stock_order_id`、开启直购并记录依据。以原售出订单和作品版本隔离重复或迟到的恢复请求。沿用现货库存和资金唯一约束。
- [x] **接入页面。** 在 `OrderDetailView.vue` 为现货接入 `OrderRefundPanel`，按服务端的申请资格和售后状态显示按钮。后台复用 `AdminRefundsView.vue` 与 `AdminRefundDetailView.vue`，根据订单类型展示查证材料。在 `MyWorksView.vue` 为可恢复的作品增加“恢复直购”，提交后重读作品和库存状态。
- [x] **联调。** 用买家、创作者和管理员完成付款、发货、上传申请凭证、补证、核验退回和批准退款。核对原实付等于退款流水、待结算已取消、退款后仍显示已售出。创作者确认可售并恢复后，第二位买家能建单。另跑一笔定制退款回归，并复用现有 MySQL 用例检查重复裁定和退款与结算的互斥。

[申请服务](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/RefundApplicationServiceImpl.java) · [后台裁定](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/AdminRefundServiceImpl.java) · [退款执行](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/OrderRefundExecutionServiceImpl.java) · [作品库存](../../backend/src/main/java/com/handcraft/platform/modules/mapper/WorkMapper.java) · [售后联调用例](../../frontend/e2e/order-refund-flow.spec.ts)

2026-11-25 第一批验收通过。隔离 MySQL 定向 90 项、Playwright 业务回归 5 项、前端 lint 和构建通过。 [任务](tasks/T-028-stock-refund-recovery.md) · [测试记录](../testing/T-028-stock-refund-recovery.md)

## 第 2 批 · 现货快照图片与后台查证

**目标。** 买卖双方可读成交时的现货主图和规格图。后台综合订单可定位会话，管理员经对应售后或评价举报读取会话正文、历史及图片。对应 §3.1、§4.7.3、§4.9.3、§5.4。

- [x] **接通订单快照图片。** 增加 `GET /api/orders/{orderId}/stock-images/{fileId}`。核对订单双方身份和订单类型，只签发 `agreement_snapshot` 内 `mainImageIds` 或 `specificationImageIds` 引用且可用的作品图片。管理员经对应售后接口访问，将同样的现货快照引用纳入售后图片授权。
- [x] **同步回收和页面。** 在作品图片回收条件中识别同一快照引用。在 `OrderDetailView.vue` 的现货快照区显示主图和规格图，复用短期签名加载与续签方式。没有快照图片的旧单仍可正常显示其他明细。
- [x] **收紧后台综合订单。** `AdminOrderQueryServiceImpl` 停止加载聊天正文，后台订单页展示会话摘要。有明确售后申请编号时链接到该查证页。过渡期 `AdminOrderDetailVO.messages` 返回空数组，便于兼容旧调用方。售后沿用 `/api/admin/refund-applications/{id}/messages` 和图片接口。
- [x] **补评价举报的管理员查证。** 新增 `GET /api/admin/review-reports/{id}/messages` 与 `GET /api/admin/review-reports/{id}/images/{fileId}`。依次校验管理员、评价举报、评价所属订单及订单双方会话。消息按序号翻页，每页最多 50 条。图片须由该会话实际消息引用。读取保持只读，双方已读游标保留原值。`AdminReviewReportsView.vue` 接入新接口，替换原来内嵌的消息列表。普通举报人的详情字段及新举报资格见 T-020 暂缓事项。
- [x] **联调。** 现货建单后换主图或下架，买卖双方仍可看快照原图，第三个测试账号访问该单图片被拒绝。后台普通订单能看到会话摘要。管理员从售后和评价举报查证页分别翻到第二页并打开关联图片。

[作品图片读取](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/WorkImageServiceImpl.java) · [后台订单详情](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/AdminOrderQueryServiceImpl.java) · [售后查证接口](../../backend/src/main/java/com/handcraft/platform/modules/controller/AdminRefundController.java) · [评价举报管理页](../../frontend/src/views/AdminReviewReportsView.vue)

2026-11-25 第二批验收通过。隔离 MySQL 定向 105 项、Playwright 业务回归 20 项、认证补充回归 5 项及前端检查和构建通过。 [任务](tasks/T-029-stock-snapshot-evidence.md) · [测试记录](../testing/T-029-stock-snapshot-evidence.md)

## 第 3 批 · 存量品类与定标截止

**目标。** 新作品和新需求选当前启用的末级品类。已发布需求和已上架作品可沿用原品类编号。定标对报价状态和截止时间使用一致口径。对应 §4.2.3、§4.3.1、§4.4.4、§4.9.2、UC-10、UC-15、UC-17。

- [x] **拆分品类判断。** 在 `CustomRequestPolicyServiceImpl` 区分新发布选类和存量资格。咨询、报价、定标及现货建单允许使用已发布时的品类编号，保留启用状态、认证主品类和账号暂停等当前交易资格。管理员新增子品类后，原一级品类的在途业务仍可处理。已下单后的付款、履约和售后沿用订单关系。
- [x] **对齐公开入口。** 同步 `WorkMapper` 的现货与定制筛选、`WorkServiceImpl` 的详情标志，以及新交易入口的服务端校验。作品发起同类定制时校验来源作品、作者、受邀人与新需求品类。原分类仍可选时沿用该分类。原一级分类已有子类时，`CustomRequestEditorView.vue` 保留来源和受邀人，引导选择同一主品类下启用的末级品类。
- [x] **收紧定标写入。** 修改 `OrderServiceImpl`、`QuoteLifecycleServiceImpl` 和 `QuoteMapper`。在需求、报价及前置竞争锁就绪后，取一个毫秒精度的业务时点。目标报价必须仍为 `ACTIVE`，且 `expires_at` 严格晚于该时点。对其余报价按同一时点区分落选和超时。中标更新附带状态与截止条件，更新失败时回滚整笔定标。沿用原请求键和前端 `409` 刷新行为。
- [x] **联调。** 先用原一级品类发布需求、收一份报价，管理员新增二级品类后完成原单定标，并验证同主品类新末级可以发起同类定制。再用两份报价核对第一份到期时无法生成订单或中标通知，第二份仍可正常定标。用可控业务时钟覆盖恰好到期。

[品类资格](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/CustomRequestPolicyServiceImpl.java) · [定标实现](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/OrderServiceImpl.java) · [需求编辑页](../../frontend/src/views/CustomRequestEditorView.vue) · [定标联调用例](../../frontend/e2e/quote-award.spec.ts)

2026-11-25 第三批验收通过。隔离 MySQL 定向 153 项、Playwright 业务回归 18 项、前端检查、构建及独立审查通过。 [任务](tasks/T-030-category-continuity-quote-deadline.md) · [测试记录](../testing/T-030-category-continuity-quote-deadline.md)

## 第 4 批 · 评论锁序与图片输入

**目标。** 评论举报与作者删除使用同一行锁顺序。无效图片编号和定制打卡缺图返回明确的输入错误。对应 §4.2.4、§4.6.2、UC-08、UC-22。

- [x] **统一评论锁序。** `ContentReportServiceImpl.submitCommentReport` 先读取评论取得作品编号，依次锁作品和评论，锁内重检作品状态、评论归属、可见性及作者删除状态。隔离 MySQL 覆盖并发的两种顺序。举报先完成时举报与删除均成功，删除先完成时举报返回 `404`。
- [x] **缩短相关图片编号输入上限。** 开发库只读检查未发现合法的 19 位文件编号。`OrderReviewDTO`、`ReviewReportDTO`、`ContentReportDTO` 和 `ReviewReportEvidenceDTO` 的 `imageIds` 接受 1–18 位正整数字符串，越界返回字段级 `400`。沿用数据库主键和前端字符串类型，页面以缩略图和张数展示。
- [x] **校验定制图片张数。** `OrderCheckInDTO` 拒绝显式 `null`。`OrderFulfillmentServiceImpl` 在普通打卡及定制包装发货写入前要求 1–6 张，数据库约束继续兜底。现货凭运单发货，节点补充可提交纯文字。
- [x] **联调。** 浏览器验证评论举报与自删、图文评价、带图补证和超长编号字段错误。定制打卡及发货空图有明确提示，各自补一张图后成功。现货只填运单即可发货。

[评论举报](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/ContentReportServiceImpl.java) · [评论删除](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/WorkInteractionServiceImpl.java) · [定制打卡和发货](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/OrderFulfillmentServiceImpl.java) · [制作履约联调用例](../../frontend/e2e/order-fulfillment.spec.ts)

2026-11-26 第四批验收通过。隔离 MySQL 定向 71 项、Playwright 11 项（含单项复测）、前端类型检查、lint、构建及独立审查通过。 [任务](tasks/T-031-comment-lock-image-validation.md) · [测试记录](../testing/T-031-comment-lock-image-validation.md)

## 第 5 批 · 日期、交易通知与资金看板

**目标。** 现货详情显示付款后精确 48 小时的发货截止。两类订单的买卖双方按业务事件收到通知。看板待结算与已结算使用同一个数据库快照。对应 §4.5.3、§4.8.1、§4.9.4。

- [ ] **修正订单日期。** `OrderServiceImpl` 按订单类型填充字段。现货 `shipDate` 是截止时刻的北京时间日期，`shipDeadlineAt` 保留付款后 48 小时，`startDeadlineAt` 返回空。定制保留约定发货日、次日零时截止及开工时限。同步 `OrderVO` 字段说明和前端类型或文案。
- [ ] **补足通知。** 定向订单取消或退款关闭原需求时，在业务事务中向买家与指定创作者各保存一条可跳转的 `REQUEST_CLOSED`，成单会话保持可交流。模拟结算与取消待结算结果通知双方，金额仅限创作者侧。沿用现有事件去重、提交后推送和消息中心跳转。
- [ ] **统一资金快照。** `AdminDashboardServiceImpl` 使用只读一致性事务及同一个业务时点。待结算余额与成功结算流水从同一数据库快照读取，沿用现有状态统计规则。
- [ ] **联调。** 对照一笔现货与一笔定制的付款后日期。取消一笔定向订单，使用买卖双方账号查看通知、跳转和原会话。准备一笔到期测试订单触发结算，检查双方通知、创作者金额及看板金额各自落在正确口径。

[订单详情投影](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/OrderServiceImpl.java) · [业务通知](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/NotificationServiceImpl.java) · [后台看板](../../backend/src/main/java/com/handcraft/platform/modules/serviceImpl/AdminDashboardServiceImpl.java) · [结算联调用例](../../frontend/e2e/settlement-income.spec.ts)

## 联调与阶段交接

每批按工程说明启动前后端，使用隔离 MySQL、买家、创作者及管理员测试账号。前端运行 `npm run type-check` 并核对本批相应页面。金额互斥、评论锁序、定标截止使用相应的定向后端用例。记录实际执行结果、遗留问题和下一批入口。把接口和页面放在同批交付，联调时可直接走日常业务入口。 [后端启动](../../backend/README.md) · [前端启动](../../frontend/README.md) · [开发与任务管理](README.md)
