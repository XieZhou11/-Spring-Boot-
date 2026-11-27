# T-036 历史返回与聊天相册入口测试记录

- **关联任务** [T-036](../development/tasks/T-036-contextual-navigation-chat-icon.md)
- **环境** Edge、Node 24.22.2、Java 21。窗口和浏览器历史使用实际前端，定向用例拦截接口响应以控制加载和列表变化。真实后端用例使用独立 Docker MySQL 8.4、本地 OSS 协议接收器及 SMTP 夹具。

| 日期 | 命令或操作 | 结果 | 覆盖范围 |
| --- | --- | --- | --- |
| 2026-11-27 | 修改前运行新增 Playwright 用例 | 复现 | 作品详情返回时丢失位置和焦点，收藏、关注及需求会话缺少原路径，后台返回后无法前进。相册测试检测到旧按钮文字。 |
| 2026-11-27 | `playwright test e2e/frontend-layout-followup.spec.ts e2e/frontend-list-navigation.spec.ts e2e/order-detail-navigation.spec.ts e2e/frontend-routing-followup.spec.ts` | 40 项通过 | 第一批现有布局、列表、路由和订单回归。 |
| 2026-11-27 | `playwright test e2e/admin-history-return.spec.ts e2e/history-work-navigation.spec.ts e2e/request-chat-history.spec.ts e2e/conversation-chat-ui.spec.ts e2e/order-detail-navigation.spec.ts e2e/frontend-layout-followup.spec.ts e2e/frontend-list-navigation.spec.ts e2e/frontend-routing-followup.spec.ts` | 66 项通过 | 页面内返回、浏览器前进后退、延迟加载、焦点、内部滚动、直链、聊天草稿确认。相册覆盖 1440 和 390 px、鼠标、Enter、Space、三张附件和移除。 |
| 2026-11-27 | `playwright test e2e/history-work-navigation.spec.ts e2e/admin-history-return.spec.ts e2e/request-chat-history.spec.ts` | 18 项通过 | 新增同页记录消失用例复现焦点落到侧栏，修正后焦点落到收藏标题。全部新增导航用例复测通过。 |
| 2026-11-27 | `playwright test e2e/request-navigation.spec.ts e2e/custom-requests.spec.ts --grep '需求详情与报价对比\|公开咨询图文'` | 2 项通过 | 真实注册、需求和报价返回。点击相册选图，发送前验证接收者不可读取，手动发送后对方收到图片。 |
| 2026-11-27 | `eslint src e2e *.ts *.js --max-warnings 0`、`npm run build`、`git diff --check` | 通过 | 项目源码、测试和配置的 ESLint，生产构建及其 TypeScript 检查。 |

全量 E2E 和公网 OSS 不在本次验证范围内。
