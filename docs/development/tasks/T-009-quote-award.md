# T-009 多方报价对比与定标建单

- 状态：已完成
- 更新日期：2026-11-17
- 需求依据：[V1.5](../../requirements/requirements.md)4.3、4.4、4.5.1、4.8，UC-14—UC-18及地址快照、订单会话规则。
- 关联设计：[数据库表结构](../../design/数据库表结构.md)报价、订单及统一事务锁序。

## 目标与范围

完成公开/定向需求报价、撤回重报、买家对比、地址确认、原子定标建单、待付款订单查询/取消/24小时超时，以及通知、私有图片和会话关联的前后端闭环。校验已有暂停状态，不增加暂停管理入口；不包含现货建单、支付、履约、退款、结算、互动及后台订单管理。

## 验收条件

- 每人每需求一份有效报价、每需求五份、每日二十次、报价七天有效；并发和截止时刻仍符合规则。
- 仅买家查看所有方案，创作者只看本人报价；定向仅受邀者；禁止自报价，报价图不可越权引用/读取。
- 定标的中标、落选、需求、唯一订单、方案/地址快照、会话、通知与日志一起提交或回滚；重复请求不重复建单。
- 未付款取消或24小时到期关闭需求，原报价不恢复，中标订单会话仍可沟通；查询不写业务。
- 历史图片与快照持续保留，私有OSS实际验证；真实MySQL并发/回滚、HTTP/WebSocket及浏览器回归通过后据实交付。

## 设计与接口约定

沿用职责平级包、Service接口协作、实现方法事务、中文字段注释与脱敏业务日志。追加V5报价创建请求键，不改V1—V4。写事务READ_COMMITTED；锁序品类→用户→需求→报价→订单→会话→文件，同类按编号升序，地址归属与快照受买家用户锁保护。提交后推送并记录成功。

编号为字符串，金额为两位十进制字符串，时间含+08:00。统一Result与PageVO；列表默认20、最大50。

| 方法与路径 | 约定 |
| --- | --- |
| POST /api/custom-requests/{id}/quotes | requestKey(UUID)、goodsAmount、durationDays、proposal、additionalAgreement(可空)、imageIds；首次201，同键同内容200 |
| GET /api/custom-requests/{id}/quotes | page/size/status；买家全部历史，创作者仅本人 |
| GET /api/custom-requests/{id}/quote-comparison | 仅买家；sort=AMOUNT/DURATION/RATING，前两升序、评分降序，无评价最后，同值按报价id升序 |
| GET /api/me/quotes | page/size/status/requestId；本人报价历史 |
| GET /api/me/quote-quota | used、limit、remaining |
| GET /api/quotes/{id} | 买家或报价作者详情 |
| PUT /api/quotes/{id}/withdrawal | 无正文；仅本人有效报价，重复本人撤回返回原记录 |
| POST /api/quote-images、GET /api/quote-images/{id} | file上传/鉴权签名，沿用ImageVO |
| PUT /api/custom-requests/{id}/award | requestKey(UUID)、quoteId、addressId、confirmedEstimatedShipDate(YYYY-MM-DD)；首次201，同键同内容200，返回OrderVO |
| GET /api/me/orders | page/size/status/side=BUYER或CREATOR，默认BUYER |
| GET /api/orders/{id} | 仅订单双方 |
| PUT /api/orders/{id}/cancellation | 无正文，买家取消；重复不再次通知 |

QuoteVO：id、requestId、requestTitle、creatorId、creatorNickname、goodsAmount、durationDays、proposal、additionalAgreement、imageIds、status、invalidReason、createdAt、expiresAt、estimatedShipDate、averageRating(null或一位小数字符串)、reviewCount、completedOrderCount、owned、canWithdraw、canAward。

CustomRequestVO增加canQuote、quoteDisabledReason，由服务端独立判断报价资格，不复用咨询资格。ConversationVO增加orderTitle、orderStatus，标题来自订单快照，未付款到期按服务器时间返回CANCELLED而不在GET写库。

QuoteComparisonVO：requestId、requestTitle、expectedShipDate、items(QuoteVO[])、activeCount、limit、canAward、awardDisabledReason、serverDate。预计发货日=北京当前日期+工期；确认日期必须与服务端当前测算一致，晚于期望时页面明确二次确认。最终发货日由未来支付确定。

OrderVO：id、orderNo、orderType、buyerId、buyerNickname、creatorId、creatorNickname、requestId、quoteId、status、title、totalAmount、durationDays、agreementSnapshot、addressSnapshot(买家完整/创作者null)、createdAt、payDeadlineAt、cancelledAt、cancelReason、owned、canCancel、conversationId、history。history项为action、fromStatus、toStatus、reason、createdAt。agreementSnapshot含需求内容/品类路径、方案/补充约定/imageIds、expectedShipDate、confirmedEstimatedShipDate；地址快照字段沿用AddressVO，去掉个人地址的默认标记/时间。

本阶段订单列表、详情与取消仅开放CUSTOM订单，其他类型不在列表中且详情/取消返回404。订单列表addressSnapshot为null，买家详情才返回完整地址。agreementSnapshot.request为title、description、purpose、materialPreference、specification、categoryPath、referenceImageIds、sourceWorkId；顶层为proposal、additionalAgreement、imageIds、expectedShipDate、confirmedEstimatedShipDate、durationDays、goodsAmount。cancelReason为TIMEOUT或BUYER_CANCELLED，页面转换为中文原因。

业务字段错误400、资格403、不可见资源404、状态/幂等冲突409；当日额度用429。不接受客户端定价。报价和定标重试先核对原结果，不因后续状态变化重复执行。

前端入口：需求详情报价区域；/creator/quotes；/requests/:id/quotes；/orders和/orders/:id。通知businessReference增加QUOTE和ORDER，QUOTE含id及requestId；会话增加订单标题/状态，订单取消后不归档中标会话。

## 实施步骤

- [x] 建立关键失败测试、V5迁移与历史数据兼容。
- [x] 报价、图片权限、额度/到期、需求状态和通知闭环。
- [x] 对比与统一口碑、原子定标、快照和会话关联。
- [x] 待付款订单列表/详情、取消/超时及页面接入。
- [x] MySQL/HTTP/WebSocket/OSS/浏览器验证、独立审查及文档同步。

## 验证结果

- 总体结果：后端verify 188项、0失败/错误、4项云端开关跳过；报价图片真实OSS另行1项通过。全量浏览器44/44，前端类型/lint/构建通过，独立审查整改完成。
- 失败原因、复测结果、命令及边界见 [测试记录](../../testing/T-009-quote-award.md)；后端测试只在本地保留。

## 审查与遗留问题

独立审查已修正刷新丢失未知提交上下文、历史入口受当前认证限制、取消后旧GET覆盖状态、订单参考图资格变化、关闭时到期原因及现货接口边界。针对性静态复审无新增P1/P2；最终回归结果见测试记录。

QQ/163公网收件及找回密码补充验收已由用户于 2026-11-23 手动验证通过；本任务不宣称支付及完整交易已实现。

## 交接

从本任务、V1.5的4.5支付规则、数据库设计及前后端README继续；下一步可将已生成的CUSTOM/PENDING_PAY订单接入模拟支付、交易流水及需求IN_TRADE流转，仍须独立任务验收。现货建单与库存锁定尚未实现。保留已有AGENTS.md/application.yml及T-010改动，未迁移开发库、未创建提交；V5已在隔离库验证，由实际应用启动追加尚未执行迁移。
