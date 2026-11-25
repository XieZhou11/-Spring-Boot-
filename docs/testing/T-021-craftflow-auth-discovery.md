# T-021 CraftFlow 第 1 批测试记录

- 关联任务：[T-021 认证、公共布局与作品浏览](../development/tasks/T-021-craftflow-auth-discovery.md)
- 环境：Windows、Node 24.22.3、JDK 21。使用现有后端 JAR、隔离 MySQL 8.0 和本地 SMTP、OSS 协议接收器，浏览器通过真实 HTTP、会话 Cookie 和 CSRF 接入。

| 日期 | 测试项与命令或操作 | 结果 | 简要说明 |
| --- | --- | --- | --- |
| 2026-11-25 | `npm run type-check`、`npm run build` | 通过 | 类型检查和生产构建均退出 0。 |
| 2026-11-25 | `npm run lint` | 失败 | 全量检查有 226 条既有警告，基线为 229 条，0 个错误。 |
| 2026-11-25 | 对改动的 Vue、TypeScript 文件执行 `eslint --max-warnings 0` | 通过 | 25 个文件，退出 0。 |
| 2026-11-25 | Edge 首轮认证、导航、作品、互动和通知回归 | 失败 | 32/33。作者主页已有两处「暂无评价」，旧定位匹配两处。将定位限定在口碑评分字段后，作品与导航定向复测 11/11。 |
| 2026-11-25 | Edge 复现无地址时点击「管理收货地址」 | 失败 | 旧链接指向未注册的 `/addresses`，实际跳回广场。改为 `/account/addresses` 后，已有预打包缓存的定向现货回归 1/1。 |
| 2026-11-25 | Edge 加入内容举报后的回归 | 失败 | 33/34。第一次懒加载地址页时，Vite 重载依赖并刷新原作品页，中断了跳转。为地区选择器依赖增加启动预打包。 |
| 2026-11-25 | Chrome 1366 像素专项 | 通过 | 7/7。临时配置继承现有 Playwright 设置，将通道改为 Chrome，默认视口为 1366×900。覆盖 QQ 测试账号会话、认证视口、买家和管理员导航、真实作品深链、签名图、组合检索、无地址入口及现货履约。 |
| 2026-11-25 | Edge 冷启动复跑 `npm run test:e2e -- --output=test-results-t021-verified e2e/auth.spec.ts e2e/navigation-layout.spec.ts e2e/work-publication.spec.ts e2e/work-interactions.spec.ts e2e/admin-notifications.spec.ts e2e/content-report.spec.ts` | 通过 | 34/34。Vite 日志确认地区选择器依赖在启动时预打包，复测无地址入口、现货主流程、内容举报、作品互动与未读消息。 |

本批复用本地 SMTP 和 OSS 协议验证，未重跑 QQ／163 公网收件、云端 OSS 或全量跨批次 E2E。历史公网验收见 [T-002](T-002-frontend-auth.md)。
