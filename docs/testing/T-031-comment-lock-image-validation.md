# T-031 评论锁序与图片输入

2026-11-26 在 MySQL 8.0.46 随机隔离库执行定向验收。浏览器使用实际后端、本地 SMTP 和 OSS 协议接收器。 [任务](../development/tasks/T-031-comment-lock-image-validation.md)

## 执行结果

- 开发库只读检查 `file_asset`，共 39 条记录，编号最长 2 位，`1000000000000000000` 至 `9223372036854775807` 的记录数为 0。评价、举报及补证采用 1–18 位编号上限。
- 后端执行 `.\mvnw.cmd -B -ntp '-Dtest=ContentReportIntegrationTest,InteractionCoreTest,OrderReviewIntegrationTest,OrderFulfillmentIntegrationTest,StockOrderHttpFlowTest' test`，71 项通过，零失败、错误或跳过。通过真实行锁等待验证举报先提交时两项均成功，作者先删除时举报返回 404 且没有新增举报和补证。对评价、内容举报、评价举报及两类补证验证编号字段级 400。对打卡和定制发货验证省略、`null`、0、1、6、7 张图片，核对错误提示、原子性和同请求键重放。现货省略图片字段可发货，节点可追加纯文字。
- `.\mvnw.cmd -B -ntp -DskipTests package` 成功生成浏览器联调用后端 JAR。
- 执行 `npm run test:e2e -- --output test-results-stage-4 e2e/content-report.spec.ts e2e/order-review.spec.ts e2e/order-fulfillment.spec.ts e2e/stock-refund-recovery.spec.ts`，首轮 10 项通过，1 项失败。失败项单独复测通过，合计覆盖 11 项。验证作者自删后举报详情可读、图文评价、带图补证及缩略图和张数、超长编号字段错误、定制缺图提示及补图后继续、现货仅凭运单发货。
- Node 24.8.0 下 `npm run type-check`、`npm run lint -- --ignore-pattern 'test-results*/**'`、`npm run build` 均通过。独立审查复核行锁顺序、字段校验和履约兼容。`git diff --check` 通过。

## 失败与复测

- 修复前定向运行 6 项，5 项按预期失败。作者自删与举报竞争触发死锁，超出 `Long` 的编号触发转换异常，定制空图触发写入失败，HTTP 均返回 500。修复后通过。
- 浏览器起初无法定位上传后的图片张数，补齐共享举报组件的张数显示后通过。联调首轮用说明全文匹配举报列表失败，因为该行还包含举报理由和时间。改为从对应列表项打开详情并核对说明，执行 `npm run test:e2e -- --output test-results-stage-4-retry e2e/content-report.spec.ts --grep '举报入口提交'`，1 项通过。

本次按改动链路执行定向回归，图片验证使用本地 OSS 协议接收器。
