# 手工定制作品分享与交易平台

基于 Spring Boot 技术的手工定制作品分享与交易平台，本科毕业设计项目。系统面向 PC Web，支持作品分享、现货直购、公开与定向定制，以及买家、创作者和管理员协作。

## 当前状态

项目已建立前后端框架骨架及基础检查配置。前端是空白 Vue 应用；后端已有启动入口、公共响应与异常处理，尚无业务实现。数据库设计及 Flyway 建表 SQL 已编写、未执行，数据库与外部服务尚未接入；工程现状见前后端 README。当前不涉及部署。

用户已指定后续需求与开发统一以 [V1.5 MVP 版需求规格说明书](docs/requirements/requirements.md)为依据，正文文档状态保留“待审核”。[V1.5 中文文件名副本](docs/requirements/archive/手工定制作品分享与交易平台需求规格说明书_V1.5_MVP版.md)与当前正文逐字节一致，每次修改同步更新。[V1.4 MVP 版](docs/requirements/archive/手工定制作品分享与交易平台需求规格说明书_V1.4_MVP版.md)和[修订版归档](docs/requirements/archive/手工定制作品分享与交易平台需求规格说明书_修订版.md)保留为历史资料，展示版本更替，不再同步覆盖。新[数据库表结构](docs/design/数据库表结构.md)已按当前范围编写，待审核；原型基于 V1.3，待适配。独立的[后续功能清单](docs/requirements/archive/手工定制作品分享与交易平台后续功能清单.md)不属于当前验收范围。

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
├── backend/                   # Spring Boot 骨架、公共层与未执行的 Flyway SQL
├── frontend/                  # Vue / TypeScript / Vite 最小骨架
├── .github/workflows/ci.yml    # 框架检查，不含部署
└── docs/                      # 统一文档入口
    ├── requirements/          # 当前需求与历史归档
    ├── prototypes/            # 原型说明和原始图片
    ├── design/                # 架构、领域、数据、UI 与重要决策
    ├── development/           # 任务、实施与交接记录
    └── testing/               # 任务或功能点的简短测试结果
```

已按用户授权初始化框架。后端保留尚无业务实现的三层目录，资源包含待审核的数据库迁移；前端仅保留 Vue 必需入口和空白根组件。

采用按需创建目录的方式，不预建独立脚本、部署、接口契约或根测试目录。接口约定随设计与实现任务维护，必要测试代码在对应工程内组织。

## 工程初始化约定

- 技术与版本见 [ADR-001](docs/design/decisions/ADR-001-technology-stack.md)；本轮按用户已确认的选型搭建，保留不使用 Redis、原生 HttpSession 与阿里云 OSS 的约定。
- JDK 21、Maven Wrapper 3.9.15；前端 Node 24.22.2、npm 11.19.1。系统 Node 21 不满足前端要求，需切换 Node 24。
- 精确依赖在 `backend/pom.xml`、`frontend/package.json` 和生成的锁文件中维护。后续按业务任务补充应用配置、数据库集成及功能实现。
- 当前只有框架构建检查，业务集成尚未验证；基础 CI 尚未在远端运行。
- 本地密钥、个人资料、上传文件、日志和构建产物不进入版本库；可提交不含真实凭据的配置样例。

## 安装与检查

前端在 `frontend/` 下执行：

```powershell
npm ci
npm run dev
```

页面为空白。质量检查使用 `npm run lint`、`npm run build`（包含类型检查）。详细目录和版本说明见 [前端 README](frontend/README.md)。

后端在 `backend/` 下执行：

```powershell
.\mvnw.cmd -B -ntp verify
```

macOS/Linux 使用 `sh ./mvnw -B -ntp verify`。当前检查公共框架，不代表业务或数据库集成通过；应用暂排除数据源及 Flyway 自动配置。依赖与启动说明见 [后端 README](backend/README.md)。需要网络代理时仅配置个人工具环境，不向仓库写入代理或凭据。

接口组织约定见 [设计说明](docs/design/README.md)，测试结果的记录方式见 [测试说明](docs/testing/README.md)。

需求与原型位置、同步副本及历史资料说明见 [文档中心](docs/README.md)。
