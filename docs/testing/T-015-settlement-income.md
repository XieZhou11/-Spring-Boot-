# T-015 模拟结算与创作者收入记录 测试记录

- 日期：2026-11-20
- 结果：通过（复测更新于本文件）

## 结算核心集成测试（真实 MySQL，本地保留）

`SettlementIntegrationTest` 12/12 通过，0 失败/错误：

- 满 7 天扫描结算生成唯一 SETTLEMENT 流水、回写 `settled_at`/`settlement_flow_id`、通知仅创作者；未满 7 天保持待结算。
- 窗口内售后申请阻塞结算，撤回后下次扫描结算；退款批准后结算保持已取消且不产生结算流水。
- 重复扫描与并发双扫描（双线程 race）均只产生一条流水；结算扫描与退款批准竞争下恰好一个生效。
- 七天整点边界与 T-014 申请截止互斥自洽；金额篡改拒绝结算且无副作用；系统操作日志仅一条。
- 收入查询：创作者仅本人记录、状态筛选、脱敏账户不含明文；管理员可见姓名与账号明文；非管理员 403。

回归：`OrderPaymentIntegrationTest` 18/18、`OrderRefundIntegrationTest` 16/16、`AdminRefundIntegrationTest` 10/10。

审查修复复测：结算前校验收款快照三键（损坏快照拒绝结算）、系统日志改走 `OperationLogService.record`、脱敏口径统一至 `PayeeSnapshotService` 后，上述测试重跑全部通过。

## 完整构建与回归

- 后端 `./mvnw.cmd verify`：BUILD SUCCESS，323 项测试 0 失败/错误，14 项真实 OSS 条件跳过。
- 初次 verify 曾出现 144 项连接错误，根因为本轮多个后台 Maven 进程并发叠加且 MySQL 容器 `max_connections` 为默认 151，测试上下文缓存累积超出；已执行 `SET GLOBAL max_connections=400`（容器 18 小时前重建后恢复默认）后干净重跑通过，属环境问题非代码缺陷。
- 前端 `npm run type-check`、`npm run lint`、`npm run build` 全部通过。

## 浏览器专项与全量回归

- 专项 `settlement-income.spec.ts`（1/1）：支付后待结算行即时出现在收入页与后台资金记录；状态筛选、脱敏账户、管理员明文快照、非管理员访问 `/admin/settlements` 被守卫送回首页；扫描同款结算落地后收入页与订单详情展示已结算及结算时间。
- 全量回归 87/87：86 项通过 + `order-fulfillment.spec.ts` 原用例「售后窗口后不执行结算」按需求 4.5.5 更新为「窗口后结算自动生效」（轮询结算 120 秒内 SETTLED），单独重跑 5/5 通过，属预期行为变更非回归。
- 最终复验：审查修复后重新打包 JAR，专项以最新 JAR 重跑通过。

## 未执行项

- 真实 OSS 结算场景不涉及（结算不处理文件）；`WorkPublicationCloudTest` 等 14 项真实云端条件跳过与既往口径一致。
- 开发库无 V8（本任务无新增迁移），无需迁移核对。
