# T-028 现货普通售后与恢复直购

验证日期为 2026-11-25。后端使用随机隔离 MySQL，浏览器使用真实后端和本地 OSS 协议接收器。 [任务](../development/tasks/T-028-stock-refund-recovery.md)

## 执行结果

- 后端执行 `.\mvnw.cmd -B -ntp "-Dtest=StockOrderHttpFlowTest,OrderRefundIntegrationTest,AdminRefundIntegrationTest,AdminRefundImageIntegrationTest,RefundConcurrencyIntegrationTest,OrderFulfillmentIntegrationTest,OrderImageAndNodeChatIntegrationTest" verify`，90 项通过，零失败、错误或跳过。覆盖现货三种起始状态、七天边界、申请与裁定重试、退回核验、退款与结算互斥、会话及图片授权、已读游标、撤回及驳回、库存恢复竞争和定制回归。
- 前端使用 Node 24.22.3 执行 `npm run lint -- --ignore-pattern 'test-results*/**'` 和 `npm run build`，均通过。构建包含应用和浏览器测试的 TypeScript 检查。
- 前端执行 `npm run test:e2e -- e2e/stock-refund-recovery.spec.ts e2e/order-refund-flow.spec.ts`，5 项通过。两类售后均走真实页面。现货主流程核对模拟退款额等于原实付，待结算已取消，恢复直购前仍已售出，恢复后第二位买家按新售价建单。
- 合并验证执行 `git ls-files -u`、`git diff --check`、`git diff HEAD --exit-code -- frontend/src/views/MyReportsView.vue`，均符合预期。前端执行 `npm run test:e2e -- e2e/content-report.spec.ts -g '我的举报'`，2 项通过。
- 独立交叉审查覆盖资金事务、锁序、会话及图片授权、恢复资格和库存并发。发现恢复直购窗口遇到品类资格变化时没有回读，已改为重新获取库存和资格，最终前端验证通过。

## 失败与复测

- 修复前，已付款待发货现货申请普通售后返回 `404`。修复后首次申请为 `201`，相同请求重放为 `200`。
- 七天边界的初始夹具推进时钟后会话到期。回设隔离库订单原完成时间并固定最后一毫秒后通过。会话图片夹具把现货工期初始化为 0 时触发数据库约束，按真实现货建单的空值修正后通过。
- 原始 lint 命令扫描到历史 Playwright 目录里的生成缓存。排除生成目录后执行成功并保留了原本地文件。

本次覆盖定向回归。真实云端 OSS 和全量套件未执行。
