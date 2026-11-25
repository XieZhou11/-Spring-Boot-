# T-025 CraftFlow 第 5 批验证记录

- 日期：2026-11-25
- 环境：Windows、JDK 21、Node 24.8.0、npm 11.6.0。Playwright 使用真实后端 JAR、隔离 MySQL 以及本地 SMTP 和 OSS 协议接收器。主流程使用 Edge、Chrome 和 1366 × 900 视口。

| 检查 | 结果 | 覆盖 |
| --- | --- | --- |
| Edge 业务专项 | 26/26 | 普通售后、双向补证、请求键与裁定版本、只读查证及失权清理、金额筛选和回跳、三态结算、两类订单评价、退款后的公开口碑、授权通知和案例审核。 |
| Edge 相邻流程 | 4/4 | 管理员与买家通知、履约和节点会话跳转、普通作品发布及审核。 |
| Chrome 主流程 | 5/5 | 管理员售后查证、两类订单图文评价、授权同意及拒绝、资金记录和定时结算。 |
| 结算数据来源 | 通过 | 夹具只调整隔离库中真实已收货订单的原完成时间，等待服务端扫描并验证唯一结算流水。待结算及取消记录分别来自真实支付和退款。 |
| 前端静态与构建 | 通过 | `npm run type-check`、`npm run build`、变更的 Vue 和 TypeScript 文件 `npx eslint --max-warnings 0`、`git diff --check`。 |
| 全量 ESLint | 退出 1 | `npm run lint` 输出 0 个错误和 102 条既有格式警告，阈值为 0。 |

在前端工程执行下列专项命令。测试选用本地 1366 × 900 配置，端口用 `HANDCRAFT_E2E_FRONTEND_PORT` 与 `HANDCRAFT_E2E_BACKEND_PORT` 隔离。直接重跑业务断言可省略 `--config` 和 `--output` 参数，使用仓库默认 Edge 配置。

```powershell
npm run test:e2e -- --config=test-results-t023-config/msedge.ts --output=test-results-t025-edge-final e2e/order-refund.spec.ts e2e/order-refund-pagination.spec.ts e2e/order-refund-flow.spec.ts e2e/settlement-income.spec.ts e2e/order-review.spec.ts e2e/publication-consent.spec.ts e2e/content-report.spec.ts
npm run test:e2e -- --config=test-results-t023-config/msedge.ts --output=test-results-t025-edge-adjacent e2e/admin-notifications.spec.ts e2e/work-publication.spec.ts e2e/order-fulfillment.spec.ts -g '管理员保留系统通知|买家仍查询聊天未读|创作者草稿、驳回补正|五节点图文制作'
npm run test:e2e -- --config=test-results-t023-config/chrome.ts --output=test-results-t025-chrome-final e2e/publication-consent.spec.ts e2e/order-review.spec.ts e2e/settlement-income.spec.ts e2e/order-refund-flow.spec.ts -g '明确同意|明确拒绝|定制与现货图文评价|创作者与管理员|已付款双方证据边界'
```

专项先复现了焦点刷新使用未提交的筛选值、零金额条件丢失、后台证据失权后残留，以及未获授权的来源链接进入普通发布表单。修复后上述路径通过。授权复测还覆盖了应答丢失后的只读核验、换账号后清理编辑器和从认证入口继续。查看了售后、资金、评价及授权相关浏览器截图。

本轮覆盖受影响的前端业务。真实公网邮件、真实云端 OSS 和后端全量回归沿用相应业务任务记录。现货普通退款及退款后手动恢复直购由独立任务验收。 [已知业务差异](../design/frontend-rebuild-guide.md#4-已知业务差异)
