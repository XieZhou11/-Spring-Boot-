# T-017 订单评价与创作者口碑测试记录

- 关联任务：[T-017](../development/tasks/T-017-order-reviews-reputation.md)
- 环境或前提：隔离 MySQL 8.0 测试库，真实 Spring Boot 应用上下文。

| 日期 | 测试项与命令或操作 | 结果 | 简要说明 |
| --- | --- | --- | --- |
| 2026-11-20 | `cd backend; ./mvnw -q -Dtest=OrderReviewIntegrationTest test` | 通过 | 真实 MySQL 验证买家归属、7 天边界、唯一评价、售后/退款拒绝、评价与订单退款状态并发写入后的公开统计排除、图片 0-3 张及越权图片拒绝、图片读取的公开/隐藏权限、关联举报权限、举报补证、隐藏/恢复和口碑统计；6 项通过。 |
| 2026-11-20 | `cd backend; ./mvnw -q -DskipTests compile` | 通过 | 后端主源码编译检查。 |
| 2026-11-20 | `cd frontend; npm run type-check` | 通过 | Vue/TypeScript 类型检查。 |
| 2026-11-20 | `cd frontend; npm run lint` | 通过 | ESLint 零警告。 |
| 2026-11-20 | `cd frontend; npm run build` | 通过 | 生产构建及其内置类型检查通过。 |
| 2026-11-20 | 私有 OSS 上传及签名图片读取 | 未执行 | 本轮未通过云端 OSS 上传链路；图片引用数量/归属在真实 MySQL 测试中覆盖。 |
| 2026-11-23 | 独立验收复跑 `./mvnw.cmd -B -ntp "-Dtest=OrderReviewIntegrationTest" test` | 通过 | 真实 MySQL 6/6，0 失败/错误。 |
| 2026-11-23 | 浏览器 E2E：临时验收脚本（运行后删除，不改动实现） | 通过 | 真实 JAR + Vite + 隔离库 + 本地 OSS/SMTP 接收器：买家提交 5 星图文评价 → 创作者主页口碑评分 5.0、好评率 100.0%、真实评价 1、完成订单 1 → 访客举报评价 → 管理员在评价举报队列隐藏 → 主页评价消失、真实评价归零。 |
| 2026-11-23 | 私有 OSS 云端签名图片读取 | 未执行 | 浏览器 E2E 使用本地 OSS 协议接收器，未访问真实云端；本轮验收范围未要求云端上传。 |
