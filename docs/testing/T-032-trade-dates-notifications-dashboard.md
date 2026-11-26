# T-032 订单日期、交易通知与资金看板

2026-11-26 使用隔离 MySQL 8.0 验证业务事务，使用真实后端、Edge、本地 SMTP 和 OSS 协议接收器完成浏览器联调。 [任务](../development/tasks/T-032-trade-dates-notifications-dashboard.md)

## 验收结果

- 后端定向回归 174 项全部通过，零失败、错误或跳过。付款用例核对两类订单的固定日期、未付空值、双方详情和付款重试。通知用例覆盖定向订单主动取消、超时、普通退款和无责退款，两类订单结算与取消待结算、金额权限、通知写入失败回滚及重复扫描。看板双连接用例在待结算查询后提交结算，原响应保持 `100.00 / 0.00`，下一请求读取 `0.00 / 100.00`。固定业务时钟覆盖北京时间零时与支付截止边界。
- 浏览器首轮 7 项通过，2 项失败。修正详情定位后，2 项专项复测通过，合计 9 项。覆盖现货发货截止到秒、定制约定发货日、定向取消双方通知和原会话、现货退款的取消待结算通知、两种结算结果的双方在线 WebSocket 消息及资金看板变化。
- 通过前端类型检查、lint、生产构建与 `git diff --check`。看板聚合断言改为比较交易前后的变化，并核对两个响应的业务时点。独立审查检查了日期、事务与消息权限，补齐了实时推送覆盖。

## 执行命令

在后端工程目录执行。

```powershell
.\mvnw.cmd -B -ntp '-Dtest=AdminManagementIntegrationTest' verify
.\mvnw.cmd -B -ntp '-Dtest=StockOrderHttpFlowTest,OrderPaymentIntegrationTest,OrderPaymentHttpFlowTest,QuoteAwardIntegrationTest,QuoteAwardHttpFlowTest,CustomRequestIntegrationTest,AdminRefundIntegrationTest,OrderRefundIntegrationTest,OrderFulfillmentIntegrationTest,RefundConcurrencyIntegrationTest,AdminManagementIntegrationTest,NotificationWebSocketIntegrationTest' test
```

在前端工程目录执行。

```powershell
npm run test:e2e -- --output test-results-stage-5 e2e/settlement-income.spec.ts e2e/stock-refund-recovery.spec.ts e2e/quote-award.spec.ts e2e/admin-management.spec.ts
npm run test:e2e -- --output test-results-stage-5-retry e2e/settlement-income.spec.ts e2e/stock-refund-recovery.spec.ts --grep '创作者与管理员按角色|已发货现货全额退款'
npm run type-check
npm run lint -- --ignore-pattern 'test-results*/**'
npm run build
```

## 失败与复测

- 修复前现货日期定向 1 项失败，实际发货日早一天并返回了开工截止，修复后与定制日期用例共 2 项通过。
- 修复前通知定向 7 项失败，定向订单关闭缺双方通知，结算和取消待结算缺买家通知。修复后 7 项通过。
- 看板夹具先补齐退款流水关联申请，再确认 2 项预期失败。结算在两次读取之间提交时会重复计入 `100.00`，默认日期由系统日期取得。修复后定向回归曾有 1 项因全站计数依赖其它用例失败。改为核对该订单越过截止时的状态增减，最终 174 项全部通过。
- 两个浏览器用例首轮同时匹配列表和详情的日期，限定到详情订单信息后定向复测通过。

本轮按改动范围验证。真实公网邮件及云端 OSS 的历史验证见对应业务记录。
