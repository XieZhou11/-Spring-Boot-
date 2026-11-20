# T-014 普通售后与管理员退款裁定

- 状态：已完成
- 更新日期：2026-11-19
- 需求依据：[V1.5](../../requirements/requirements.md)4.5.2—4.5.5、4.8、4.9.3，重点 UC-26、UC-27，关联 UC-25、UC-28—UC-30、UC-36、UC-40；承接已完成的[T-013](T-013-order-fulfillment.md)。
- 关联设计：[数据库表结构](../../design/数据库表结构.md)退款、补证、资金、结算、文件及统一锁序。

## 目标与范围

完成现有定制订单的买家普通申请、双方补证、撤回、管理员只读查证及批准全额退款/驳回恢复履约。后台交付售后队列和关联订单查证；现货、结算执行、收入、全量订单管理及评价独立实施。T-013 未开工系统无责退款保留独立入口，共用退款资金落地。

## 验收条件

1. 买家可从 PAID、IN_PRODUCTION、PENDING_SHIP、SHIPPED 或原完成时间起七天截止前的 COMPLETED 申请；竞争锁后按北京时间毫秒判断，截止时刻拒绝。原因固定为与约定不符、质量问题、发货延误、创作者无法履约、其他；初次说明20—500字、0—3图。新建 NORMAL/WAIT_ADMIN，保存原状态，订单 AFTER_SALE，同单只有一条处理中。
2. WAIT_ADMIN 双方可多次追加不可覆盖的证据，每次文字最多500字、图最多3张，至少一项非空。窗口内已受理的申请跨期后仍可补证、撤回及裁定。暂停新业务的账号保留旧单售后权限。
3. 买家撤回或管理员驳回恢复原状态；仅恢复 SHIPPED 时增加本次实际占用时长，多次只各加一次。恢复 COMPLETED 不改 originalCompletedAt、不重开窗口；不改原发货截止、节点计划及48小时起点。处理中冻结全部履约写入、自动收货及超期通知，原会话继续使用。普通申请跨过48小时不自动转换无责退款。
4. 一名管理员以1—500字原因 APPROVE/REJECT，携带 expectedVersion；新补证先提交则409，要求重新查阅。曾发货批准必须明确需/无需退货：需退货确认原成品已退回，提供8—30位字母数字单号或当前申请已保存初始/补证图片编号；免退填写依据。未发货由服务端保存免退依据。核实人及时间服务端生成，原输入及引用写历史，同裁定原子提交。
5. 公共 OrderRefundExecutionService 使用 MANDATORY。核对成交、原成功实付和待结算金额相等，结算PENDING且无成功退款，沿用 REFUND:ORDER:{orderId}。退款流水、申请和订单REFUNDED、需求CLOSED、结算CANCELLED、历史和持久化通知同提交/回滚，原金额/账户快照/证据保留；回归原无责退款。
6. V7仅追加申请 create_request_key（买家范围唯一）、version DEFAULT 0、补证 request_key（提交者范围唯一），均兼容旧记录可空。新申请/补证键必填，同键核对对象与全部原始输入并返回旧结果（终结后亦可），冲突409；有效新补证版本加一，重试不加。撤回自然幂等；裁定仅同管理员、同版本、全部相同原始参数返回原结论，其他409。
7. 锁序账号升序（管理员写含管理员）→需求→订单→退款→结算→节点→会话→文件。公共执行器不能在文件锁后再取上游锁；锁后统一取时。通知同事务、推送和成功日志提交后执行，日志脱敏，注释/校验遵循AGENTS。
8. 用户仅参与方读取；管理员独立Service及只读VO，聚合约定、必要地址、付款、发货、节点及追加记录、资金摘要、历史、证据。后台聊天只读排他游标，不推进已读、不发送。管理员图片按申请上下文验证实际引用于订单快照、节点、退款历史或关联会话，拒绝无关/临时图。退款上传入口扩展为合法申请买家、处理中双方；补证引用加入绑定/历史读取/清理保留。
9. 申请/撤回/驳回/退款/取消待结算通知持久化去重；补证通知对方，原会话事件使双方其他端重查。结算资料按身份隔离。
10. 前端订单售后面板含原窗口、历史、证据时间线、申请、撤回、补证及原会话入口；管理员 /admin/refunds 和详情子路由采用既有双栏队列/详情布局，筛选分页不丢失，含查证材料、只读聊天、核验及裁定确认（订单、申请、服务端金额）。终态只读，后续补证走原会话。
11. 写前隔离旧GET，按账号/对象保存必要输入及图片编号，存储失败不发写请求。未知结果阻止冲突操作，按原请求键/完整裁定事实精确核验，不能仅凭订单已退款认成功。刷新、通知、焦点/重连保留草稿；版本冲突保留意见，重新查阅再确认，不自动换版本重放。登出/换号/权限失效清理详情、签名及待确认输入。队列手动/焦点/重连刷新，切换隔离乱序。

## 设计与接口约定

| 接口 | 契约 |
| --- | --- |
| POST /api/orders/{orderId}/refund-applications | requestKey、reasonCode、description、imageIds |
| GET /api/orders/{orderId}/refund-applications | 双方历史，page/size默认20最大50，requestKey精确查原结果 |
| GET /api/refund-applications/{id} | 双方申请、版本、处理结果、资格 |
| GET/POST /api/refund-applications/{id}/evidence | GET排他游标最大50、提交者requestKey精确查；POST requestKey、content、imageIds |
| PUT /api/refund-applications/{id}/withdrawal | 买家，无请求体 |
| GET /api/admin/refund-applications | 默认NORMAL/WAIT_ADMIN；status、applicationType、orderNo筛选，时间/编号升序，page/size |
| GET /api/admin/refund-applications/{id} | 管理员只读聚合 |
| GET /api/admin/refund-applications/{id}/evidence | 管理员分页补证 |
| GET /api/admin/refund-applications/{id}/messages | 原订单会话只读分页 |
| GET /api/admin/refund-applications/{id}/images/{fileId} | 售后上下文相关图片短签名 |
| PUT /api/admin/refund-applications/{id}/decision | expectedVersion、decision、reason、returnRequired、returnedConfirmed、returnTrackingNo、returnEvidenceImageIds、noReturnBasis |

申请及补证201新建/200重试，撤回裁定200；参数400、状态版本409、权限沿用403/404。写接口返回最新申请。order detail增加canRequestRefund/refundWindowEndsAt/currentRefund；列表不装证据。禁止客户端提交金额或核实时间。

## 实施步骤

- [x] 建立核心及管理员失败测试，补充已确认需求并逐字节同步副本；追加V7。
- [x] 完成参与方申请/补证/撤回、原状态恢复及公共原子退款，回归T-013。
- [x] 完成独立管理员查证/私图/只读聊天/退回核验与幂等裁定。
- [x] 完成双方售后面板、后台双栏、通知及精确恢复，保存可重复浏览器流程。
- [x] 真实MySQL验证边界/状态/权限/并发/故障原子回滚；真实OSS验证上传/签名/匿名拒绝。
- [x] 后端专项及完整verify，前端type-check/lint/build、专项及全量浏览器回归。
- [x] 独立审查资金锁时间及前端恢复/私图/管理员权限，修复复验，更新索引/README/数据库设计。

## 验证结果

- 总体结果：最终后端verify311项、0失败/错误、7项云端条件跳过（实际304项）；真实OSS另行2/2，全量浏览器86/86，前端type-check/lint/build通过。需求正文与当前中文副本逐字节一致。
- 测试记录：[实际测试结果](../../testing/T-014-refund-adjudication.md)。
- 使用隔离测试数据库；不主动迁移用户开发库，后端测试源码仅本地保留。

## 审查与遗留问题

资金/锁/时间与前端恢复/私图/管理员权限分别独立审查，已修复裁定事实比较、多图恢复、撤权清理、筛选参数、退回分支及终态旧草稿等问题并复验，未留阻断项。真实结算扫描与退款双向并发由后续结算任务补充；不以当前资金约束验证代替未来扫描验收。

## 交接

从本任务、当前V1.5需求4.6、数据库设计及前后端README继续模拟结算与收入记录；结算实现需复用相同锁序并补充与普通售后申请/批准的双向竞争验收。V7已提供且仅在隔离库验证，未主动迁移开发库。工作区改动保留，未创建Git提交；原application.yml本地改动保留。
