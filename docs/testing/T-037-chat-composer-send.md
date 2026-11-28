# T-037 聊天输入与发送测试记录

- **关联任务** [T-037](../development/tasks/T-037-chat-composer-send.md)
- **环境** Edge、Node 24.22.2。真实后端用例使用独立 MySQL 8.4 与本地 OSS 协议接收器。

| 命令或操作 | 结果 | 覆盖范围 |
| --- | --- | --- |
| 新增交互用例在修改前运行 | 复现 | 输入框滚动条可见、Enter 不发送、选图后停在编辑区。 |
| `playwright test e2e/conversation-chat-ui.spec.ts e2e/chat-keyboard.spec.ts e2e/request-chat-history.spec.ts e2e/order-detail-navigation.spec.ts` | 25 项通过 | 验证滚动和输入焦点、按键发送及模拟输入法组合事件、三图直发、上传失败、原键重试、窄屏相册及历史返回。 |
| `playwright test e2e/custom-requests.spec.ts e2e/order-fulfillment.spec.ts --grep '公开咨询选图直发\|五节点图文制作'` | 2 项通过 | 验证真实发送、对方加载图片、发图后用 Enter 发文字、订单进度引用及文字草稿保留。 |
| `eslint src e2e *.ts *.js --max-warnings 0`、`npm run build`、`git diff --check` | 通过 | 包含生产构建和 TypeScript 检查。 |
