# T-005 作品发布、审核与作品浏览

- 状态：已完成
- 更新日期：2026-11-16
- 需求依据：[V1.5](../../requirements/requirements.md)3.1、3.3、4.2.1—4.2.3、4.8、4.9.1，UC-06、UC-07、UC-09、附录 A.6。
- 关联设计：[数据库表结构](../../design/数据库表结构.md)作品、文件、操作日志与并发约定。

## 目标与范围

完成认证创作者保存草稿、提交作品，管理员审核并通知，登录用户浏览首页、作品详情及基础创作者主页的前后端闭环。按原型 01、02、07、09、10 的布局和视觉适配现有页面。互动、举报、购买、需求创建、聊天及订单功能不在本任务范围。

用户确认：已上架作品的交易开关、现货价格、定制参考周期均即时更新；展示内容修改重新审核。QQ/163 公网收件及找回密码补充验收暂缓，保留已有实现和回归。

## 验收条件

- 四种交易开关组合、条件字段、启用末级品类、真实图片、草稿与审核状态符合需求。
- 仅合资格创作者提交，管理员审核；本人管理，其他用户只能浏览已上架内容；公开资料不泄露私密材料。
- 自然日首次提交最多 5 件，删除不返额、重提不重复计数；并发不得超额。
- 版本冲突返回 409；重复创建及审核不重复通知；审核、撤回和修改竞争无半状态。
- 内容快照、状态、通知与操作记录同事务保存；提交后推送和记录成功，失败回滚。
- 单独交易设置即时更新，不重置现货锁定/售出状态；正文修改重新审核并停止公开。
- 私有 OSS 上传、签名与续签真实可用，历史引用保留，无引用临时图补偿清理。
- 检索组合、价格排序与分页正确；图片和资料按权限读取。
- 真实 MySQL、HTTP、浏览器闭环、前后端检查、真实 OSS 与独立审查完成后据实交付。

## 设计与改动位置

复用现有 27 表，V3 仅为 work 增加 create_request_key 与 version，旧作品回填独立 UUID、保留原更新时间后设为非空，并添加创作者范围创建键唯一约束；不改写 V1/V2。品类→用户→作品→文件加锁。操作日志扩展内容快照，审核事件按作品及提交版本去重。

### 接口与字段约定

统一 Result；编号字符串；金额十进制字符串；时间包含北京时间偏移；分页 items、total、page、size，默认20、最大50，公开列表固定20。

| 方法及路径 | 行为 |
| --- | --- |
| GET /api/works | keyword、categoryId、creatorId、minPrice、maxPrice、purchasable、customizable、sort、page；sort=LATEST/PRICE_ASC/PRICE_DESC |
| GET /api/works/{id} | 仅已上架作品详情 |
| GET /api/creators/{id} | 基础公开创作者资料 |
| GET/POST /api/me/works | 本人列表（status可为ALL或审核状态）/创建草稿，首次201，同键同内容重试200 |
| GET/PUT/DELETE /api/me/works/{id} | 本人详情/保存草稿/逻辑删除草稿（DELETE携带version查询参数） |
| PUT /api/me/works/{id}/submission | 携带完整作品字段及version提交；在线展示内容变化重新审核 |
| PUT /api/me/works/{id}/withdrawal | version，撤回至草稿 |
| PATCH /api/me/works/{id}/trading-settings | version与四个交易字段，已上架作品即时更新 |
| PUT /api/me/works/{id}/publication | version，作者下架 |
| GET /api/me/work-publication-quota | used、limit、remaining、canPublish、reason |
| GET /api/admin/works | status（默认PENDING，可ALL）、keyword、page、size，待审按提交时间升序 |
| GET /api/admin/works/{id} | 管理员详情 |
| PUT /api/admin/works/{id}/review | version、decision=APPROVED/REJECTED、reason（驳回必填） |
| PUT /api/admin/works/{id}/publication | version、reason（必填），管理员下架 |
| GET /api/me/works/{id}/history、/api/admin/works/{id}/history | 对应权限的分页历史，最新优先 |
| POST /api/work-images、GET /api/work-images/{id} | multipart file上传/鉴权签名，ImageVO=id、url、expiresAt |

作品请求字段：title、categoryId、mainImageIds、specificationImageIds、material、specification、description、processDescription、saleEnabled、customEnabled、stockPrice、customReferenceDays。创建另含 requestKey(UUID)；保存/提交另含 version；交易设置只含 version、saleEnabled、customEnabled、stockPrice、customReferenceDays。请求不开放 sourceOrderId、库存或审核状态写入。

WorkVO：id、creatorId、creatorNickname、creatorAvatarUrl、creatorAvatarExpiresAt、categoryId、categoryPath(string[])、title、mainImageIds、specificationImageIds、material、specification、description、processDescription、saleEnabled、customEnabled、stockPrice、customReferenceDays、reviewStatus、stockStatus、version、firstSubmittedAt、submittedAt、onlineAt、createdAt、updatedAt、reviewReason、purchasable、customizable、coverImage(ImageVO|null)。公开响应不包含私密审核原因。

CreatorPublicVO：id、nickname、bio、avatarUrl、avatarExpiresAt、categories(CategoryVO[])、province、city、paused、averageRating(string|null)、reviewCount、completedOrderCount、publicWorkCount。简介取本人公开bio；地区只返回通过认证的省市，不公开区县、姓名或联系方式。

HistoryVO：id、action、beforeStatus、afterStatus、reason、operatorId、operatorType、createdAt、detail。detail.snapshot 保存提交/审核时作品字段快照；detail.before/detail.after 保存必要修改前后值；detail.submittedVersion 定位审核轮次。历史仅本人及管理员可读。

通知新增 WORK_REVIEWED、WORK_OFFLINED，businessReference={type:'WORK',id:string,version:string}，跳转作品管理页。CategoryVO增加selectableForWork，原字段保持兼容。

## 实施步骤

- [x] 同步需求澄清、暂缓事项及关键失败测试。
- [x] 后端作品、图片、审核、历史、查询与通知完整闭环。
- [x] 原型适配与统一导航、作品管理、审核及浏览页面。
- [x] MySQL、真实 OSS、完整浏览器回归、构建和独立审查。
- [x] 同步测试结果、数据库说明、工程与项目索引。

## 验证结果

- 总体结果：已完成前后端业务链路及验收。最终生产代码 `verify` 119 项通过并打包，新增并发与分页验收测试后的全量 `test` 为 122 项通过；均无失败、错误或跳过，真实 OSS 显式启用。前端类型检查、Lint、生产构建及 29 项完整 Playwright 回归通过。
- 测试记录：[T-005 测试记录](../../testing/T-005-work-publication.md)，含失败原因、修复和复测；后端业务测试仅本地保留，浏览器回归在 `frontend/e2e/`。
- 需求正文与当前版本中文副本逐字节一致；两份正文仍保留“待审核”文档状态。

## 审查与遗留问题

已完成独立审查与增量复审。库存开关绕过、临时图清理、父品类可选标记、下架通知原因、历史创建键回填及会话失效跳转问题均已修复并回归，未发现未解决的重要问题。QQ/163 公网收件及找回密码补充验收由用户明确暂缓，不影响本次范围。

## 交接

继续入口为本任务、[当前需求](../../requirements/requirements.md)、[原型索引](../../prototypes/README.md)及前后端 README。作者从 `/creator/works` 发布，管理员从 `/admin/works` 审核，买家从 `/` 浏览；页面均须登录，管理员先维护启用末级品类。

V3 已在隔离 MySQL 验证，未向用户开发库执行；下次启动新版后端由 Flyway 自动追加。用户已要求提交并推送本任务，提交范围不包含本地 `application.yml` 凭据及后端测试源码；保留本地配置与开发数据，提交及远程分支状态以 Git 记录为准。互动的点赞、收藏、图文评论、关注归入下一业务任务；购买、定制需求、聊天和订单随各自任务接入，本轮只展示真实交易属性。
