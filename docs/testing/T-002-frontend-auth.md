# T-002 登录、注册与找回密码页面测试记录

- 关联任务：[T-002](../development/tasks/T-002-frontend-auth.md)。
- 环境：Windows、Node 24.22.2 / npm 11.19.1、JDK 21.0.11、MySQL 8.0.46、Microsoft Edge Chromium。Playwright 启动真实后端 18080、Vite 5173、随机独立 MySQL 库与本地 SMTP；正常退出清理自身资源，不清理开发库，不改写 `application.yml`。
- 可重复用例：[前端 e2e](../../frontend/e2e/auth.spec.ts)、[服务夹具](../../frontend/e2e/fixtures.ts)。后端 Java 测试按仓库约定保留本地并被 Git 忽略。

| 日期 | 测试项与命令或操作 | 结果 | 简要说明 |
| --- | --- | --- | --- |
| 2026-11-13 | 提交前 `npm run lint`、`npm run build` | 通过 | 使用 Node 24.22.2 / npm 11.19.1，ESLint 零告警；构建中的 Vue/TypeScript 类型检查与 Vite 生产打包通过。输出捕获在系统临时目录 `handcraft-before-push-frontend-lint.log`、`handcraft-before-push-frontend-build.log`。 |
| 2026-11-13 | 提交前 `npm run test:e2e` | 通过 | 最新后端 JAR 下 13/13，通过真实 HTTP、隔离 MySQL 与本地 SMTP 验证完整认证流程、故障提示、旧会话响应隔离及响应式布局；耗时 1.7 分钟，输出捕获在系统临时目录 `handcraft-before-push-e2e.log`，未向公网邮箱发信。 |
| 2026-11-13 | 初始 `npx playwright test` 页面入口用例 | 失败 | 既有前端为空白且没有 `/login` 路由；登录标题和表单不存在，建立有效失败基线。 |
| 2026-11-13 | 首轮 `npm run test:e2e`，10 项 | 失败 | 8 项通过；2 项因“确认新密码”同时匹配密码可见性按钮、后端错误同时出现于字段与表单而发生 strict selector 错误；分别改为精确标签与字段错误断言，未放宽业务断言。 |
| 2026-11-13 | 重发失败、断网核验和延迟响应的新增失败复现 | 失败 | 分别复现重发失败残留成功提示、网络失败使用旧缓存循环回跳、退出后旧 200 恢复会话。延迟用例先等待本人信息清空再释放旧响应，保证覆盖实际乱序。 |
| 2026-11-13 | `npm run test:e2e` 最终完整复测 | 通过 | 13/13，通过真实接口验证 QQ/163 格式邮箱发码注册、错误密码拒绝、登录、刷新、退出、重复注册、重发旧码拒绝、站内回跳及拒绝外部跳转、密码重置和另一设备旧会话失效、SMTP 未知结果、字段错误及断网。三个新增缺陷复现均回归通过。 |
| 2026-11-13 | Playwright 375 / 768 / 1440 宽度截图及布局断言 | 通过 | 三个认证页面均可操作，无水平溢出；检查桌面登录/注册及窄屏注册截图，保持原型的色彩、字体层次、线性图标与手作插画。密码可见性、错误焦点及邮箱/验证码输入标签有浏览器断言。 |
| 2026-11-13 | `npm run type-check`、`npm run lint`、`npm run build` | 通过 | 最终类型检查、0 警告 ESLint、生产构建成功。引入 Playwright 后补齐测试类型检查所需 DOM 类型库；代码格式修正后遵循现有 Vue lint 规则。 |
| 2026-11-13 | 后端 `.\mvnw.cmd -B -ntp verify` | 失败 | 目录/包名调整后的旧 class 残留，`serviceImpl` 与 `service.Impl` 同名 Spring Bean 冲突；定位为增量产物，保留现有源码，改用 clean 重新构建。 |
| 2026-11-13 | 后端 `.\mvnw.cmd -B -ntp clean verify` | 通过 | 显式启用已有 MySQL 迁移测试连接；41 项，失败/错误/跳过均为 0，生成最新可执行 JAR。最终 13 项浏览器复测使用该 JAR。 |
| 2026-11-13 | 独立代码审查与修复复审 | 通过 | 三项 P2 已修复，复审无剩余 P1/P2；旧 200/401 不覆盖新身份和退出另经审查者内存验证，浏览器保存退出乱序回归。 |
| 2026-11-13 | 生产构建预览 `http://localhost:4173` 直连默认后端 `http://localhost:8080` | 通过 | 浏览器验证未登录首页回跳、登录/注册/找回页面及真实无 SMTP 配置请求：HTTP 503、50301 和对应提示，不出现发送成功，保留邮箱输入，无页面异常。默认配置未改写。 |
| 2026-11-13 | QQ/163 公网真实收件 | 未执行 | 后端已补齐本机邮件配置并通过 QQ SMTP 连接认证检查，见 [T-001](T-001-backend-auth.md)。本地 SMTP 或连接认证检查不等于 QQ/163 公网实收，仍需从页面验证注册及找回。 |
| 2026-11-13 | 远端 CI | 未执行 | 仓库没有 CI 配置，本轮仅本机执行。 |

截图、失败 trace 与测试后端日志位于被忽略的 `frontend/test-results/`；本轮后端 clean 日志在系统临时目录 `handcraft-frontend-auth-backend-clean-verify.log`。测试数据均为隔离库中的合成账号，不建立公开测试入口。
