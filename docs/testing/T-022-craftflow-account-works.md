# T-022 CraftFlow 第 2 批测试记录

- 关联任务：[T-022 个人中心、创作者入驻、作品与互动](../development/tasks/T-022-craftflow-account-works.md)
- 环境：Windows、Node 24.22.3、JDK 21。沿用当前后端 JAR、隔离 MySQL 和本地 SMTP、OSS 协议接收器。故障用例通过 Playwright 控制个别响应。创作者主页迟到响应测试使用真实会话和主页，受控评价响应用于确定返回顺序。

| 日期 | 命令或验证 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-11-25 | Edge 基线，定向运行导航和互动主流程 | 1/2 | 1366 像素审核双栏通过。新增右栏计数断言在旧组件上按预期失败，实施后纳入联合回归。 |
| 2026-11-25 | Edge 首轮七组专项 | 32/32 | 入驻图片上传失败保留、通知深链、作品即时交易设置、互动计数刷新等通过。独立审查后补强编辑器反馈定位、举报草稿保留和切换账号隔离。 |
| 2026-11-25 | Edge 最终七组专项 | 33/33 | 通过下列命令覆盖真接口主流程、作品编辑器核验入口带入视口、评论读取失败保留举报草稿及换账号后拒绝旧响应。 |
| 2026-11-25 | Chrome 1366 像素专项 | 初轮 8/8，作品 3/3，互动与举报复测 3/3 | 临时配置继承仓库 Playwright 设置，使用 Chrome 通道和 1366×900 默认视口。核对个人资料、默认地址、入驻补正、品类、审核双栏、作品编辑与详情、互动和举报。末轮复测新增举报隔离。 |
| 2026-11-25 | `npm run type-check`、`npm run build`、定向 `eslint --max-warnings 0`、`git diff --check` | 通过 | 本批修改的 Vue 和 TypeScript 文件退出 0。 |
| 2026-11-25 | `npm run lint` | 退出 1 | 0 错误、210 条既有警告。实施前基线为 226 条。 |

从 `frontend/` 运行的 Edge 最终命令如下。

```powershell
npm run test:e2e -- --output=test-results/t022-edge-final e2e/personal-center.spec.ts e2e/creator-onboarding.spec.ts e2e/work-publication.spec.ts e2e/work-interactions.spec.ts e2e/navigation-layout.spec.ts e2e/content-report.spec.ts e2e/admin-notifications.spec.ts
```

本批范围为受影响的七组浏览器专项和桌面版式检查。QQ／163 公网收件、真实 OSS 云端和后端规则沿用对应业务任务的历史实测。全站浏览器联验安排在第 7 批。
