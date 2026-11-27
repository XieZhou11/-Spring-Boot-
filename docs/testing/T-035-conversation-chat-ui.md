# T-035 交易会话界面复测

- 关联任务 [T-035 交易会话界面闲鱼式改造](../development/tasks/T-035-conversation-chat-ui.md)
- 环境为 Edge、Node 24.8.0 和 Java 21。真实业务用例使用仓库外的测试副本和独立 Docker MySQL 8.4，邮件与图片走本地夹具。

| 日期 | 测试项与命令或操作 | 结果 | 简要说明 |
| --- | --- | --- | --- |
| 2026-11-27 | 修复前在 Edge 复现会话页问题 | 失败 | 洛杉矶时区跨上海午夜时缺少日期分隔。三条本人消息触发三次个人资料请求。选满三张附件时移除与预览重试按钮不可见。 |
| 2026-11-27 | `npm run test:e2e -- e2e/conversation-chat-ui.spec.ts` | 通过 | 6 项。覆盖上海日期与分钟分组、头像请求复用与续签、无交易上下文、待付款双方入口、附件键盘选择与上传后的重试和移除。 |
| 2026-11-27 | `playwright test` 定向运行 `custom-requests`、`order-fulfillment`、`order-refund-flow`、`quote-award` 和 `settlement-income` | 通过 | 6 项。覆盖公开咨询图文与重试、定向定标的双方卡片、履约进度引用与草稿、售后只读查证、延迟旧响应下的订单取消和关闭通知回跳。首次因隔离库凭据不匹配启动失败，重试时发现增量包仍包含旧会话 VO，清理构建后完整复测通过。 |
| 2026-11-27 | `npm run lint`、`npm run build`、`mvnw.cmd clean -DskipTests package`、`git diff --check` | 通过 | 源码、测试和工程配置的 ESLint 通过，临时源码副本全目录 lint 通过。原工作区全目录 lint 扫描到已有 Vite 测试缓存，项目文件定向检查通过。构建包含前端类型检查，后端在临时副本重新编译并打包。 |
| 2026-11-27 | 全量 E2E、后端独立测试套件及公网 OSS | 未执行 | 本轮按会话界面与相关交易路径开展定向复测。 |
