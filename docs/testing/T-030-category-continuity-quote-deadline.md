# T-030 存量品类与定标截止

验证使用随机隔离 MySQL。浏览器使用实际后端及本地 SMTP 和 OSS 协议接收器。 [任务](../development/tasks/T-030-category-continuity-quote-deadline.md)

## 执行结果

- 后端运行 `.\mvnw.cmd -B -ntp '-Dtest=CustomRequestIntegrationTest,CustomRequestHttpFlowTest,WorkPublicationIntegrationTest,WorkPublicationHttpFlowTest,StockOrderHttpFlowTest,QuoteAwardIntegrationTest,QuoteAwardHttpFlowTest,OrderPaymentIntegrationTest,OrderRefundIntegrationTest,RefundConcurrencyIntegrationTest' test`，153 项通过，零失败、错误或跳过。覆盖新增子类后的旧需求咨询、报价、定标，旧作品筛选、下单和恢复直购，来源作品及定向资格，品类停用，定标截止前 1 毫秒与恰好到期，地址行锁等待跨截止、条件更新回滚、并发定标和请求键重放。
- `.\mvnw.cmd -B -ntp -DskipTests package` 生成浏览器联调所用 JAR。业务验证计数来自上述后端专项。
- 前端以 Node 24.22.3 运行 `npm run type-check`、`npm run lint -- --ignore-pattern test-results*/**` 和 `npm run build`，全部通过。lint 排除了本地 Playwright 产物。
- 执行 `npm run test:e2e -- --output test-results-stage-3-final e2e/custom-requests.spec.ts e2e/quote-award.spec.ts e2e/work-publication.spec.ts e2e/stock-refund-recovery.spec.ts`，18 项通过。验证了旧需求定标、旧作品直购及退款恢复，来源草稿收到发布拒绝后保留输入并切换末级，报价到期返回 409 后可选择第二份有效报价。
- 独立审查核对了新发布与存量交易的校验、筛选和详情一致性、锁序、定标截止及事务原子性。复核发现的需求分类竞争和编辑期间品类更新已处理并复测。 `git diff --check` 通过。

## 失败与复测

- 修复前旧一级咨询、直购和恢复资格受阻，来源作品可提交不匹配的末级，公开详情会在无可选末级时宣称可定制。五个针对用例均复现，修复后通过。
- 修复前地址锁等待跨截止和条件更新应失败的用例均错误成单。修复后返回 409，保存的订单、会话和通知均通过原子性检查。
- 后端首轮回归的旧价格分页夹具缺少认证主品类关联，补齐测试数据后通过。浏览器首轮的下拉占位项断言错误地期待空字符串，改为检查实际选中状态。另复现并修复了表单已打开时品类变更后选项未刷新，最终浏览器回归全部通过。

本次为定向验收。全量业务套件和真实云端 OSS 未执行。
