# 手工定制作品分享与交易平台

基于 Spring Boot 技术的手工定制作品分享与交易平台，本科毕业设计项目。系统面向 PC Web，支持作品分享、现货直购、公开与定向定制，以及买家、创作者和管理员协作。

## 当前状态

后端已实现账号注册、登录、找回密码、会话及真实 SMTP 发送逻辑，详见 [T-001](docs/development/tasks/T-001-backend-auth.md)。前端认证页面见 [T-002](docs/development/tasks/T-002-frontend-auth.md)；个人资料、头像及收货地址前后端见 [T-003](docs/development/tasks/T-003-personal-center.md)。本机 QQ SMTP 连接认证已通过，QQ/163 公网收件及找回密码补充验收用户明确暂缓；头像已完成真实 OSS 上传、私有签名读取与替换联调。作品发布、管理员审核和首页/详情/创作者主页已完成，见 [T-005](docs/development/tasks/T-005-work-publication.md)及[测试记录](docs/testing/T-005-work-publication.md)；定制需求与沟通见T-007，报价建单见T-009，模拟支付初始化见T-011，履约和互动待后续任务，当前不涉及部署。本地开发库已完成27表迁移；后续版本先在隔离库验证，开发库尚未执行的版本在下次启动新版后端时由Flyway追加，启动及验证入口见前后端README。

[T-004](docs/development/tasks/T-004-creator-onboarding.md)增加创作者入驻与管理员审核：申请撤回及补正历史、私有材料图片、收款账号加密、两级品类、会话身份切换和持久化实时通知。前后端接口及浏览器联调结果见任务与[测试记录](docs/testing/T-004-creator-onboarding.md)。本地开发库已执行 V2 申请幂等键迁移。管理员先维护启用一级品类，再由普通买家填写申请；入驻作品不自动公开。

用户已指定后续需求与开发统一以 [V1.5 MVP 版需求规格说明书](docs/requirements/requirements.md)为依据，正文文档状态保留“待审核”。[V1.5 中文文件名副本](docs/requirements/archive/手工定制作品分享与交易平台需求规格说明书_V1.5_MVP版.md)与当前正文逐字节一致，每次修改同步更新。[V1.4 MVP 版](docs/requirements/archive/手工定制作品分享与交易平台需求规格说明书_V1.4_MVP版.md)和[修订版归档](docs/requirements/archive/手工定制作品分享与交易平台需求规格说明书_修订版.md)保留为历史资料，展示版本更替，不再同步覆盖。新[数据库表结构](docs/design/数据库表结构.md)已按当前范围编写，待审核；原型基于 V1.3，待适配。独立的[后续功能清单](docs/requirements/archive/手工定制作品分享与交易平台后续功能清单.md)不属于当前验收范围。

[T-007 定制需求与沟通](docs/development/tasks/T-007-custom-requests.md)已完成需求草稿/发布/关闭/复制、仅认证创作者可见的公开大厅、单人定向邀约、私有参考图及图文会话。作品和创作者主页提供定制入口，消息中心复用现有WebSocket连接。V4追加需求幂等键/版本/逻辑删除与会话冷却字段。该阶段后端verify 148项、0失败/错误、3项云端开关跳过；真实OSS另行2项通过，浏览器32/32及前端类型/lint/构建通过，见[测试记录](docs/testing/T-007-custom-requests.md)。作品互动未出现在本次工作区，后续须按其实际交付接口接入与回归，不能把当前缺失的点赞/收藏/评论/关注视为已完成。

[T-009 报价对比与定标建单](docs/development/tasks/T-009-quote-award.md)接入报价提交、撤回重报、私有方案图片、买家多方对比和唯一待付款订单；定标保存金额、方案与地址快照，关联中标会话。买家取消或24小时超时关闭需求，原报价不恢复，订单双方仍可沟通。V5追加报价幂等键；实际回归与独立审查结果见[测试记录](docs/testing/T-009-quote-award.md)，不包含付款、履约、退款和结算。

[T-011 定制订单模拟支付与支付后初始化](docs/development/tasks/T-011-order-payment.md)接入详情内确认、幂等付款、成功流水、待结算账户快照和固定五节点，订单进入待开工、需求进入交易中。沿用V1—V5，不新增迁移；原方案及地址不变。付款丢响应后的核验、真实MySQL并发与回滚、双方通知及浏览器结果见[测试记录](docs/testing/T-011-order-payment.md)。开工、制作履约、退款、结算执行及现货建单仍待后续任务。

## 从哪里开始

1. AI 开发者先阅读 [AGENTS.md](AGENTS.md)。
2. 从 [文档中心](docs/README.md)确认项目状态和当前有效资料。
3. 查看 [需求说明](docs/requirements/README.md)与 [原型说明](docs/prototypes/README.md)。
4. 实际业务功能开始开发时，按 [开发任务约定](docs/development/README.md)记录实现、验证和交接。

## 仓库结构

```text
.
├── AGENTS.md                  # 仓库级 AI 工作约定
├── README.md                  # 项目入口
├── .editorconfig              # 文本格式约定
├── .gitignore                 # 本地配置与生成物忽略规则
├── backend/                   # Spring Boot、公共层、数据库迁移与跨域配置
├── frontend/                  # Vue / TypeScript / Vite 目录、路由及请求封装
└── docs/                      # 统一文档入口
    ├── requirements/          # 当前需求与历史归档
    ├── prototypes/            # 原型说明和原始图片
    ├── design/                # 架构、领域、数据、UI 与重要决策
    ├── development/           # 任务、实施与交接记录
    └── testing/               # 任务或功能点的简短测试结果
```

后端启动时连接 MySQL 并自动执行 Flyway；前端未登录访问业务页面先进入登录页，首页为作品发现与检索，提供本人会话、退出及个人中心入口；创作者进入我的作品，管理员进入作品审核，详情与主页均要求登录。数据库设计仍为草稿，执行迁移不等于需求或设计已全部批准。

采用按需创建目录的方式，不预建独立脚本、部署、接口契约或根测试目录。接口约定随设计与实现任务维护，必要测试代码在对应工程内组织。

## 工程初始化约定

- 技术与版本见 [ADR-001](docs/design/decisions/ADR-001-technology-stack.md)；本轮按用户已确认的选型搭建，保留不使用 Redis、原生 HttpSession 与阿里云 OSS 的约定。
- JDK 21、Maven Wrapper 3.9.15；前端 Node 24.22.2、npm 11.19.1。低于 Node 24.22.2 的版本不满足当前工程要求，需先切换工具链。
- 精确依赖在 `backend/pom.xml`、`frontend/package.json` 和生成的锁文件中维护。基础数据源及联调配置已完成，业务集成与外部服务按后续任务实现。
- 框架检查、MySQL 8.4 迁移/失败补偿及浏览器跨域联调已验证；账号及认证页面结果见 [T-001 测试记录](docs/testing/T-001-backend-auth.md)、[T-002 测试记录](docs/testing/T-002-frontend-auth.md)，个人中心及本轮回归结果见 [T-003 测试记录](docs/testing/T-003-personal-center.md)。当前工作树未包含 CI 文件，未执行远端 CI。
- 个人资料、上传文件、日志和构建产物不进入版本库；用户已指定后端配置及开发数据库凭据统一在 `application.yml` 中显式填写，不再使用 local 配置或样例文件。

## 安装与检查

前端在 `frontend/` 下执行：

```powershell
npm ci
npm run dev
```

默认访问 `http://localhost:5173`，未登录自动进入登录页；前端直连 `http://localhost:8080/api`，跨域由后端处理。质量检查使用 `npm run lint`、`npm run build`（包含类型检查），账号浏览器联调使用 `npm run test:e2e`。启动顺序、邮件配置前提和测试环境见 [前端 README](frontend/README.md)。

后端在 `backend/` 下执行：

```powershell
.\mvnw.cmd -B -ntp verify
```

macOS/Linux 使用 `sh ./mvnw -B -ntp verify`。启动使用 `./mvnw.cmd spring-boot:run`，工作目录为 `backend/`；默认连接 `localhost:3306/handcraft_trade_platform`、用户 `root`。账号密码、端口和跨域来源均在 `backend/src/main/resources/application.yml` 中显式维护；数据库须事先存在。后端测试源码仅供本地使用并已被 Git 忽略，新检出的仓库没有测试类，构建通过不代表业务测试通过。验证边界及联调接口见 [后端 README](backend/README.md)。需要网络代理时仅配置个人工具环境，不向仓库写入代理或凭据。

接口组织约定见 [设计说明](docs/design/README.md)，测试结果的记录方式见 [测试说明](docs/testing/README.md)。

需求与原型位置、同步副本及历史资料说明见 [文档中心](docs/README.md)。
