# T-007 定制需求、需求大厅、定向邀约与沟通会话

- 状态：已完成
- 更新日期：2026-11-16
- 需求依据：[V1.5](../../requirements/requirements.md)3.1、3.3、4.1.3、4.3、4.8，UC-10—UC-13、UC-34、UC-35、UC-40中本阶段相关规则。
- 关联设计：[数据库表结构](../../design/数据库表结构.md)需求、报价、会话、消息、文件及事务约定。

## 目标与范围

完成买家草稿/发布/关闭/复制、认证创作者公开大厅/定向邀约、需求图文会话和消息中心的前后端闭环。报价提交、定标、支付、制作及售后不在本任务范围。

用户确认大厅仅认证创作者可浏览，买家查看自己的需求。按会话关系鉴权，关注不能获得私聊权限。定向仅一名同品类合资格创作者，发布后正文和范围立即锁定。

实施开始时未发现作品互动的任务或接口，现有文件到T-005。为避让用户明确正在实施的互动功能，本任务使用T-007，不创建或占用T-006。实现与交付前重新核对实际产物，复用实际交付的公共图片、文本及页面能力，不覆盖互动变更、不声称未出现的互动功能已通过回归。

## 验收条件

- 字段、图片、日期、公开/定向资格和隐私符合需求；草稿可不完整，发布最多同时开放5条，并发不得超额。
- 创建、发布、关闭、会话及消息重试幂等，保存版本冲突409；发布后不可改正文、范围、受邀者及来源作品。
- 满7天且无有效报价才过期；GET不写业务，接口按服务器时间立即拒绝过期操作，扫描持久化归档及通知。
- 关闭/过期、报价失效、仅未成单会话归档、通知与记录同事务；已有订单会话保持必要沟通能力。
- 消息先存后推，纯图片可发，序号和已读单调，多端/离线补偿、限流、越权与并发实际验证。
- 私有OSS真实上传/签名/续签，越权引用拒绝，历史引用不被清理；前后端检查、浏览器回归与独立审查完成后据实交付。

## 设计与接口约定

沿用Controller→Service→Mapper平级包、普通DTO与标准字段校验、Service中文脱敏日志及提交后成功日志。复用现有表，追加未占用Flyway版本，需求增加create_request_key、version、deleted_at；会话增加双方发送冷却截止时间。不修改已执行迁移，不改本地application.yml。

统一Result、字符串编号/版本、金额十进制字符串、带北京偏移的时间。常规列表PageVO，默认20最大50；大厅固定20。消息游标默认50最大50，返回items与hasMore，items按seqNo升序。初次读取取最新50条，beforeSeq读更早，afterSeq向后补拉，两者不可同时提供。

### 需求接口

- GET /api/custom-requests：categoryId、minBudget、maxBudget、publishedAfter、publishedBefore、allCategories、page；默认本人认证主品类，allCategories=true可看其他品类；预算区间交集，时间[start,end)，发布时间及id倒序。
- GET /api/custom-requests/{id}：本人，或认证创作者读取已发布公开需求，或原指定受邀者读取定向需求；草稿仅本人。管理员不作为交易主体。
- GET/POST /api/me/custom-requests：本人列表/创建草稿；GET/PUT/DELETE /api/me/custom-requests/{id}：本人详情/保存/删除，保存与删除携带version。
- PUT /api/me/custom-requests/{id}/publication：完整字段+version发布；PUT /api/me/custom-requests/{id}/closure：version关闭。
- POST /api/me/custom-requests/{id}/copies：requestKey复制本人已关闭/过期需求；复制清空范围关联、受邀者、来源作品，只带正文和本人参考图，生成PUBLIC新草稿。
- GET /api/me/custom-request-quota：used、limit、remaining、canPublish、reason；GET /api/me/custom-request-invitations：本人邀约分页及status。
- GET /api/creators：categoryId必填，keyword可选，page/size默认1/20最大50，返回PageVO<CreatorPublicVO>；为定向表单选择同主品类、未暂停、非本人的认证创作者，复用公开资料投影，不开放任意编号输入。
- POST /api/custom-request-images、GET /api/custom-request-images/{id}：file上传/鉴权签名，ImageVO沿用id、url、expiresAt。

请求正文：title、categoryId、purpose、materialPreference、specification、budgetMin、budgetMax、expectedShipDate(YYYY-MM-DD)、referenceImageIds、description、visibility(PUBLIC/DIRECTED)、invitedCreatorId、sourceWorkId；创建另含requestKey，保存/发布含version。来源作品仅参考，不占用现货；发布时核验同作者、ONLINE、customEnabled及接单资格。

CustomRequestVO：以上正文及id、buyerNickname、categoryPath(string[])、invitedCreatorNickname、status、version、publishedAt、noQuoteExpireAt、closedAt、createdAt、updatedAt、owned、canEdit、canPublish、canClose、canCopy、canConsult、consultationReason。不返回邮箱、地址、电话、收款资料。

### 会话接口

- POST /api/custom-requests/{id}/conversations：无任意对方编号，双方从需求与当前身份推导；首次201，已有200。
- GET /api/me/conversations：分页；GET /api/me/conversations/unread-count：count；GET /api/conversations/{id}：本人关联详情。
- GET /api/conversations/{id}/messages：beforeSeq或afterSeq、size；POST同路径：clientMessageKey(UUID)、content(可空)、imageIds。
- PUT /api/conversations/{id}/read-cursor：lastReadSeq，只前进到实际展示且不超过当前最大序号。
- POST /api/conversations/{id}/images、GET /api/conversation-images/{id}：file上传/鉴权签名。临时图仅上传者可预览，实际消息引用后双方可读，归档后保留历史权限。

ConversationVO：id、requestId、orderId、requestTitle、requestStatus、otherUserId、otherNickname、unreadCount、lastMessageAt、lastMessageSeq、readSeq、canSend、sendDisabledReason、archivedAt、archiveReason。ChatMessageVO：id、conversationId、seqNo、senderId、clientMessageKey、content、imageIds、createdAt。seqNo、readSeq和lastMessageSeq也使用字符串。

HTTP写入复用CSRF，WebSocket沿用/api/ws单连接，只新增提交后事件：CHAT_MESSAGE{message}、CHAT_READ{conversationId,userId,readSeq}、CHAT_UNREAD_UPDATED{count}、CONVERSATION_UPDATED{conversationId}，保留SYSTEM_NOTIFICATION与UNREAD_UPDATED。需求通知businessReference.type=CUSTOM_REQUEST；事件REQUEST_INVITED、REQUEST_CLOSED、REQUEST_EXPIRED按需求与事件去重。

消息幂等在限流前核对；同键不同内容409，重试不多发。20条/60秒只统计成功消息，第21条持久冷却60秒并返回429及Retry-After，拒绝不占序号或更新最近时间；冷却中不延长。10秒内重复同文本拒绝。暂停不切断已建会话，关闭/过期未成单则只读；归档历史图继续可查。公开需求的会话创建仅符合品类与资格的非本人创作者，定向仅双方。

## 实施步骤

- [x] 核对互动依赖、基线，建立关键失败测试；当前无互动任务或接口，复用已交付作品图片底层能力和页面，预留实际交付后适配。
- [x] 需求数据、图片、接口、状态与通知闭环；追加V4，不占用互动编号。
- [x] 图文会话、限流、已读、WebSocket及过期归档。
- [x] 前端大厅、我的需求、邀约、表单、详情与消息中心接入。
- [x] MySQL/HTTP/WebSocket/OSS/浏览器回归、独立审查及文档同步。

## 验证结果

- 总体结果：本阶段范围已完成。最终后端verify 148项、0失败/错误、3项云端opt-in默认跳过；本任务真实OSS另行显式验证2项通过。前端type-check、lint、build均通过，固定最终源码及JAR的完整浏览器回归32/32通过。
- 字段/图片/资格/隐私、发布锁定、幂等/版本、五条并发额度、有效报价与七天边界、关闭回滚/发送竞争、只读归档、消息幂等/频次/序号/已读及离线补拉均有真实业务验证；兼容已有订单会话，不宣称报价/订单功能已实现。
- 测试记录：[本任务简短记录](../../testing/T-007-custom-requests.md)；后端测试源码仅本地保留。前后端独立审查问题已修复并复核，包含最后临时会话图读取隐私。

## 审查与遗留问题

交付复查仍无T-006及点赞/收藏/评论/关注和个人列表实现，无法运行对应回归；这些功能实际交付后再按接口与路由适配，不建立替代接口。当前已回归实际存在的账号、个人、入驻、作品及系统通知。报价与订单关联仅验证兼容规则，不宣称本任务实现报价或订单。QQ/163公网收件及找回密码补充验收继续沿用用户明确暂缓的决定。

## 交接

继续入口为本任务、V1.5需求和前后端README。V1—V4在隔离MySQL验证，本轮不向开发库主动执行迁移；下次启动新版后端由Flyway追加尚未执行版本，保留现有application.yml。用户已于2026-11-16授权提交及推送本任务代码，提交记录以Git历史为准，原有本地配置改动不纳入本任务提交。下一业务阶段为报价、对比与定标建单，沿用本任务需求状态、会话及订单关联。
