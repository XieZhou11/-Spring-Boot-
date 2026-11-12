# 后端工程

已建立启动入口、统一响应、异常处理、MySQL/Flyway、MyBatis-Plus 基础配置及后端 CORS/安全链。前后端可以直连联调，尚无业务接口、登录认证、SMTP 或 OSS 集成。

## 环境与依赖

- JDK 21；Maven Wrapper 固定 Maven 3.9.15，首次使用需联网下载。
- Spring Boot 4.1.2，统一管理 Spring、Security、Jackson、数据库驱动及测试依赖。
- MyBatis-Plus 3.5.18（Boot 4 starter 与分页 SQL 解析模块）、springdoc 3.2.0、阿里云 OSS SDK 3.18.5。
- 已导入 MVC、Security、Validation、WebSocket、Mail、Flyway/MySQL 及 MVC、安全、JDBC 测试依赖。HttpSession、BCrypt 与 Scheduling 使用 Spring/Tomcat 自带能力，无需额外组件。
- 数据库服务基线为 MySQL 8.4 LTS；驱动版本由 Boot BOM 管理，不等同于服务端版本。本地已有服务实际为 MySQL 8.0.46，已完成初始化；迁移及失败补偿另在独立 MySQL 8.4 测试库验证，未更换本地数据库服务。

版本依据见 [ADR-001](../docs/design/decisions/ADR-001-technology-stack.md)。

## 目录

```text
backend/
├── .mvn/wrapper/                    # 官方 Wrapper 配置
├── mvnw / mvnw.cmd                  # Maven 入口
├── pom.xml                          # 依赖与构建
└── src/
    ├── main/
    │   ├── java/com/handcraft/platform/
    │   │   ├── common/api/          # 统一响应 Result
    │   │   ├── common/exception/    # 错误码、业务异常和全局异常处理
    │   │   ├── config/              # Security、CORS 配置
    │   │   └── modules/             # controller、service、mapper 三层目录骨架
    │   └── resources/
    │       ├── application.yml     # 数据源、迁移、Cookie 和跨域白名单
    │       ├── mapper/              # 后续 MyBatis XML
    │       └── db/
    │           ├── migration/      # Flyway V1，含失败补偿，已验证并执行
    │           └── rollback/       # 人工结构回退，不加入 Flyway 扫描
    └── test/java/                  # 仅供本地业务测试，Git 忽略
```

三层业务目录尚无源码，空目录不单独纳入 Git。实际功能开发时按业务域创建 `modules/<业务域>/controller`、`service`、`mapper` 等职责包。

## 公共约定

- HTTP JSON 响应使用 `Result<T>`，字段固定为 `code`、`message`、`data`，通过 `ok` 和 `error` 工厂方法创建。
- 成功码为 `0`，通用异常码由 `CommonErrorCode` 提供；业务域可通过 `ErrorCode` 扩展自己的错误码枚举。
- 可预期的业务失败抛出 `BusinessException`；参数校验、请求体解析和未捕获异常由 `GlobalExceptionHandler` 统一转换。
- Spring 请求异常保留原 HTTP 状态及必要响应头；参数类型转换失败使用通用提示，不返回原始输入和 Java 类型细节。
- 未捕获异常仅在服务端记录详细堆栈，客户端固定返回“系统内部错误”。

## 检查命令

在本目录的 PowerShell 执行：

```powershell
.\mvnw.cmd --version
.\mvnw.cmd -B -ntp verify
.\mvnw.cmd -B -ntp dependency:tree
.\mvnw.cmd spring-boot:run
```

macOS/Linux 使用 `sh ./mvnw` 替代 `.\mvnw.cmd`。项目不需要全局 Maven；首次解析需要能访问 Maven Central。需要网络代理的环境在个人 Maven `settings.xml` 中配置，可用 `-s <本地设置文件>` 指定，不提交个人代理或凭据。

`verify` 编译并打包应用；如果本地存在测试类，Maven 会按约定执行。`src/test/java/` 已从 Git 索引移除并整体忽略，新检出的仓库不包含这些测试类，不能把没有测试的构建成功写成测试通过。后续仅在实际业务功能开发或业务缺陷修复时编写本地测试，非业务工作使用实际启动、临时命令或临时脚本验证，不新增持久化框架测试类。

## 本地连接与联调

所有后端启动命令均在 `backend/` 执行。后端应用配置统一在 `src/main/resources/application.yml` 中显式填写：数据库 `localhost:3306/handcraft_trade_platform`、用户 `root`、密码 `123456`；不加载额外本地配置文件，不使用环境变量占位。

端口为 8080；数据库地址、账号密码、端口和 CORS 白名单如需调整，直接修改 `application.yml` 后重启。首次使用先由 MySQL 管理工具创建空数据库 `handcraft_trade_platform`，再运行 `./mvnw.cmd spring-boot:run`；Flyway 自动创建业务表和历史表，不插入测试账号或演示数据。普通重启会校验迁移，不重复建表。

- `GET /api/health`：公开框架连通检查，响应 `{"code":0,"message":"success","data":{"status":"UP"}}`；不检测 SMTP/OSS，也不保证持续数据库可用性。
- `GET /api/csrf`：公开返回 `data.headerName` 和 `data.token`，并建立 HttpSession；写请求必须携带同一 Cookie 和对应令牌头。
- 其他路径暂需认证，未登录返回 HTTP 401、`code=40100`；CSRF 或权限拒绝返回 HTTP 403、`code=40300`。尚未实现登录入口，不把框架连通当成业务权限已完成。

CORS 在 Spring Security 过滤链内处理，预检不需要登录，身份/权限失败响应仍包含可信来源的 CORS 响应头；未允许来源被拒绝。默认仅允许 `http://localhost:5173`、`http://127.0.0.1:5173` 及对应 4173 预览端口，允许 Cookie，不使用 `*`。前端不配 Vite 代理，Axios 直接访问后端；前后端须统一使用 `localhost` 或统一使用 `127.0.0.1`，否则 SameSite Cookie 无法按本地同站方式发送。增加来源或改端口须同步配置并重启。

## 验证范围

已有框架测试类保留在当前机器本地，不纳入版本库：启动上下文、统一响应、异常处理、Security/CORS/CSRF、数据库迁移与失败补偿。它们用于此前框架验证，不是业务测试。数据库测试需要额外独立环境，普通 `verify` 不会自动连接数据库执行它们；后续不为非业务工作继续增加此类文件。

框架或配置调整应至少构建后端、实际启动并请求 `/api/health`；跨域变更验证可信来源预检与 Cookie/CSRF 行为。涉及数据库结构时使用真实 MySQL 验证，不以空测试或 Mock 推断数据库行为。

## 数据库设计与迁移

- [数据库表结构](../docs/design/数据库表结构.md)：V1.5 MVP 的 27 张业务表，含字段、逐表索引、应用关联校验及事务异常回滚约定。
- [V1 建表迁移](src/main/resources/db/migration/V1__create_mvp_tables.sql)：MySQL 8.4，使用 Flyway 默认 `classpath:db/migration` 路径；没有外键、不插入演示数据。已在当前本地开发库执行，后续修改必须追加迁移版本。
- [人工结构回退](src/main/resources/db/rollback/V1__create_mvp_tables.rollback.sql)：只适用于未来确认可丢弃的初始化表；不属于自动迁移或 Flyway Undo，不能加入 `flyway.locations`。存在业务数据时使用补偿迁移或备份恢复。

MySQL DDL 隐式提交，整批建表不能靠 ROLLBACK 撤销。V1 使用临时初始化存储过程 `initialize_mvp_v1`：每次成功建表后登记表名，异常处理器执行 ROLLBACK，再逆序 DROP 本次已创建表，并 RESIGNAL 原错误；原有重名表不会登记或删除。需有 CREATE ROUTINE、ALTER ROUTINE、EXECUTE、CREATE 和 DROP 等权限。

这是结构补偿，不是多表原子事务。进程中断、连接断开、补偿自身失败时可能留表；失败也可能遗留初始化过程和 Flyway 失败历史。先核对本次残留，必要时人工清理，再决定 repair/重试；不自动 repair，不对整个库运行人工回退。成功后过程会删除。`initialize_mvp_v1` 为迁移保留名称，不用于业务过程。业务 DML 仍须按设计使用 Spring 事务。

2026-11-12 实际验证：Node/前端检查另见前端 README；后端启用 MySQL 8.4 集成测试执行 `clean verify`，20 项测试全部通过、无跳过。当前本地 MySQL 8.0.46 的空开发库启动迁移成功，27 张业务表及一张 Flyway 历史表已建立。业务事务、并发、SMTP、OSS 尚未验证。

## 后续开发边界

后端配置按用户要求集中在 `application.yml` 显式维护；SMTP、OSS 接入时也遵守此约定。建表使用真实迁移，不添加演示数据。新增业务功能时在对应业务域内补齐三层实现、接口校验和业务测试，不在公共层放置具体业务规则。
