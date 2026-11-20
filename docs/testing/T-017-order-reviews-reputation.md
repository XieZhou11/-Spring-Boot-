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
| 2026-11-20 | 私有 OSS 上传及签名图片读取 | 未执行 | 本轮未通过云端 OSS 上传链路；图片引用数量/归属在真实 MySQL 测试中覆盖，签名读取及浏览器展示交由后续 E2E 验收。 |
| 2026-11-20 | 浏览器端 E2E | 未执行 | 按用户要求交由其他 AI 执行。 |
