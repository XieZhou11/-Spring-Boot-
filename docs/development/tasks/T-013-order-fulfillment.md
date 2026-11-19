# T-013 定制订单履约与制作进度

- 状态：已完成
- 更新日期：2026-11-19
- 需求依据：[V1.5](../../requirements/requirements.md)4.5.2—4.5.5、4.6、4.8，UC-21—UC-25、UC-28—UC-30、UC-35、UC-36、UC-40；承接[T-011](T-011-order-payment.md)。
- 关联设计：[数据库表结构](../../design/数据库表结构.md)订单、节点、追加记录、退款、流水、结算、消息及统一锁序。

## 目标与范围

完成定制已付款订单确认开工、五节点制作、补充、包装发货、运单更正、手动或七天自动收货；增加支付满48小时仍未开工的买家申请系统无责全额退款。同步双方页面、真实私有图片、节点会话引用、持久化通知、超期提醒和七天窗口后的需求完结。普通售后裁定、结算执行、现货、评价与公开授权不在本任务。

## 验收条件

1. 仅本单创作者确认开工、顺序打卡；仅打样可说明原因跳过。首次图文1—6图、5—500字；补充允许纯文字、纯图片或图文，至少一项非空、最多500字及6图，原记录不可覆盖。
2. 前四节点处理后待发货；第五图文、8—30位字母数字运单号、发货时间和自动收货时间同事务生效。更正留存前后值及操作者，不重置发货或自动收货时间。
3. 买家确认或发货满七天无处理中售后自动收货；原完成时间只首次记录。售后中冻结履约，终态节点只读，既有订单会话仍可补证。
4. 满48小时未开工可由买家申请系统无责全额退款；与开工互斥。申请依据、退款流水、REFUNDED订单、CLOSED需求、CANCELLED结算、历史及通知全部提交或回滚，不重复退款、不改原金额。
5. 北京时间判断计划偏差、48小时及七天边界；超期通知每单一次、售后中暂停、恢复可补发未发提醒。订单完成后需求保持IN_TRADE，原完成七天且无处理中售后才COMPLETED，不执行结算。
6. 图片实际类型、大小、数量、用途及订单归属校验；签名授权双方读取，历史图片保留，临时图清理与绑定互斥。创作者仅待发货及历史已发货阶段读必要地址，列表无完整地址。
7. 前端写请求隔离旧查询、保留原请求参数及请求键并核验未知结果；通知、多端、刷新、图片续签及节点引用可回归。权限、状态、原子性及并发使用真实MySQL验证。

## 设计与接口约定

资源前缀`/api/orders/{orderId}`：PUT `production-start`、`progress-nodes/{nodeId}/check-in`、`progress-nodes/{nodeId}/skip`、`shipment`、`shipment/tracking-number`、`receipt`、`no-start-refund`；POST `progress-nodes/{nodeId}/supplements`。首次操作资源201、自然幂等及同键重试200、更正200；字段400、状态冲突409，越权沿用现有403/404。

图文操作使用`requestKey`并核对全部输入；更正提交`expectedTrackingNo`与`trackingNo`，同键先查原历史。退款说明20—500字、凭证0—3图，金额及NO_START_TIMEOUT类型仅服务端决定。V6仅追加节点记录的创作者范围请求键唯一约束，不改V1—V5。

| 写资源 | 请求JSON字段 | 业务约束 |
| --- | --- | --- |
| `production-start`、`receipt` | 无请求体 | 分别仅本单创作者、买家，按首次实际事实自然幂等 |
| `progress-nodes/{nodeId}/check-in` | `requestKey, content, imageIds` | 1—6张图片，5—500字说明；不接受单独第五节点打卡 |
| `progress-nodes/{nodeId}/skip` | `requestKey, skipReason, content` | 仅SAMPLE，原因1—500字，说明10—500字 |
| `progress-nodes/{nodeId}/supplements` | `requestKey, content, imageIds` | 说明可空或省略，图片默认空数组；至少一项非空，最多500字及6图 |
| `shipment` | `requestKey, content, imageIds, trackingNo` | 同时完成第五图文与发货；图文约束同首次打卡 |
| `shipment/tracking-number` | `requestKey, expectedTrackingNo, trackingNo` | 原值匹配后更正，8—30位字母数字；重试核对原历史 |
| `no-start-refund` | `description, imageIds` | 本单自然单例，20—500字及0—3图；相同输入复用原退款，不能覆盖 |

请求键为1—64位ASCII字母、数字、下划线或短横线；客户端为每次新操作生成UUID，同次重试保持原键。全部写接口返回最新`OrderVO`。详情新增`startedAt/startDeadlineAt/trackingNo/shippedAt/autoConfirmAt/originalCompletedAt/serverTime`、`trackingHistory`与`noStartRefund`；`canStart/canShip/canCorrectTracking/canConfirmReceipt/canRequestNoStartRefund`为本次服务端资格。节点返回`records/canCheckIn/canSkip/canSupplement/deviationDays/overdue`；记录包含原请求键、CHECKIN/SKIP/SUPPLEMENT类型、说明、图编号、跳过原因及服务器时间。时间为带北京时间偏移的ISO时间，日期偏差按北京自然日计算，已处理节点固定为实际日期减参考日期。

`trackingHistory`保留请求键、原/新单号、操作者及时间；`noStartRefund`返回说明、凭证编号、原实付金额、退款流水、发生时间和系统依据。列表保持节点及历史图文为空，不返回完整地址或收款资料；结算摘要仅本单创作者详情可见。私图签名接口返回文件编号、短期签名URL及过期时间；未引用仅上传者预览，引用后双方可读，非本单图片不可绑定。

写事务READ_COMMITTED，沿用双方用户升序→需求→订单→下游退款、结算、节点、会话、文件锁序；锁后一次取毫秒北京时刻。业务记录、操作历史和通知同事务，推送及成功日志在提交后执行。GET聚合使用一致只读快照；每分钟扫描每单独立事务并锁后重检。通知事件键独立于跳转订单编号，进度按记录、更正按操作日志去重，超期固定订单键。

进度图片POST `orders/{orderId}/progress-images`、退款图片POST `orders/{orderId}/refund-images`，签名GET `/api/order-progress-images/{fileId}`与`/api/order-refund-images/{fileId}`。节点引用接入现有消息`referencedNodeId`，不能引用他单节点，不创建节点评论。

## 实施步骤

- [x] 先建立关键规则失败测试，补齐V6、数据与查询。
- [x] 实现开工、节点打卡/跳过/补充、私图及节点会话引用。
- [x] 实现发货、更正、收货与扫描、通知及需求完结。
- [x] 实现无责退款及开工竞争、退款原子结果。
- [x] 接通双方页面、未知结果恢复及浏览器回归。
- [x] 真实MySQL/HTTP/WebSocket/OSS验证、独立审查及文档同步。

## 验证结果

- 总体结果：本任务验收条件全部通过。后端完整verify 261项、0失败/错误、6项云端条件跳过，实际执行255项；本次真实订单图片OSS另行1/1通过。履约浏览器专项5/5、全量66/66通过，前端类型、lint及构建退出0。
- 详细命令、失败原因与复测结果见[测试记录](../../testing/T-013-order-fulfillment.md)。

## 审查与遗留问题

独立审查未发现可确认的阻断缺陷。沿用T-012已提交的修复，用户已授权提交并推送本任务；原有开发配置改动保留本地，不纳入本次提交。未主动迁移开发库，启动新版后端时Flyway追加V6。通用verify中6项真实云端条件跳过，本任务订单图片已另行实际云端验证；历史5项云端专项未重跑。

## 交接

从本任务及测试记录、当前需求4.6与数据库退款/结算设计继续普通售后和模拟结算；现货建单、评价及公开授权仍须独立交付。当前需求完成窗口已接通，结算执行未在本任务实现，不能将本任务表述为整个交易平台已经完成。
