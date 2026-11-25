# 项目文档中心

更新日期：2026-11-25。

这里是从 0 开发时的统一上下文入口。先确认当前资料与任务，再按需要阅读相关文档；不要把所有历史版本同时作为实现依据。

## 1. 当前资料与状态

| 资料或能力 | 当前状态 | 入口与用途 |
| --- | --- | --- |
| 当前需求依据 | V1.5 MVP 版，已确认作为最终实现与验收依据；正文状态为已确认 | [需求正文](requirements/requirements.md)，用于需求、设计、实现及验收 |
| MVP 版中文文件名副本 | 与当前正文逐字节一致，同步维护 | [MVP 版需求规格说明书](requirements/archive/手工定制作品分享与交易平台需求规格说明书_V1.5_MVP版.md)，与正式入口为同一份需求内容 |
| 后续功能清单 | 独立于 MVP 正文，完成后按剩余时间选择补充 | [后续功能清单](requirements/archive/手工定制作品分享与交易平台后续功能清单.md)，保存移出功能及补充规则线索 |
| 需求历史资料 | V1.4 MVP 版、修订版、旧版 Markdown 和 Word 保留供追溯及展示版本更替 | [需求索引](requirements/README.md)，区分当前版本同步副本与历史资料 |
| 页面原型 | 用户指定 TSX 为新版 PC Web 界面参考 | [原型索引](prototypes/README.md)，含角色页面索引和 TSX 原件 |
| PC Web 前端重做 | 第 1 批接通认证和作品浏览，第 2 批接通个人中心、创作者入驻、审核、作品管理和互动，第 3 批接通定制需求、报价、定标与消息，第 4 批接通现货直购、定制订单、模拟支付及履约 | [前端重做开发指南](design/frontend-rebuild-guide.md) · [T-021](development/tasks/T-021-craftflow-auth-discovery.md) · [T-022](development/tasks/T-022-craftflow-account-works.md) · [T-023](development/tasks/T-023-craftflow-requests-quotes-messages.md) · [T-024](development/tasks/T-024-craftflow-orders-payment-fulfillment.md) |
| AI 协作约定 | 已建立 | [AGENTS.md](../AGENTS.md)，规定任务、实现与验证方式 |
| 技术选型 | 用户已确认采用；账号本地业务集成已验证，QQ/163 公网收件及找回密码补充验收已由用户于 2026-11-23 手动验证通过（依据用户反馈），其他业务能力按任务验证 | [ADR-001](design/decisions/ADR-001-technology-stack.md) |
| 数据库详细设计 | V1.5 设计草稿；27 表 Flyway SQL 已在本地执行，迁移及失败补偿在 MySQL 8.4 验证 | [数据库表结构](design/数据库表结构.md)，含字段、索引、应用关联与事务回滚 |
| 架构、领域与 UI 详细设计 | 尚未编写 | [设计约定](design/README.md)，在相关任务中逐步形成 |
| 前后端工程 | 已有账号、个人中心、创作者入驻与后台审核、两级品类、身份切换、系统通知、作品链路、作品互动、定制需求与会话、报价定标、定制与现货模拟支付、履约、退款裁定、模拟结算、评价及口碑治理。QQ/163 公网收件及找回密码补充验收已由用户于 2026-11-23 手动验证通过 | [后端说明](../backend/README.md)、[前端说明](../frontend/README.md)、[T-002](development/tasks/T-002-frontend-auth.md)、[T-003](development/tasks/T-003-personal-center.md)、[T-004](development/tasks/T-004-creator-onboarding.md)、[T-005](development/tasks/T-005-work-publication.md)、[T-006](development/tasks/T-006-work-interactions.md)、[T-007](development/tasks/T-007-custom-requests.md)、[T-009](development/tasks/T-009-quote-award.md)、[T-011](development/tasks/T-011-order-payment.md)、[T-013](development/tasks/T-013-order-fulfillment.md)、[T-014](development/tasks/T-014-refund-adjudication.md)、[T-015](development/tasks/T-015-settlement-income.md)、[T-016](development/tasks/T-016-stock-order.md)、[T-017](development/tasks/T-017-order-reviews-reputation.md) |
| 前后台导航与工作区 | T-008 已完成独立后台、审核双栏、前台一级导航、创作者工作台与消息双栏；需求和沟通移出个人中心，旧链接兼容跳转 | [T-008](development/tasks/T-008-navigation-layout.md)、[测试记录](testing/T-008-navigation-layout.md) |
| 聊天连接与查询优化 | T-010 已完成心跳检测、有限重连、按会话合并刷新和每轮凭证查询复用；握手失败仍查询持久化未读，已完成隔离回归及失败项复测 | [T-010](development/tasks/T-010-chat-reliability.md)、[测试记录](testing/T-010-chat-reliability.md) |
| 报价对比与定标建单 | T-009已完成：报价/撤回、私有图片、对比、唯一待付款订单、取消/超时及关联会话；独立审查与最终回归通过 | [T-009](development/tasks/T-009-quote-award.md)、[测试记录](testing/T-009-quote-award.md) |
| 定制模拟支付与初始化 | T-011已完成详情确认、幂等付款、待结算及五节点，进入PAID待开工；未知结果恢复、独立审查与最终回归通过 | [T-011](development/tasks/T-011-order-payment.md)、[测试记录](testing/T-011-order-payment.md) |
| 定制订单履约与制作进度 | T-013已完成：开工、五节点、补充、原子发货、更正与收货，未开工无责退款、私图、节点会话引用、扫描及需求完结；独立审查及联合回归通过，不执行结算 | [T-013](development/tasks/T-013-order-fulfillment.md)、[测试记录](testing/T-013-order-fulfillment.md) |
| 普通售后与管理员退款裁定 | T-014已完成：申请、双方追加补证、撤回、后台只读查证/退回核验、版本裁定及公共原子退款；独立审查及最终回归通过 | [T-014](development/tasks/T-014-refund-adjudication.md)、[测试记录](testing/T-014-refund-adjudication.md) |
| 模拟结算与创作者收入记录 | T-015已完成：定时扫描满七天到期订单原子结算、与售后双向互斥幂等、创作者收入页与后台资金记录页及订单详情结算时间；独立审查与最终回归通过 | [T-015](development/tasks/T-015-settlement-income.md)、[测试记录](testing/T-015-settlement-income.md) |
| 现货直购建单与模拟支付 | T-016已完成：详情直购、单件锁定、模拟付款、未知结果恢复、履约定时扫描及现有发货流程通过；真实 MySQL 专项 8 项、订单支付/履约兼容回归 28 项、浏览器专项 1 项及前端 lint/构建通过 | [T-016](development/tasks/T-016-stock-order.md)、[测试记录](testing/T-016-stock-order.md) |
| 订单评价与创作者口碑 | T-017完成评价资格、图文评价、统一口碑统计、评价举报补证、管理员处置/更正与前后端入口；后端真实 MySQL 用例与浏览器 E2E 均通过，2026-11-23 完成独立验收 | [T-017](development/tasks/T-017-order-reviews-reputation.md)、[测试记录](testing/T-017-order-reviews-reputation.md) |
| 定制成品公开授权与案例发布 | T-018已完成前后端实现及独立验收；订单按钮授权、持久化通知、案例来源校验及现货禁售已接入，浏览器 E2E 2 项通过 | [T-018](development/tasks/T-018-custom-publication-consent.md)、[测试记录](testing/T-018-custom-publication-consent.md) |
| 后台管理模块补齐 | T-019已增加看板、用户暂停处置、订单综合检索与详情、资金筛选及本人暂停接单入口；后端 2 项与浏览器 E2E 1 项通过，2026-11-23 完成独立验收 | [T-019](development/tasks/T-019-admin-management.md)、[测试记录](testing/T-019-admin-management.md) |
| 内容治理举报扩展与处置通知 | T-020已完成：作品/评论/主页举报入口、我的举报列表、后台统一举报队列与按类型处置（下架/隐藏/暂停及恢复更正）、举报处置与账号处置通知；真实 MySQL 专项 6 项及受影响回归 24 项、浏览器 E2E 通过 | [T-020](development/tasks/T-020-content-report-governance.md)、[测试记录](testing/T-020-content-report-governance.md) |
| 主流程演示反馈 | T-012 已完成详情离页请求、管理员聊天未读、状态提示及订单排版修复；相关 25 项用例经复测通过，初次主流程检查和修复复测维护在同一报告 | [T-012](development/tasks/T-012-demo-feedback.md)、[主流程演示报告](testing/demo-main-flow.md) |
| 业务接口、自动化测试与 CI | 已交付业务用真实MySQL、HTTP、WebSocket及协议接收器验证；T-015最终后端verify323项、0失败/错误、14项真实OSS条件跳过，全量浏览器87/87、前端类型/lint/构建通过，历史云端结果单独保留；后端测试源码仅本地保留且被Git忽略；无CI文件，未执行远端CI | [当前集成回归](testing/T-015-settlement-income.md)、[互动历史回归](testing/T-006-work-interactions.md)、[全部业务测试记录](testing/README.md) |

用户已于 2026-11-12 指定 V1.5 MVP 版为后续需求与开发依据，`requirements.md` 已同步替换。2026-11-23 完成 T-017—T-020 独立验收后，正文状态由“待审核”改为“已确认”，作为最终实现与验收依据。历史版本仍保留原有状态与内容；遇到影响实现的歧义或冲突，记录具体问题并澄清，不拼接不同版本的规则。

V1.5 MVP 版正文仅描述完整实现范围，不划分功能优先级，也不混入后续功能清单或版本对比。阅读重点为第 4 章功能、第 6 章规则、第 8 章验收及附录 A 状态流转；后续功能另见独立清单。原 V1.3 数据库设计及配套建模草稿已删除，不能从旧材料重新引入已移出的功能。

`requirements/requirements.md` 与 `requirements/archive/手工定制作品分享与交易平台需求规格说明书_V1.5_MVP版.md` 是当前需求的两份相同内容文件。日常以 `requirements.md` 为编辑入口，每次修改后同步当前版本中文副本并验证逐字节一致。V1.4 MVP 版、`_修订版.md`、旧版 Markdown 与原始 Word 作为历史资料保留，不随当前正文同步；版本升级时保留上一版本文件及其原有内容，用于展示版本更替。

用户已授权补齐框架。后端有启动入口、公共响应/异常处理、数据源与 Flyway、MyBatis-Plus 和 CORS/安全链；前端有 Router、Pinia、Axios/CSRF 封装，认证页面已接入对应后端接口。当前机器的 handcraft_trade_platform 开发库（MySQL 8.0.46）已完成 V1 初始化；另在独立 MySQL 8.4 验证 27 表迁移与失败补偿，人工整批回退脚本未执行。按用户要求，后端非敏感配置和开发数据库凭据集中在 `backend/src/main/resources/application.yml` 显式维护，敏感凭据改由本机 `backend/src/main/resources/application-local.yml` 提供（已被 Git 忽略并由 `spring.config.import` 导入），不使用环境变量占位。实际业务功能开发按任务记录；文档修改、选型、初始化和纯设计不建立任务或对应检查记录。

当前项目不涉及部署，不建立部署配置、部署文档或独立脚本目录。后续按实际产物创建必要目录，避免提前增加层级。

不保留独立的 `contracts/` 和根目录 `tests/`。接口约定在设计与实现时明确；仅业务功能开发或业务缺陷修复编写测试类；后端 `src/test/java/` 内容仅供本地使用，不纳入 Git。非业务工作通过临时命令或实际运行验证，不新增持久化测试类。本目录的 `testing/` 仅保存任务或功能点的简短测试结果，不再细分子目录。

2026-11-13 T-001 账号后端已实现并通过本地验证：只支持 QQ/163 邮箱，注册填写昵称，验证码五分钟共用，登录七天绝对有效、多端可用，重置撤销旧会话。T-002 接入登录、注册及找回页面、受保护会话首页，复用 Cookie/CSRF/CORS。本机 QQ SMTP 连接认证已通过，QQ/163 公网收件及找回密码补充验收已由用户于 2026-11-23 手动验证通过。T-003 增加个人资料、独立头像上传与收货地址，用户补齐北京私有 OSS 配置后，真实云端上传、读取与替换联调已通过；订单地址快照随订单功能实现。任务、接口和实际测试入口见上表。

T-004 已实现创作者申请、撤回补正、后台审核及材料比较、两级品类、收款账号加密、私有入驻图片、当前会话身份切换及持久化实时通知。V2 为申请增加用户范围请求键，本机开发库已执行；具体状态及验证以 [T-004](development/tasks/T-004-creator-onboarding.md) 为准。入驻材料不会自动公开；作品发布、审核与浏览在 [T-005](development/tasks/T-005-work-publication.md)实现，需求关系内的业务会话见T-007，报价与待付款订单见T-009，模拟付款初始化见T-011，定制履约与未开工退款见T-013。

T-005 已完成作品草稿、发布额度、版本冲突、审核历史、作品图片、通知与首页/详情/基础创作者主页。V3 保留 V1/V2，补齐历史作品创建请求键及版本；已在隔离库验证，未向开发库执行，下次启动新版后端时自动追加。浏览页面均要求登录。交易设置即时生效、图文修改重审；前后端验收以 [T-005](development/tasks/T-005-work-publication.md)及[测试记录](testing/T-005-work-publication.md)为准。

## 2. 文档导航

[T-006 作品互动与个人收藏、关注](development/tasks/T-006-work-interactions.md)从`codex/work-interactions`的`e647524`整合到当前`codex/custom-requests-conversations`分支，保留T-007—T-011完整业务。接入点赞、收藏、图文评论、关注及个人列表，无新增迁移或开发配置；集成复测见[测试记录](testing/T-006-work-interactions.md)，用户已于2026-11-19明确授权完成合并提交及推送，提交信息以Git记录为准。

[T-007 定制需求与需求沟通](development/tasks/T-007-custom-requests.md)已完成前后端及实际验收：包含需求草稿/发布/关闭/复制、公开大厅、单人定向邀约、私有图片与图文会话，V4追加幂等/版本/删除/冷却字段。大厅权限按用户确认补充到V1.5正文并同步中文副本，正文状态见当前需求正文。互动集成后的共存回归见T-006。

[T-009 报价对比与定标建单](development/tasks/T-009-quote-award.md)沿用需求及会话，实现报价、定标快照与唯一订单，买家取消或超时关闭需求，中标会话继续可用。V5追加报价请求键，V1—V5迁移已在隔离MySQL验证，开发库由实际启动追加尚未执行版本。

[T-011定制订单模拟支付与支付后初始化](development/tasks/T-011-order-payment.md)沿用V1—V5，付款原子保存成功流水、PAID待开工、IN_TRADE、待结算快照和五个未开始节点；前端保留未知付款确认并核验结果，双方收到持久化通知。开工、制作履约及未开工退款由T-013承接，普通售后由T-014承接；结算执行由T-015完成，现货直购由[T-016](development/tasks/T-016-stock-order.md)完成，订单评价与口碑治理由[T-017](development/tasks/T-017-order-reviews-reputation.md)完成。

[T-008 导航与工作区修复](development/tasks/T-008-navigation-layout.md)沿用现有接口：管理员默认进入固定左栏的后台，作品和入驻审核保留队列/详情上下文；普通用户从一级导航管理需求，从独立消息中心沟通，个人中心保留资料、地址与入驻，并由T-006补入收藏、关注。当前页面路径以[前端说明](../frontend/README.md)为准，旧个人中心需求/消息路径兼容跳转。

[T-010 聊天连接可靠性与查询优化](development/tasks/T-010-chat-reliability.md)沿用原有 HTTP 写入、消息先存后推及鉴权规则，补齐无响应连接恢复，减少无关会话刷新和同用户多端凭证查询。为避开同时进行的报价/订单开发，使用独立快照及端口验收；结果与限制见[测试记录](testing/T-010-chat-reliability.md)。

| 目录 | 放什么 | 入口 |
| --- | --- | --- |
| `requirements/` | 当前需求、当前版本中文副本及历史资料 | [需求管理](requirements/README.md) |
| `prototypes/` | 原型索引、当前 TSX 及历史静态原型 | [页面原型](prototypes/README.md) |
| `design/` | 架构、领域、权限、状态、数据库、UI 和设计决策 | [设计文档约定](design/README.md) |
| `development/` | 实际业务功能开发及缺陷修复任务 | [任务管理](development/README.md) |
| `testing/` | 实际业务功能测试的通过、失败及复测记录 | [测试记录约定](testing/README.md) |

测试记录格式见 [测试说明](testing/README.md)。以下是当前实际存在的全部文件与子目录；带“预留”的内容尚无实际设计产物。

```text
docs/
├── README.md                         # 总导航、资料状态与维护约定
├── requirements/                     # 当前需求与历史资料
│   ├── README.md                     # 指明有效参考与历史版本的使用方式
│   ├── requirements.md               # 当前 V1.5 MVP 版需求，文档状态为已确认
│   └── archive/                      # 中文文件名副本、后续清单及历史资料
│       ├── 手工定制作品分享与交易平台需求规格说明书_V1.5_MVP版.md # 当前正文的同步副本
│       ├── 手工定制作品分享与交易平台需求规格说明书_V1.4_MVP版.md # 历史版本，保留原内容
│       ├── 手工定制作品分享与交易平台后续功能清单.md # MVP 完成后可选择补充的功能
│       ├── 手工定制作品分享与交易平台需求规格说明书.md
│       ├── 手工定制作品分享与交易平台需求规格说明书.docx
│       └── 手工定制作品分享与交易平台需求规格说明书_修订版.md # 历史修订资料，不再同步覆盖
├── prototypes/                       # 页面布局与流程参考
│   ├── README.md                     # 原型导航、页面索引与使用边界
│   ├── code_artifact.tsx             # 原始 TSX，作为界面对照基准
│   ├── craftflow/                    # 按角色拆分的原型，入口为 App.tsx
│   └── assets/                       # 第一版静态原型
│       ├── 原型说明.md               # 视觉方向、页面联系与制作说明
│       ├── 00_系统原型总览.png        # 所有页面与主要流程的总览
│       ├── 01_首页与作品发现.png      # 搜索、品类和作品浏览
│       ├── 02_作品详情与双交易入口.png # 现货与同类定制入口
│       ├── 03_发布定制需求.png        # 公开或定向需求表单
│       ├── 04_需求详情与报价对比.png  # 方案比较与定标
│       ├── 05_现货结算与模拟支付.png  # 地址、金额与模拟付款
│       ├── 06_定制订单与制作进度.png  # 订单状态、节点与履约
│       ├── 07_创作者工作台.png        # 创作者任务与管理入口
│       ├── 08_订单会话与系统通知.png  # 业务聊天与通知
│       ├── 09_后台审核与运营管理.png  # 管理员审核和管理入口
│       └── 10_作品发布与交易设置.png  # 作品表单与交易开关
├── design/                           # 已选技术与设计材料约定
│   ├── README.md                     # 现有文档状态与后续设计边界
│   ├── frontend-rebuild-guide.md      # 前端重做顺序、范围和验收
│   ├── 数据库表结构.md                # V1.5 草稿；字段、索引、关联及事务回滚
│   └── decisions/                    # 重要方案的取舍记录
│       └── ADR-001-technology-stack.md # 已选技术与兼容依据
├── development/                      # 开发任务与过程记录
│   ├── README.md                     # 如何拆任务、记录状态及交接
│   └── tasks/                        # 具体任务文件
│       ├── TASK_TEMPLATE.md          # 业务功能开始开发时使用的模板
│       ├── T-001-backend-auth.md     # 账号后端接口与验收状态
│       ├── T-002-frontend-auth.md    # 认证页面与联调验收
│       ├── T-003-personal-center.md  # 个人资料、头像与收货地址
│       ├── T-004-creator-onboarding.md # 创作者入驻、审核、品类与通知
│       ├── T-005-work-publication.md # 作品发布、审核与浏览
│       ├── T-006-work-interactions.md # 作品互动与个人收藏、关注
│       ├── T-007-custom-requests.md # 定制需求、定向邀约与图文会话
│       ├── T-008-navigation-layout.md # 前后台导航、审核与消息双栏修复
│       ├── T-009-quote-award.md        # 报价对比、定标及待付款订单
│       ├── T-010-chat-reliability.md  # 聊天心跳、有限重连与查询优化
│       ├── T-011-order-payment.md     # 定制付款、待结算及五节点初始化
│       ├── T-012-demo-feedback.md     # 主流程演示反馈修复
│       ├── T-013-order-fulfillment.md # 定制履约、制作进度及未开工退款
│       ├── T-014-refund-adjudication.md # 普通售后、双方补证及管理员裁定
│       ├── T-015-settlement-income.md # 模拟结算与创作者收入记录
│       ├── T-016-stock-order.md      # 现货直购建单与模拟支付
│       ├── T-017-order-reviews-reputation.md # 订单评价与创作者口碑
│       ├── T-018-custom-publication-consent.md # 定制成品公开授权及案例发布
│       ├── T-019-admin-management.md # 后台看板、用户、订单和资金筛选
│       ├── T-020-content-report-governance.md # 内容举报扩展、处置与账号处置通知
│       ├── T-021-craftflow-auth-discovery.md   # CraftFlow 认证、公共布局与作品浏览
│       ├── T-022-craftflow-account-works.md    # CraftFlow 个人中心、入驻、作品与互动
│       ├── T-023-craftflow-requests-quotes-messages.md    # CraftFlow 定制需求、报价与消息
│       └── T-024-craftflow-orders-payment-fulfillment.md    # CraftFlow 订单、付款与履约
└── testing/                          # 简短测试结果，不存测试代码、不建子目录
    ├── README.md                     # 业务功能测试记录方式与格式示例
    ├── T-001-backend-auth.md          # 账号后端测试与复测结果
    ├── T-002-frontend-auth.md         # 认证浏览器联调与复测结果
    ├── T-003-personal-center.md       # 个人中心测试及本轮回归结果
    ├── T-004-creator-onboarding.md    # 入驻、审核与通知联调结果
    ├── T-005-work-publication.md       # 作品、审核、浏览及完整回归结果
    ├── T-006-work-interactions.md      # 互动、图片及业务分支集成回归
    ├── T-007-custom-requests.md         # 需求、会话、真实OSS及完整回归结果
    ├── T-008-navigation-layout.md      # 导航与双栏交互修复及回归结果
    ├── T-009-quote-award.md             # 报价订单、真实OSS及完整回归结果
    ├── T-010-chat-reliability.md        # 聊天可靠性及查询优化回归结果
    ├── T-011-order-payment.md           # 支付事务、并发及付款恢复回归结果
    ├── demo-main-flow.md                # 主流程演示检查与反馈修复复测
    ├── T-013-order-fulfillment.md        # 履约、退款、图片及恢复回归
    ├── T-014-refund-adjudication.md      # 售后裁定、原子退款及未知结果恢复
    ├── T-015-settlement-income.md        # 结算扫描、双向竞争及收入页面回归
    ├── T-016-stock-order.md             # 现货直购及模拟支付回归
    ├── T-017-order-reviews-reputation.md # 评价资格、口碑与举报治理
    ├── T-018-custom-publication-consent.md # 定制成品公开授权与案例发布验收
    ├── T-019-admin-management.md        # 后台看板、用户与订单管理验收
    ├── T-020-content-report-governance.md # 内容举报、处置及账号处置通知
    ├── T-021-craftflow-auth-discovery.md   # CraftFlow 首批浏览器回归
    ├── T-022-craftflow-account-works.md    # CraftFlow 第 2 批浏览器回归
    ├── T-023-craftflow-requests-quotes-messages.md    # CraftFlow 第 3 批浏览器回归
    └── T-024-craftflow-orders-payment-fulfillment.md    # CraftFlow 第 4 批浏览器回归
```

补充说明：

- `archive/` 中仅当前 V1.5 中文副本随 `requirements.md` 同步；V1.4、`_修订版.md` 及不带版本后缀的 Markdown 是历史资料，Word 是原始输入，均不随当前正文覆盖。
- `prototypes/README.md` 记录当前 TSX 原型、角色页面索引和前端重做范围。`assets/原型说明.md` 为第一版静态原型说明。
- 原 `design/database.md` 已删除，现有 [数据库表结构](design/数据库表结构.md)为按当前需求编写的新草稿，对应 SQL 位于后端 `src/main/resources/db/migration/`，V1 已执行且包含异常结构补偿；人工结构回退位于相邻 `rollback/`，未执行。
- `decisions/` 中的 ADR-001 记录已选技术；选型和框架验证不代表全部业务已经实现，SMTP 公网实收补充验收已由用户于 2026-11-23 手动验证通过（依据用户反馈），OSS 实际结果见 T-003。
- `TASK_TEMPLATE.md` 仅用于实际业务功能开发或业务缺陷修复；当前已有账号后端T-001、认证前端T-002、个人中心T-003、入驻审核T-004、作品链路T-005、作品互动T-006、定制需求/会话T-007、导航交互修复T-008、报价/待付款订单T-009、聊天优化T-010、模拟付款T-011、演示反馈修复T-012、定制履约T-013、普通售后T-014、模拟结算T-015、现货直购T-016、订单评价与口碑T-017、定制案例授权T-018、后台管理T-019及内容举报治理T-020。
- `testing/README.md` 只规定业务功能测试结果如何填写；功能开发时再增加实际记录，复测更新同一文件，任务只保留总体结果和链接。

## 3. 已有资料迁移对照

需求与原型已从根目录归位；原型中的旧文件名仍用于说明其制作来源，不代表旧位置继续存在。当前需求与当前版本中文副本同步维护，历史版本及原文件名修订版独立保留，原型表达页面意图。

| 原位置 | 新位置 | 定位 |
| --- | --- | --- |
| 根目录 `手工定制作品分享与交易平台需求规格说明书_修订版.md` | [修订版归档](requirements/archive/手工定制作品分享与交易平台需求规格说明书_修订版.md) | 历史修订资料，不再随当前正文同步；当前有效需求另见 [requirements.md](requirements/requirements.md) |
| 根目录 `手工定制作品分享与交易平台需求规格说明书.md` | [历史需求正文](requirements/archive/手工定制作品分享与交易平台需求规格说明书.md) | 旧版本追溯 |
| 根目录 `手工定制作品分享与交易平台需求规格说明书.docx` | [原始 Word 文档](requirements/archive/手工定制作品分享与交易平台需求规格说明书.docx) | 原始材料保留 |
| 根目录 `原型图/` | [prototypes/assets/](prototypes/assets/) | 11 张 PNG 和 1 份原始说明，内容不变 |
| 根目录 `code_artifact.tsx` | [TSX 原型](prototypes/code_artifact.tsx) | PC Web 前端重做的界面依据 |

`手工定制作品分享与交易平台需求规格说明书_精简版.md` 和 `需求精简与待完善问题清单.md` 已按用户要求删除，不再作为归档资料保留。

## 4. AI 每次任务的最小阅读范围

1. 阅读根目录 [AGENTS.md](../AGENTS.md)及本索引。
2. 确认当前工作范围；实际业务功能开发已有任务时读取该任务，其他工作不创建任务。
3. 按任务类型补充上下文：业务任务读需求相关章节；界面任务读原型与相关规则；数据或接口任务读对应设计及实际实现。
4. 检查相关代码和工作区，再提出实施步骤并执行。
5. 功能开发完成后更新其任务及验证结果；其他工作更新受影响的正式文档，项目事实变化时更新本索引。

旧版需求和原始 Word 只在追溯问题时加载。新聊天从本索引及相关需求、设计和工程 README 恢复上下文，已有业务任务时再读取任务。

## 5. 文档如何逐步补齐

| 文档类型 | 创建时机 | 必须说明 |
| --- | --- | --- |
| 需求修订 | 本轮范围或业务含义改变时 | 变更点、依据、受影响的设计与验收 |
| 全局设计 | 工程初始化前 | 技术与版本选择、系统边界、运行环境、验证方案 |
| 局部设计 | 对应任务开始前 | 领域规则、接口、数据、异常和约束；简单任务可写在任务中 |
| 设计决策 | 存在重要取舍时 | 背景、备选方案、选择理由和后果 |
| 任务记录 | 开始实际业务功能开发或业务缺陷修复时 | 目标、范围、验收、步骤、结果、交接 |
| 测试记录 | 实际执行业务功能测试时 | 日期、任务或功能点、测试项与操作、通过或失败及必要说明 |

暂未编写的设计保持明确状态，不创建空的“已完成设计”文件。细节随任务补齐，避免在项目开始时生成大量重复文档。

## 6. 命名、状态与单一来源

- 固定入口使用 `README.md`、`AGENTS.md`；新说明文件使用简短英文名称，正文使用中文，保留原始材料的文件名。
- 任务命名为 `T-编号-英文主题.md`；设计决策命名为 `ADR-编号-英文主题.md`。
- 任务状态统一为：待开始、进行中、受阻、待验收、已完成；受阻必须记录原因和可继续的工作。
- 设计文档标明草稿、已确认或已废弃，并注明需求依据和更新日期；已有相关业务功能任务时再附任务链接。没有确认依据，不标为已确认。
- 需求维护业务事实；设计解释方案；任务维护实施状态。其他文档引用相应来源，避免重复维护完整规则表。
- 测试结果直接写在 `testing/` 的任务或功能点记录中，任务只引用结果与链接；复测更新同一文件，不增加测试文档层级。
- 接口地址、请求方法、参数、返回字段和错误码在相关任务设计与实现时明确，必要说明随代码或任务维护，不另设接口契约目录或重复的权威定义。
- 数据库实际结构以迁移脚本为准，数据库文档解释关系、约束、索引及设计理由，不额外维护互相冲突的建库 SQL。
- 使用相对链接连接仓库内文档，移动文件时检查引用。不要在项目文档中写死个人电脑的绝对路径。

## 7. 任务完成与交接

实际业务功能开始开发时，从 [任务模板](development/tasks/TASK_TEMPLATE.md)创建记录。每个功能任务建立以下对应关系：

```text
需求章节或验收编号 → 任务 → 相关实现与接口定义 → 验证用例 → 实际结果
```

需求正文已有 `UC-01` 至 `UC-40` 验收编号，可直接引用；新增规则再补充编号，不必为相同规则另造一套编号。

完成报告至少包含改动、逐项验收结果、实际运行的命令、未执行项及原因、遗留问题和下一步。截图、AI 自述或“代码已生成”都不足以单独证明业务完成。

目录与文档修改按需检查结构、链接和差异，不创建任务或检查记录；业务代码按风险增加测试、构建、浏览器与集成验证。

## 8. 下一阶段入口

PC Web 按业务链路分批重做。认证、公共布局和作品浏览见 [T-021](development/tasks/T-021-craftflow-auth-discovery.md)，个人中心、创作者入驻、作品与互动见 [T-022](development/tasks/T-022-craftflow-account-works.md)。定制需求、报价与消息见 [T-023](development/tasks/T-023-craftflow-requests-quotes-messages.md)。现货与定制订单、支付及履约见 [T-024](development/tasks/T-024-craftflow-orders-payment-fulfillment.md)。下一批为售后、结算、评价与成品授权。 [前端重做开发指南](design/frontend-rebuild-guide.md)

后续统一以[当前 V1.5 MVP 版需求](requirements/requirements.md)为依据，其中所列需求均须实现；[后续功能清单](requirements/archive/手工定制作品分享与交易平台后续功能清单.md)独立留存，供完成后选择补充。数据库设计及 SQL 待审核。

后续从[当前需求](requirements/requirements.md)、[数据库表结构](design/数据库表结构.md)及 [ADR-001](design/decisions/ADR-001-technology-stack.md)继续。工程说明见[后端README](../backend/README.md)与[前端README](../frontend/README.md)。互动集成交接见[T-006](development/tasks/T-006-work-interactions.md)及其测试记录；QQ/163公网收件及找回密码补充验收已由用户于 2026-11-23 手动验证通过。定制履约及退款已由[T-013](development/tasks/T-013-order-fulfillment.md)完成，普通售后由[T-014](development/tasks/T-014-refund-adjudication.md)完成，模拟结算与收入记录由[T-015](development/tasks/T-015-settlement-income.md)完成，现货直购由[T-016](development/tasks/T-016-stock-order.md)完成；订单评价与口碑实现及验证见[T-017](development/tasks/T-017-order-reviews-reputation.md)；定制成品公开授权与案例发布见[T-018](development/tasks/T-018-custom-publication-consent.md)；后台看板、用户处置、综合订单及资金筛选见[T-019](development/tasks/T-019-admin-management.md)；内容治理举报扩展与处置通知见[T-020](development/tasks/T-020-content-report-governance.md)。T-017—T-020 的测试与浏览器 E2E 已于 2026-11-23 完成独立验收，均通过；QQ/163 公网收件及找回密码补充验收也已由用户于 2026-11-23 手动验证通过。至此当前需求范围内的任务均已完成验收。
