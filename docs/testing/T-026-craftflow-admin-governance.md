# T-026 CraftFlow 第 6 批验证记录

- 日期：2026-11-25
- 环境：Windows、JDK 21、MySQL 8.0。Playwright 使用新打包的后端 JAR、隔离 MySQL、本地 SMTP 与 OSS 协议接收器。Chrome 主流程和 Edge 管理台布局均覆盖 1366 像素视口。

| 检查 | 结果 | 覆盖 |
| --- | --- | --- |
| 后端专项 | 57/57 | 真实 MySQL 下的角色权限、订单异常优先及付款超时读状态、作品草稿及图片签名、举报处置、恢复条件、版本冲突和评价交叠处置。 |
| Edge 专项 | 46/46 | 看板与综合订单、用户处置和旧单开工及会话、四类举报及通知、入驻审核、品类、作品、退款和资金。 |
| Chrome 专项 | 10/10 | 看板及订单查询、两类暂停、审核双栏、原评论全文和图片、评价举报分流及恢复。 |
| 前端检查 | 通过 | 类型检查、ESLint、生产构建及差异检查。需求正文与 V1.5 中文副本逐字节一致。 |

在对应工程运行的主要命令如下。浏览器测试通过 `HANDCRAFT_E2E_FRONTEND_PORT` 和 `HANDCRAFT_E2E_BACKEND_PORT` 使用独立端口。

```powershell
# backend
.\mvnw.cmd -B -ntp '-Dtest=AdminManagementIntegrationTest,ContentReportIntegrationTest,OrderReviewIntegrationTest,WorkPublicationIntegrationTest,WorkPublicationHttpFlowTest,CreatorOnboardingIntegrationTest' package

# frontend
npm run type-check
npm run lint
npm run build
npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-notifications.spec.ts e2e/navigation-layout.spec.ts e2e/creator-onboarding.spec.ts e2e/work-publication.spec.ts e2e/order-refund.spec.ts e2e/order-refund-flow.spec.ts e2e/order-refund-pagination.spec.ts e2e/settlement-income.spec.ts e2e/content-report.spec.ts e2e/order-review.spec.ts
npm run test:e2e -- --config=test-results-t023-config/chrome.ts e2e/admin-management.spec.ts e2e/navigation-layout.spec.ts e2e/content-report.spec.ts e2e/order-review.spec.ts
```

修复前复现了后台列出私稿、超期订单排序和状态不一致，以及评价恢复误覆盖其他举报处置。初次 Edge 回归定位到用户检索和本人恢复接单的等待时序，改用实际结果及按钮状态同步后复测通过。独立审查后补齐举报原始材料、裁定版本、超时核验及恢复范围。

全站回归安排在第 7 批。公网邮件与云端 OSS 沿用原业务任务验收结果。 [开发指南](../design/frontend-rebuild-guide.md)
