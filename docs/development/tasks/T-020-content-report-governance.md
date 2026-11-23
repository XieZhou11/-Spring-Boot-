# T-020 内容治理举报扩展与处置通知

- 状态：已完成
- 更新日期：2026-11-23
- 需求依据：[V1.5 MVP 版需求](../../requirements/requirements.md) 4.2.4（评论举报）、4.2.5（内容治理与举报）、4.8.1（举报与账号处置通知）、3.1 角色权限矩阵
- 关联设计：复用 [T-017](T-017-order-reviews-reputation.md) 已建立的评价举报流程与 `report`/`report_evidence`/`work_comment.moderation_status` 数据结构，无新增迁移

## 目标与范围

把举报能力从"仅订单评价"扩展到需求正文的完整范围，并补齐账号处置通知：

1. 举报入口覆盖作品、作品评论、创作者主页（评价举报保留既有流程）；同一用户对同一对象的处理中举报合并为补充证据。
2. 管理员可处理全部类型举报：作品下架/恢复、评论隐藏/恢复、主页被举报创作者统一暂停新业务/恢复，处置说明原因、留痕并通知举报人与被处理人；可依据补证更正。
3. 用户可查看本人全部举报列表及详情，处理中补充证据，已处理且本人为被处理人时提出异议。
4. 管理员统一暂停新业务及人工恢复向被处置用户发送系统通知。

不在范围：评价举报既有接口与流程保持不变；管理员绕过举报直接隐藏评论或下架作品不在本次范围（处置一律经举报流程留痕）；工单/客服能力不属于需求。

## 验收条件

- 已登录非管理员用户可对已上架作品、可见评论、已认证创作者主页提交举报；不能举报自己的作品/评论/主页；管理员提交被拒绝。
- 同一用户对同一对象已有处理中举报时再次提交合并为补充证据，不产生重复记录（数据库唯一键兜底）。
- 举报说明与图片至少一项；图片最多六张且须为本人已上传可用证据；同一举报不可重复提交相同材料被拒。
- 举报人处理中可补充证据；被处理人（作品作者/评论作者/被举报创作者）在已处理后可提出异议；无权用户补充被拒。
- 管理员可按类型与状态筛选举报队列；对作品举报可下架（作品转 OFFLINE 并通知作者）、对评论举报可隐藏（评论不再公开显示、与作者自删独立）、对主页举报可暂停新业务（复用统一暂停校验与日志）；不成立则标记 NOT_UPHELD；所有处置必须填写理由。
- 已处理举报可更正：恢复作品/评论、恢复新业务；未产生处置的举报不能"恢复"。
- 处置及更正后，举报人与被处理人收到系统通知；管理员暂停/恢复新业务时被处置用户收到系统通知。
- 评论隐藏后作品评论区不再展示，但历史引用与证据图片读取不受影响；用户自删与管理员隐藏状态互不覆盖。
- 通用举报详情与处置端点拒绝 REVIEW 类型举报（评价举报仍走既有端点），避免重复处置路径。
- 未登录、无权用户访问他人举报详情被拒绝；报告图片签名按举报人/管理员/被处理人鉴权。

## 设计与改动位置

- 后端新增 `ContentReportService`/`ContentReportServiceImpl`/`ContentReportMapper`/`ContentReportController`，通用处理 WORK/COMMENT/CREATOR_PROFILE；`report` 表 `target_type` 已含四种取值，`work_comment.moderation_status` 已存在，无需迁移。
- 端点：`POST /api/works/{id}/reports`、`POST /api/work-comments/{id}/reports`、`POST /api/creators/{id}/reports`、`GET /api/reports/{id}`、`POST /api/reports/{id}/evidence`、`GET /api/me/reports`（全类型）、`GET /api/admin/reports`（类型+状态筛选）、`PUT /api/admin/reports/{id}/decision`、`GET /api/report-images/{id}`。
- 举报处置留痕写入 `operation_log`（target_type=`CONTENT_REPORT`），作品/评论/账号状态变更在服务层行锁下校验。
- `NotificationService` 新增举报处置通知与账号处置通知；`AdminUserServiceImpl` 暂停/恢复时发送通知。
- 前端：`api/report.ts`、作品详情与评论区举报入口、创作者主页举报入口、我的举报列表页、通用举报详情页、后台举报队列扩展类型筛选、通知跳转补充。

## 实施步骤

- [x] 后端：DTO、VO、Mapper、Service、Controller 实现通用举报提交/详情/补证/异议/列表/队列/处置
- [x] 后端：评论隐藏、作品下架与恢复、创作者暂停复用校验逻辑接入
- [x] 后端：举报处置与账号处置通知；`AdminUserServiceImpl` 发送账号处置通知
- [x] 前端：举报 API 封装、三处举报入口、我的举报列表、举报详情页
- [x] 前端：后台队列扩展类型筛选与通用详情处置；通知跳转
- [x] 后端真实 MySQL 关键业务测试（资格、合并去重、处置状态、通知、鉴权拒绝）
- [x] 浏览器验证主流程与权限拒绝路径
- [x] 更新测试记录、任务状态与文档索引

## 实施摘要

- 新增 `ContentReportService`/`Impl`/`Mapper`/`Controller`：作品、评论、创作者主页举报共用 `report` 表，处置动作按目标类型限定（评论举报不能触发作品下架等）；作品下架复用 `WorkService.offline`（含提交快照与作者通知），暂停/恢复复用 `AdminUserService.setBusinessPause`；RESTORE/RESUME 更正要求本举报已产生处置。
- 处置留痕走 `operation_log`（target_type=`CONTENT_REPORT`）；通知新增 `contentReportDecided`（按举报+结论去重）与 `accountBusinessChanged`（状态实际变化才发送）；管理员统一暂停/恢复在 `AdminUserServiceImpl` 状态变化时发送通知。
- 通用端点拒绝 REVIEW 类型，评价举报继续走 T-017 既有流程；举报证据图片读取按举报人/被处理人/管理员关系鉴权（`/api/report-images/{id}`）。
- 前端新增 `ReportDialog` 通用举报表单，接入作品详情（作品/评论举报）、创作者主页举报、消息中心"我的举报"入口；新增 `/me/reports` 列表、`/reports/:id` 详情（补证/异议）、`/admin/content-reports` 后台队列（状态+类型筛选、按类型处置）；通知跳转补充 REPORT/REVIEW_REPORT→我的举报、USER→个人资料。

## 验证结果

- 总体结果：通过（详见测试记录）
- 测试记录：[T-020 测试记录](../../testing/T-020-content-report-governance.md)
- 后端：`ContentReportIntegrationTest` 6/6 通过；受影响回归（含 `InteractionCoreTest` 16 项）通过（真实 MySQL）
- 前端：`npm run build` 通过；E2E `content-report.spec.ts` 通过（Playwright Chromium）
- 2026-11-23 独立验收：复核后端 14 项与 `InteractionCoreTest` 16 项均通过；E2E `content-report.spec.ts` 1 项通过；将 `databaseGroup: 'content-reports'` 加入 `fixtures.ts` 类型联合，修复此前 `npm run build` 的 TS2322 阻断，`npm run build` 已通过。

## 审查与遗留问题

- 仓库存在此前任务遗留的 229 条前端 lint 警告（T-017—T-019 相关文件），`npm run lint` 因 max-warnings=0 失败；本次新增文件 0 警告，未扩大处理范围。
- 通用处置端点对已处理举报允许再次执行动作（与评价举报更正能力一致），已由集成测试覆盖状态守卫。
- 运行 E2E 产生的 `frontend/test-results-*` 临时目录因 IDE 批量删除保护未能自动清理，已被 .gitignore 排除，可手动删除。

## 交接

MVP 范围内 4.2.4/4.2.5/4.8.1 举报与账号处置通知已补齐，T-017—T-020 测试与浏览器验收均已完成。后续入口：[docs/README.md](../../README.md) 索引；QQ/163 公网收件补充验收暂缓事项不变。
