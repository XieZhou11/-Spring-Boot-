# T-024 CraftFlow 第 4 批验证记录

- 日期：2026-11-25
- 环境：Windows、JDK 21、Node 24.22.3。Playwright 使用实际后端 JAR 和隔离 MySQL 8.0，邮件和图片使用本地 SMTP 与 OSS 协议接收器。Chrome、Edge 使用 1366 × 900 视口。

| 检查 | 结果 | 覆盖 |
| --- | --- | --- |
| Edge 集成 | 首轮 40/42，专项复测 6/6，涵盖首轮失败的两项 | 作品与现货订单、定标、付款、履约、普通售后和结算。 |
| Chrome 主流程 | 6/6 | 现货直购与 48 小时发货期限、现货取消释放及订单翻页回链、定制付款与待开工、五节点与会话引用回跳、定标重试和未开工无责退款。 |
| 类型检查、生产构建、变更文件 ESLint、差异检查 | 通过 | `npm run type-check`、`npm run build`、对 11 个变更的 Vue/TypeScript 文件运行 `npx eslint --max-warnings 0`、`git diff --check`。 |
| 全量 ESLint | 退出 1，0 错误，182 条既有警告 | `npm run lint`。T-023 记录为 210 条警告。 |

在前端工程运行以下浏览器命令，沿用 T-023 的本地视口配置。首轮的 `-g` 包含匹配所有用例的分支。

```powershell
npm run test:e2e -- --config=test-results-t023-config/msedge.ts --output=test-results-t024-edge e2e/work-publication.spec.ts e2e/order-payment.spec.ts e2e/order-fulfillment.spec.ts e2e/quote-award.spec.ts e2e/order-refund.spec.ts e2e/order-refund-flow.spec.ts e2e/settlement-income.spec.ts -g '创作者草稿、驳回补正|取消现货订单|.*'
npm run test:e2e -- --config=test-results-t023-config/msedge.ts --output=test-results-t024-edge-retry e2e/work-publication.spec.ts e2e/order-payment.spec.ts e2e/order-fulfillment.spec.ts e2e/quote-award.spec.ts e2e/settlement-income.spec.ts -g '创作者草稿、驳回补正|取消现货订单|买家确认模拟条款|五节点图文制作|报价撤回重报|创作者收入记录'
npm run test:e2e -- --config=test-results-t023-config/chrome.ts --output=test-results-t024-chrome e2e/work-publication.spec.ts e2e/order-payment.spec.ts e2e/order-fulfillment.spec.ts e2e/quote-award.spec.ts -g '创作者草稿、驳回补正|取消现货订单|买家确认模拟条款|五节点图文制作|报价撤回重报|满48小时未开工'
```

初查时一次运行与页面改写重叠，Vite 导入失败。现货补测首轮使用订单路径子串比较，修正为完整路径比较后通过。Edge 集成的两项失败源于旧需求和会话选择器，以及订单状态断言匹配到筛选项。更新定位后复测，保留原业务断言。已查看现货地址弹窗、付款后详情、双栏筛选选中态、定制进度和物流截图。

本轮覆盖受影响的浏览器流程。后端全量测试、真实公网邮件和 OSS 沿用对应业务任务记录。现货 24 小时自动取消的服务端专项见 [T-016](T-016-stock-order.md)。
