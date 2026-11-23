# T-004 创作者入驻认证与管理员审核

- 状态：已完成
- 更新日期：2026-11-16
- 需求依据：[V1.5 需求](../../requirements/requirements.md)4.1.3、4.1.4、4.8、4.9.1、4.9.2，UC-03、UC-04、UC-05 身份切换部分、UC-31 认证资料只读部分。
- 关联设计：[数据库表结构](../../design/数据库表结构.md)4.1、4.4—4.7、4.24、4.27、6.4。

## 目标与范围

前后端一起交付两级品类管理、私有入驻图片、创作者申请/撤回/补正重提、管理员审核、当前会话身份切换及审核系统通知。管理员由用户自行设置，联调使用隔离账号；补充证明采用文字说明。入驻作品不自动公开。作品发布、订单、聊天及暂停业务管理不属于本任务。

## 验收条件

- 3—5 件原创作品，每件至少一张成品图和过程图；1—3 个启用一级主品类；姓名、介绍、年限及收款人一致性按需求校验。
- 本人维护申请，管理员审核；待审核不可修改，可撤回；重提新增记录，历次材料和结论保留；通过后姓名与收款资料只读。
- 图片实际 JPEG/PNG/WebP、单张最多 5MiB，真实私有 OSS、短时签名、归属鉴权和失败补偿；历史引用不误删。
- 提交幂等、审核/撤回并发只有一个结论；认证、账号、通知和操作记录同事务完成。
- 收款账号 AES-256-GCM 加密，密钥仅本地显式配置；敏感资料不进入日志、浏览器持久存储或版本库。
- 旧会话及时刷新资格；身份切换只作用于当前会话且不延期；通知持久化、去重、离线可查，WebSocket 按登录凭证鉴权。
- 真实 MySQL、HTTP、浏览器回归、前后端检查和独立审查完成后再据实标记结果。

## 设计与改动位置

复用 V1 的账号、申请、品类、文件、通知与操作日志表；V2 仅增加申请提交请求键和用户范围唯一约束。品类锁→账号锁→申请/文件锁；多账号按编号排序。OSS 调用在短事务之外。申请重提不覆盖旧材料，私有材料只能由本人或必要管理员读取。

所有 JSON 使用 Result，编号为字符串。分页结构为 items、total、page、size，默认 page=1、size=20，最大 50。时间带北京时间偏移。

| 方法及路径 | 行为 |
| --- | --- |
| GET /api/categories | 有效品类树，CategoryVO[]：id、parentId、name、enabled、sortOrder、children |
| GET/POST /api/admin/categories | 全部品类树/新增；CategoryDTO：parentId(新增)、name、enabled、sortOrder |
| PUT /api/admin/categories/{id} | 编辑名称、顺序、启停；不允许改变 parentId |
| POST /api/creator-application-images | multipart file，返回 ImageVO：id、url、expiresAt；201 |
| GET /api/creator-application-images/{id} | 鉴权签名 ImageVO |
| GET /api/me/creator-certification | certificationStatus、currentApplicationId、approvedApplicationId |
| GET/POST /api/me/creator-applications | 本人分页历史/提交；首次201、相同请求重试200 |
| GET /api/me/creator-applications/{id} | 本人完整材料 |
| PUT /api/me/creator-applications/{id}/withdrawal | 撤回，重复相同撤回200 |
| GET /api/admin/creator-applications | status 可选，默认 PENDING，分页按提交时间、编号升序 |
| GET /api/admin/creator-applications/{id} | 完整材料及 previousApplicationId，前端按历史详情比较变化 |
| PUT /api/admin/creator-applications/{id}/review | ReviewDTO：decision=APPROVED/REJECTED、reason；相同结论重试200，冲突409 |
| PUT /api/sessions/current/active-role | ActiveRoleDTO：activeRole=BUYER/CREATOR，返回现有 SessionVO |
| GET /api/me/notifications | 本人通知分页，NotificationVO：id、eventType、title、content、businessReference、readAt、createdAt |
| GET /api/me/notifications/unread-count | {count} |
| PUT /api/me/notifications/{id}/read | 返回已读 NotificationVO |
| GET /api/ws | 原生 WebSocket，共享登录 Cookie/Origin 白名单；SYSTEM_NOTIFICATION、UNREAD_UPDATED 事件 |

CreatorApplicationDTO：requestKey(UUID)、realName、contactPhone、province、city、district、categoryIds(string[])、experienceYears(number)、introduction、originalWorks([{finishedImageIds:string[],processImageIds:string[]}])、alipayAccount、payeeName、supportingDescription。

ApplicationVO 包含上述材料（不返回 requestKey）、id、userId、nickname、status、submittedAt、reviewerId、reviewReason、reviewedAt、withdrawnAt、previousApplicationId、categories(CategoryVO[])。列表仅返回 id、userId、nickname、status、submittedAt、reviewReason、reviewedAt、withdrawnAt；详情按权限返回完整收款资料。originalWorks 含编号，图片通过签名接口按需读取。

通知 businessReference={type:'CREATOR_APPLICATION',id:string}；WebSocket 事件为 {type:'SYSTEM_NOTIFICATION',notification:NotificationVO} 或 {type:'UNREAD_UPDATED',count:number}。列表、身份和材料页面从服务端重新核验，前端展示不替代权限判断。

## 实施步骤

- [x] 关键权限、材料及重复测试先验证失败，并补充真实事务故障测试。
- [x] 完成品类、申请、图片、加密、审核及状态事务。
- [x] 完成会话资格刷新、身份切换和持久化实时通知。
- [x] 完成前端表单、后台、通知和状态联动。
- [x] MySQL/浏览器/真实 OSS 联调、回归及独立审查。
- [x] 更新结果、数据库说明、工程说明及文档索引。

## 验证结果

- 总体结果：本地完成。后端 96 项测试无失败、错误或跳过，包含真实 MySQL、WebSocket 及云端 OSS；打包检查通过。浏览器全量 24 项通过，最后身份入口修正后 5 项复测通过；前端类型、静态检查及构建通过。
- 测试记录：[T-004 联调记录](../../testing/T-004-creator-onboarding.md)，保留首次失败原因、打包文件占用及复测结果。
- V2 已在本地开发库执行，保留原账号和数据；没有插入演示品类。敏感配置仅本地维护。

## 审查与遗留问题

独立审查发现并修正临时图片清理批次被历史引用占满、筛选项与接口默认值不符、无限重连及连接竞争；复核没有未解决的重要问题。管理员身份标签与申请入口已修正。操作状态定位只在事务提交后记录。已有四个账号 Service 实现移到与声明一致的 `serviceImpl` 目录，解决 IDE 生成无效类的问题。

用户管理员标记已通过只读数据库查询确认，不保存账号密码。QQ/163 公网实收此前属于账号任务待验收事项，已由用户于 2026-11-23 手动验证通过。作品发布、普通聊天与交易不在本任务范围。

## 交接

代码按用户要求在 `codex/creator-onboarding` 分支提交并推送；保留用户 `application.yml` 本地真实配置，收款加密密钥等敏感值不纳入提交。开发使用入口见[前端说明](../../../frontend/README.md)：管理员先在 `/admin/categories` 新增启用一级品类，普通买家在 `/account/creator-certification` 申请，管理员在 `/admin/creator-applications` 审核。

下一功能可从需求 4.2 的作品发布与上架审核开始，复用本任务认证资格、品类、私有图片基础能力和系统通知；具体范围须按后续任务明确。
