# 手工定制作品分享与交易平台

基于 Spring Boot 技术的手工定制作品分享与交易平台，本科毕业设计项目。系统面向 PC Web，支持作品分享、现货直购、公开与定向定制，以及买家、创作者和管理员协作。

## 当前状态

项目已建立前后端框架骨架及基础检查配置。前端是可启动的空白 Vue 应用；后端只有依赖、Maven 构建及空目录，没有 Java 类和应用配置，暂不能启动。业务、数据库结构和外部服务接入均未实现。本轮不涉及部署。

用户已指定后续需求与开发统一以 [V1.4 MVP 版需求规格说明书](docs/requirements/requirements.md)为依据，正文文档状态保留“待审核”。[MVP 版中文文件名副本](docs/requirements/archive/手工定制作品分享与交易平台需求规格说明书_V1.4_MVP版.md)与[原文件名副本](docs/requirements/archive/手工定制作品分享与交易平台需求规格说明书_修订版.md)均与当前正文逐字节一致，每次修改同步更新。旧版资料仅供追溯；原数据库设计已删除，待按 V1.4 重新设计；原型基于 V1.3，待适配。独立的[后续功能清单](docs/requirements/archive/手工定制作品分享与交易平台后续功能清单.md)不属于当前验收范围。

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
├── backend/                   # Maven 依赖与空包结构
├── frontend/                  # Vue / TypeScript / Vite 最小骨架
├── .github/workflows/ci.yml    # 框架检查，不含部署
└── docs/                      # 统一文档入口
    ├── requirements/          # 当前需求与历史归档
    ├── prototypes/            # 原型说明和原始图片
    ├── design/                # 架构、领域、数据、UI 与重要决策
    ├── development/           # 任务、实施与交接记录
    └── testing/               # 任务或功能点的简短测试结果
```

已按用户授权初始化最小框架。后端包和资源目录使用 `.gitkeep` 保留，前端仅保留 Vue 必需入口和空白根组件。

采用按需创建目录的方式，不预建独立脚本、部署、接口契约或根测试目录。接口约定随设计与实现任务维护，必要测试代码在对应工程内组织。

## 工程初始化约定

- 技术与版本见 [ADR-001](docs/design/decisions/ADR-001-technology-stack.md)；本轮按用户已确认的选型搭建，保留不使用 Redis、原生 HttpSession 与阿里云 OSS 的约定。
- JDK 21、Maven Wrapper 3.9.15；前端 Node 24.22.2、npm 11.19.1。系统 Node 21 不满足前端要求，需切换 Node 24。
- 精确依赖在 `backend/pom.xml`、`frontend/package.json` 和生成的锁文件中维护。配置类、启动类、业务配置及 SQL 按本轮范围留给后续任务。
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

macOS/Linux 使用 `sh ./mvnw -B -ntp verify`。当前没有启动类、应用配置与测试用例，构建产物不能启动；依赖说明与后续启动条件见 [后端 README](backend/README.md)。需要网络代理时仅配置个人工具环境，不向仓库写入代理或凭据。

接口组织约定见 [设计说明](docs/design/README.md)，测试结果的记录方式见 [测试说明](docs/testing/README.md)。

需求与原型位置、同步副本及历史资料说明见 [文档中心](docs/README.md)。
