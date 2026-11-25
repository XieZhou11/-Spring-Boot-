# T-029 现货快照图片与后台查证

验证日期为 2026-11-25。后端使用隔离 MySQL，浏览器使用真实后端、本地 OSS 协议接收器和本地 SMTP 接收器。 [任务](../development/tasks/T-029-stock-snapshot-evidence.md)

## 执行结果

- 后端运行 `.\mvnw.cmd -B -ntp '-Dtest=StockOrderHttpFlowTest,WorkPublicationIntegrationTest,AdminRefundImageIntegrationTest,AdminManagementIntegrationTest,AdminRefundIntegrationTest,OrderReviewIntegrationTest,OrderRefundIntegrationTest,RefundConcurrencyIntegrationTest' verify`。105 项通过，零失败、错误或跳过。覆盖快照两组图片、越权和错单拒绝、仅由订单引用的图片保留、孤儿图回收、售后直链歧义、后台详情兼容、51 条会话分页、图片实际引用和双方游标。
- 前端运行 `npm run type-check`、`npm run lint -- --ignore-pattern 'test-results*/**'` 和 `npm run build`，均通过。lint 排除了本地历史 Playwright 产物。
- 运行 `npm run test:e2e -- --output test-results-stage-2 e2e/work-publication.spec.ts e2e/stock-refund-recovery.spec.ts e2e/admin-management.spec.ts e2e/order-refund-flow.spec.ts e2e/order-refund-pagination.spec.ts e2e/order-review.spec.ts`，20 项通过。买卖双方在换图及下架后仍能加载原成交图。后台订单显示摘要并直达现货售后。售后和评价举报分别翻到第二页并加载附件，双方已读游标保持原值。第一阶段全额退款与恢复直购回归通过。
- 调整本地 SMTP 夹具后运行 `npm run test:e2e -- --output test-results-stage-2-auth e2e/auth.spec.ts -g '实际发码|邮箱找回|SMTP 发送结果|重发失败'`，5 项通过，覆盖两个邮箱域的本地发码注册、找回密码和 SMTP 故障反馈。
- 独立交叉审查覆盖后端签名授权、回收、只读查证，以及前端分页、签名续签和切换上下文后的状态清理。

## 失败与复测

- 新增后端用例在修复前复现了快照签名缺失、历史图片被列为回收候选、综合订单返回正文和评价举报查证接口缺失。上述定向验证已通过。
- 浏览器首轮 18 项通过，两个评价用例在注册前置步骤超时。线程栈显示 Jakarta Mail 在生成邮件编号时解析本机名，每次本地发送等待约 14 秒。为测试 JVM 指定本地 `mail.from` 和 `mail.smtp.localhost` 后，业务套件 20 项和认证复测 5 项均通过。

本轮为定向验收。真实云端 OSS 和全量套件未执行。
