# T-029 现货快照图片与后台查证

- 状态：已完成
- 更新日期：2026-11-25
- 需求依据：[V1.5 §3.1、§4.5.4、§4.7.3、§4.9.3、§5.4](../../requirements/requirements.md)
- 实施入口：[后端专项审查第二批](../backend-audit-implementation-plan.md#第-2-批--现货快照图片与后台查证)
- 依赖：[已验收的 T-028 现货普通售后与恢复直购](T-028-stock-refund-recovery.md)

## 目标与验收

- 现货订单双方可读取成交主图和规格图。把图片替换或作品下架后，历史快照和售后查证仍可读取原图。缺少图片字段的旧单继续展示其余明细。
- 后台综合订单展示会话概要并定位关联售后。管理员通过对应的售后或评价举报查看真实会话记录和附件，可翻页且不改变双方的已读游标。
- 新签名接口核对登录身份、订单与查证资源的归属、快照或消息的实际引用。图片回收保留快照引用，仍清理到期孤儿图。

## 实施与验证

- [x] 接通现货成交图片的读取、回收保护和页面展示。
- [x] 提供后台订单会话摘要和关联售后入口。
- [x] 接通评价举报的只读会话分页和图片查证。
- [x] 通过隔离 MySQL、浏览器联调、前端检查及独立审查，更新总计划。

## 接口

| 接口 | 读取范围 |
| --- | --- |
| `GET /api/orders/{orderId}/stock-images/{fileId}` | 本单买家或创作者读取成交快照引用的可用作品图，返回 `ImageVO`。 |
| `GET /api/admin/orders/{id}` | 返回可空的 `conversationSummary` 和 `refundApplicationId`。兼容字段 `messages` 返回空数组。 |
| `GET /api/admin/refund-applications/{id}/images/{fileId}` | 在原售后图片授权中增加该单的现货快照图。会话正文继续走售后消息接口。 |
| `GET /api/admin/review-reports/{id}/messages` | 管理员读取相关会话。`before` 为正数，`after` 为非负数，均为排他游标，且只能传其一。`size` 默认为 20，范围为 1–50。按序号升序返回 `items` 和 `hasMore`。 |
| `GET /api/admin/review-reports/{id}/images/{fileId}` | 管理员读取该举报关联会话实际引用的可用图片，返回 `ImageVO`。 |

综合订单优先直达关联待处理申请，其次直达唯一可查的历史申请。存在多条历史记录时通过订单号筛选售后列表。评价举报详情的兼容字段 `messages` 也返回空数组。会话查证保持双方已读游标，复用现有订单、文件和会话表。

## 验证与交接

隔离 MySQL 定向 105 项、Playwright 业务 20 项及 SMTP 夹具相关认证回归 5 项通过。前端检查、构建和前后端独立审查通过。 [测试记录](../../testing/T-029-stock-snapshot-evidence.md)

下一批从存量作品和需求的品类判断、定标截止校验开始。 [第三批实施入口](../backend-audit-implementation-plan.md#第-3-批--存量品类与定标截止)
