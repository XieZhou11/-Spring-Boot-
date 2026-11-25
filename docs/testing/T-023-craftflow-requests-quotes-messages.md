# T-023 CraftFlow 第 3 批验证记录

- 日期：2026-11-25
- 环境：Windows、Node 24.22.3、JDK 21。浏览器使用真实后端和隔离 MySQL，邮件及图片测试使用本地 SMTP、OSS 协议接收器。

| 检查 | 结果 | 覆盖 |
| --- | --- | --- |
| Edge 1366 像素专项 | 18/18 | 公开和定向需求、筛选回跳、报价权限、定标重试唯一建单、中标原会话、落选只读、图文、心跳重连及管理员通知。执行 `npm run test:e2e -- --config=test-results-t023-config/msedge.ts --output=test-results-t023-edge-verified e2e/custom-requests.spec.ts e2e/quote-award.spec.ts e2e/request-navigation.spec.ts e2e/chat-reliability.spec.ts e2e/admin-notifications.spec.ts e2e/navigation-layout.spec.ts`。 |
| Edge 订单引用专项 | 2/2 | 定制五节点履约引用保留消息草稿并成功发送，现货订单会话可跳订单且没有空需求链接。对 `order-fulfillment.spec.ts` 与 `work-publication.spec.ts` 使用 `-g '五节点图文制作|创作者草稿、驳回补正'`。 |
| Edge 入驻通知回归 | 1/1 | `creator-onboarding.spec.ts` 中的入驻审核与通知用例。控制两条真实已读请求的返回顺序，验证连续点击与离页期间的迟到响应，随后核对已读和正常业务跳转。 |
| Chrome 1366 像素主流程 | 7/7 | 通过临时 Chrome 配置运行需求草稿、公开咨询、定向建单、多报价归档、心跳重连、五节点引用和现货会话。对照需求、报价对比及消息截图，兼顾既有窄屏用例。 |
| `npm run type-check`、`npm run build`、定向 ESLint、`git diff --check` | 通过 | 22 个改动的 Vue/TypeScript 文件在 `eslint --max-warnings 0` 检查中通过。 |
| `npm run lint` | 退出 1 | 0 错误、210 条既有警告，数量与 [T-022](T-022-craftflow-account-works.md) 交付时相同。 |

首轮验证复现了需求筛选离页丢失、现货会话错误生成需求链接，以及系统通知已读响应晚到后跳转。需求工作区持久化筛选，订单会话按所属业务渲染，通知跳转在响应返回时重新核对当前页面、账号和选择。通知专项首轮响应拦截重复处理，改为按请求顺序放行真实 PUT 后通过。定向用例早期取会话编号时未等待路由更新，已改为等待有效会话路径后验证越权。Edge 集成首轮为 20/23，两个旧定位与新版状态下拉、关联订单链接不匹配，另一个用例名称在运行期间发生更新。更新定位后重跑对应专项，保留原业务断言。

本轮按改动范围选取浏览器回归。全站 E2E、后端全量测试、QQ／163 公网收件和云端 OSS 沿用相关任务的既有记录。
