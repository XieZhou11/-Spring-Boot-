# T-015 模拟结算与创作者收入记录

- 状态：进行中
- 更新日期：2026-11-20
- 需求依据：[V1.5](../../requirements/requirements.md) 4.5.5、4.8.1、4.9.3（资金记录部分），重点 UC-30，关联 UC-28、UC-29、UC-31；附录 A.4 资金段。承接已完成的 [T-014](T-014-refund-adjudication.md)。
- 关联设计：[数据库表结构](../../design/数据库表结构.md) 4.19 `fund_flow`、4.20 `order_settlement` 及统一锁序。

## 目标与范围

实现两类订单（现货/定制）统一的模拟结算闭环：订单原完成时间起满 7 天、未全额退款且无处理中售后时，定时扫描按支付时保存的已审核收款账户快照生成 `SETTLEMENT` 成功流水，结算记录 `PENDING→SETTLED` 并回写 `settlement_flow_id`、`settled_at`。全程模拟，不接入真实转账，不建设余额、充值、提现、抽成。

交付用户可观察结果：

1. 定时扫描自动结算到期订单；重复扫描、重启、并发触发均不多生成流水。
2. 与售后双向互斥：存在 WAIT_ADMIN 处理中申请不能结算；窗口内已提出申请必须等结论；与 T-014 退款批准原子取消待结算形成双向竞争闭环（偿还 T-014 遗留验收债）。
3. 创作者收入记录：按待结算/已结算/已取消分页查看实付金额、应结算金额、结算时间及脱敏收款账户；订单详情补充结算状态与时间（创作者与管理员可见，买家不可见）。
4. 管理员资金记录：按订单号、状态、时间筛选查看资金记录与账户快照。
5. 结算成功持久化通知创作者（金额只给创作者），提交后推送；关键节点中文日志脱敏分级。

范围外：现货建单（T-016）、评价（T-017）、数据看板与全量订单管理（T-021）。不改写 V1—V7 迁移。

## 验收条件

1. 结算条件全部在锁内重检：结算记录 status=PENDING、订单未全额退款、无处理中售后、`originalCompletedAt + 7 天 <= now`（北京时间毫秒）；恢复已完成沿用最初完成时间，不重开窗口；应结算金额 = 实付金额 = `paidAmount` 三方相等，不等则拒绝。
2. 结算执行同事务生成 `fund_flow` SETTLEMENT/SUCCESS 流水（幂等键沿用 T-014 键风格）、回写 `settlement_flow_id`/`settled_at`、状态改 SETTLED、持久化创作者通知；任一环节失败整体回滚，不留「已结算但无流水」半状态。
3. 幂等：同一订单仅成功结算一次；重复扫描、重复触发返回原结果不多生成流水（`uk_flow_success_order_type`、`uk_flow_idempotency`、`uk_settlement_flow` 数据库约束兜底）。
4. 互斥：存在 WAIT_ADMIN 处理中退款申请不结算；结算与退款批准在同一结算行先到先得，后到方按状态校验拒绝，不产生部分更新。真实 MySQL 并发验证双向竞争。
5. 金额与快照：结算流水金额等于原实付金额；账户快照沿用支付时复制的已审核收款资料，结算时校验原快照，历史不随资料更新改写。
6. 展示：创作者收入记录返回实付/应结算金额、状态、settledAt 及脱敏账户；订单详情对创作者/管理员补充结算状态与时间，买家不可见应结算金额；管理员资金记录含账户快照，非授权视角不可见明文。
7. 通知与日志：结算成功通知创作者同事务持久化、提交后推送；日志记录业务开始、状态变更与完成结果，失败说明阶段与原因，脱敏，不记录收款账号密文与完整 DTO。
8. 前端：创作者工作台新增收入页、后台新增资金记录页，均为只读查询 + 筛选分页；列表分页默认 20 最大 50；登出/权限失效清理查询状态。
9. 状态流转仅 PENDING→SETTLED；CANCELLED 记录保留原金额，不计入待结算/已结算统计；结算完成后资金流水只读。

## 设计与改动位置

- 后端新增 `OrderSettlementService`/`Impl`（单订单结算 + `@Scheduled` 扫描，沿用 `OrderServiceImpl.expireDue()` 模式）、`AdminSettlementService`/`Impl`；`CreatorSettlementController`（`GET /api/creator/settlements`）、`AdminSettlementController`（`GET /api/admin/settlements`）；扩展 `OrderSettlementVO`、新增 `AdminSettlementVO`、`OrderSettlementMapper` 到期扫描查询。
- 锁序沿用 T-014：账号升序 → 需求 → 订单 → 退款 → 结算 → 节点 → 会话 → 文件；锁后以 `policy.now()` 取时；结算执行在结算锁内重检。
- 数据库：V1 已含 `order_settlement` 全部列（`settlement_flow_id`/`settled_at`/`cancelled_at`）与索引，及 `fund_flow` 的 `SETTLEMENT` 类型与每单每类型成功唯一约束，**无需新增迁移**；`OrderSettlement` 实体已补齐三个缺失字段。
- 前端新增 `CreatorIncomeView.vue`（创作者工作台导航）、`AdminSettlementsView.vue`（后台既有列表布局），路由与接口封装接入；`OrderDetailView.vue` 补充结算展示。
- 文档：本任务文件、`docs/testing/T-015-settlement-income.md`、docs/README 索引及数据库设计如有出入再同步。

## 实施步骤

- [x] 核对需求 4.5.5/UC-30 与 V1 库表列，确认无需 V8 迁移；补齐 `OrderSettlement` 实体字段。
- [x] 建立结算核心失败测试（窗口判断、状态校验、幂等），实现 `OrderSettlementService` 锁内重检、SETTLEMENT 流水、状态流转、同事务通知及定时扫描。
- [x] 真实 MySQL 验证结算与退款申请受理/批准的双向并发竞争及边界条件，回归 T-014（结算 10/10、售后并发 18/18、退款 16/16、裁定 10/10 全部通过）。
- [x] 实现创作者收入记录接口与页面、管理员资金记录查询、订单详情结算展示及路由接入（`GET /api/me/settlements`、`GET /api/admin/settlements`，路径沿用项目 `/api/me/**` 惯例）。
- [x] 浏览器专项与全量回归，前端 type-check/lint/build、后端完整 verify。
- [x] 独立审查资金/锁序/权限，修复复验，更新任务、测试记录与索引。

## 验证结果

- 总体结果：通过。测试记录见 [T-015 测试记录](../../testing/T-015-settlement-income.md)。
- 结算集成测试 12/12（真实 MySQL）、资金相关回归 44/44、后端 verify 323 项 0 失败、前端 type-check/lint/build 通过、浏览器专项与全量回归 87/87。
- 独立审查结论：无必须修复项；已采纳并复验四项建议——结算前校验收款快照三键（验收条件 5 缺口）、系统日志统一走 `OperationLogService.record`、脱敏口径统一至 `PayeeSnapshotService`、管理员订单号筛选服务层去空白。

## 审查与遗留问题

- T-014 交接明确：结算实现需补充与普通售后申请/批准的双向竞争验收；本任务以此为重点，已通过真实 MySQL 双线程竞争测试闭环。
- 审查参考项（不阻断）：扫描对确定性冲突按既有惯例重复重试；收入查询存在 N+1（MVP 量级可接受）；`/creator/income` 与既有创作者路由一致未加 requiresCreator。
- `order-fulfillment.spec.ts` 原用例「售后窗口后不执行结算」按需求 4.5.5 更新为「窗口后结算自动生效」，属预期行为变更，已记录于测试文件。
- V7 仅在隔离库验证，开发库由实际启动自动追加，与本任务无关但需在交接时核对版本状态。

## 交接

从本任务及测试记录、当前 V1.5 需求 4.5.5、数据库设计 4.19/4.20 继续；完成后按计划推进 T-016 现货建单。后端测试源码仅本地保留且被 Git 忽略；工作区改动保留，不创建 Git 提交。
