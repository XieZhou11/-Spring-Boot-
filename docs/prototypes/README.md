# 页面原型

## 当前原型与前端重做要求

2026-11-25，用户指定“匠心集 CraftFlow”TSX 原型作为新版 PC Web 前端的界面依据。后续整体重做并替换现有前端，当前待开发。逐页对照使用下方拆分版，视觉基准见 [原始单文件](code_artifact.tsx)。

- 原型已绘制页面的布局、配色、字体、组件样式、导航和交互应与 TSX 一致，覆盖登录注册、买家端、创作者工作台及管理后台。
- 原型未绘制的 V1.5 MVP 页面及必要状态沿用同一套视觉与交互风格补齐。功能范围、权限、业务状态和交易规则以 [V1.5 MVP 正文](../requirements/requirements.md)为准。
- 原型中的 React 组件以本地状态和示例数据演示操作。正式前端接入现有后端接口和 WebSocket，重做时再确定工程实现方式。
- 后续验收在浏览器中对照 TSX 核查页面呈现和操作，按 V1.5 MVP 验证业务流程。

### 按角色查找页面

| 角色或范围 | 页面 | 源码 |
| --- | --- | --- |
| 未登录 | 登录、注册、找回密码 | [AuthView.tsx](craftflow/AuthView.tsx) |
| 买家 | 作品广场、搜索筛选、作品详情及评论 | [BuyerWorks.tsx](craftflow/BuyerWorks.tsx) |
| 买家 | 定制需求、报价排序与对比 | [BuyerDemands.tsx](craftflow/BuyerDemands.tsx) |
| 创作者 | 需求大厅、作品管理、收入与模拟结算 | [CreatorViews.tsx](craftflow/CreatorViews.tsx) |
| 管理员 | 数据看板、审核中心、售后裁定、用户与品类 | [AdminViews.tsx](craftflow/AdminViews.tsx) |
| 买家与创作者共用 | 订单、履约进度、会话与通知 | [OrderView.tsx](craftflow/OrderView.tsx)、[MessageView.tsx](craftflow/MessageView.tsx) |
| 公共界面 | 顶部导航、角色切换、资料与地址、其他弹窗及提示 | [App.tsx](craftflow/App.tsx)、[Overlays.tsx](craftflow/Overlays.tsx)、[ModalForms.tsx](craftflow/ModalForms.tsx) |

预览拆分版时，以 [App.tsx](craftflow/App.tsx) 的默认导出作为 React 入口。预览环境使用 React、Lucide React 和 Tailwind CSS，Tailwind 扫描 `craftflow/` 内的 TSX。各角色共享同一份 [演示数据](craftflow/DemoData.ts)，通用封面、徽章和状态文案见 [CommonUi.tsx](craftflow/CommonUi.tsx)。

## 第一版静态原型

以下为依据 V1.3 修订版制作的静态 PC Web 原型，保留供历史追溯。第一版使用临时品牌名“拾作”。T-005 按其中 01、02、07、09、10 适配 V1.5，具体范围见 [T-005](../development/tasks/T-005-work-publication.md)。

[T-008](../development/tasks/T-008-navigation-layout.md)按原型 01、07、08、09 修复前后台导航：后台使用固定左栏及审核队列/材料双栏，前台需求独立于个人中心，沟通与通知归入消息中心，创作者使用统一工作台入口。仅适配已实现业务，不引入原型中的未实现模块。

- 第一版的视觉方向、页面清单与页面关系见 [原始原型说明](assets/原型说明.md)。
- 第一版的角色、页面和两类交易流程见 [系统原型总览](assets/00_系统原型总览.png)。

### 静态页面索引

| 原型 | 主要内容 |
| --- | --- |
| [01 首页与作品发现](assets/01_首页与作品发现.png) | 搜索、品类、作品与主要入口 |
| [02 作品详情与双交易入口](assets/02_作品详情与双交易入口.png) | 展示、现货与同类定制 |
| [03 发布定制需求](assets/03_发布定制需求.png) | 公开、定向与需求表单 |
| [04 需求详情与报价对比](assets/04_需求详情与报价对比.png) | 报价比较和定标 |
| [05 现货结算与模拟支付](assets/05_现货结算与模拟支付.png) | 地址、金额与模拟付款 |
| [06 定制订单与制作进度](assets/06_定制订单与制作进度.png) | 定制状态、节点与履约 |
| [07 创作者工作台](assets/07_创作者工作台.png) | 创作者工作入口 |
| [08 订单会话与系统通知](assets/08_订单会话与系统通知.png) | 业务沟通与消息 |
| [09 后台审核与运营管理](assets/09_后台审核与运营管理.png) | 管理员工作入口 |
| [10 作品发布与交易设置](assets/10_作品发布与交易设置.png) | 发布与独立交易开关 |

## 使用约定

- `assets/` 完整保留原 `原型图/` 的原始文件；原始说明中出现的旧需求文件名表示制作来源，当前需求入口见上方链接。
- 页面示例分别展示不同时间和状态。
- 后续 UI 规范放在 `docs/design/`，业务规则见当前需求正文。
- 新增或更新原型时同步维护本索引，说明对应需求版本；已有相关业务功能任务时再更新该任务，纯原型调整不创建开发任务。
