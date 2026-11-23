# T-020 内容治理举报扩展与处置通知 测试记录

- 日期：2026-11-23
- 任务：[T-020](../development/tasks/T-020-content-report-governance.md)
- 环境：真实 MySQL 8.0.46（开发库隔离数据组）、Spring Boot 后端、Vite 前端、Playwright Chromium

## 后端真实 MySQL 集成测试（ContentReportIntegrationTest，6 项全部通过）

| 用例 | 覆盖 |
| --- | --- |
| workReportEligibilityMergingAndImageRules | 本人/管理员不能举报作品；下架作品不能举报；说明与图片至少一项；他人图片被拒；处理中重复提交合并补证不产生新记录 |
| commentReportAndHideRestoreKeepsPublicListConsistent | 评论作者不能举报本人；评论举报拒绝作品/主页处置结论；隐藏后公开列表与计数排除；恢复后重新可见；未处置的举报不能通过更正恢复 |
| profileReportPauseResumeAndNotifications | 主页举报暂停新业务并恢复；暂停/恢复通知发给被处置用户；REPORT_PROCESSED 仅通知举报人，不与账号通知重复；不成立结论通知被举报创作者 |
| workOfflineRestoreKeepsAuthorNotified | 作品举报下架/恢复，作者收到 WORK_OFFLINED 持久化通知 |
| listsEnrichSummariesAndRejectReviewTypeViaGenericFlow | 我的举报全类型列表含目标摘要；管理员队列按类型筛选；REVIEW 类型举报在通用详情/处置端点被拒绝（评价举报隔离） |
| evidenceObjectionAndDetailAuthorization | 举报人处理中补证；被处理人已处理后异议；旁观者无权查看；处置留痕走 CONTENT_REPORT 操作日志 |

受影响回归（同库真实 MySQL）：OrderReviewIntegrationTest、AdminManagementIntegrationTest、InteractionCoreTest 共 24 项全部通过；后端测试编译通过。

## 前端检查

- `npx vue-tsc --noEmit` + `vite build` 通过（本次新增文件 0 警告；仓库存在此前任务遗留的 229 条 lint 警告，未在本次范围内处理，`npm run lint` 因 max-warnings 0 报失败）。
- E2E 规范 `e2e/content-report.spec.ts` eslint 无输出错误。

## 浏览器 E2E（e2e/content-report.spec.ts，1 项通过）

真实 JAR + 前端开发服务器验证：注册访客依次提交作品举报、评论举报、主页举报 → 我的举报列表展示三类举报并可进入详情 → 管理员在内容举报队列隐藏违规评论（公开评论区计数归零、待处理队列移除、已处理筛选可见结论）→ 管理员暂停被举报主页新业务 → 创作者收到持久化系统通知 → 访客主页显示暂停接单提示。

## 2026-11-23 独立验收

- 后端复核：`./mvnw.cmd -B -ntp "-Dtest=OrderReviewIntegrationTest,AdminManagementIntegrationTest,ContentReportIntegrationTest" test` 共 14 项通过；`InteractionCoreTest` 16 项通过；0 失败/错误。
- 浏览器：`npm run test:e2e -- e2e/content-report.spec.ts`（独立端口 15173/19081）1 项通过，覆盖作品/评论/主页三类举报、我的举报、后台隐藏评论、暂停新业务与通知。
- 构建修复：本任务 `content-report.spec.ts` 使用 `databaseGroup: 'content-reports'`，但 `fixtures.ts` 类型联合原仅含 `shared`/`interactions`，导致 `npm run build` 报 TS2322。已将 `content-reports` 加入类型联合，`npm run build` 复验通过。

## 未执行项

- 全量后端 verify 与全量浏览器 E2E（88 项）未运行：本轮按 T-017—T-020 范围执行专项与受影响用例，非本次验收门槛。
- 前端 lint 因仓库既有 229 条警告失败，与本次改动无关，未扩大处理范围。
