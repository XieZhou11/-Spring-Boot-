# 后端工程

当前已建立可启动的 Spring Boot 应用基础、统一响应、业务异常、全局异常处理和三层目录骨架，尚未实现真实业务，也没有连接数据库、SMTP 或 OSS。

## 环境与依赖

- JDK 21；Maven Wrapper 固定 Maven 3.9.15，首次使用需联网下载。
- Spring Boot 4.1.2，统一管理 Spring、Security、Jackson、数据库驱动及测试依赖。
- MyBatis-Plus 3.5.18（Boot 4 starter 与分页 SQL 解析模块）、springdoc 3.2.0、阿里云 OSS SDK 3.18.5。
- 已导入 MVC、Security、Validation、WebSocket、Mail、Flyway/MySQL 及 MVC、安全、JDBC 测试依赖。HttpSession、BCrypt 与 Scheduling 使用 Spring/Tomcat 自带能力，无需额外组件。
- 数据库服务基线为 MySQL 8.4 LTS；驱动版本由 Boot BOM 管理，不等同于服务端版本。本轮不安装或配置数据库。

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
    │   │   └── modules/             # controller、service、mapper 三层目录骨架
    │   └── resources/
    │       ├── mapper/              # 后续 MyBatis XML
    │       └── db/
    │           ├── migration/      # Flyway V1 建表迁移，已写未执行
    │           └── rollback/       # 人工结构回退，不加入 Flyway 扫描
    └── test/java/com/handcraft/platform/
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

`verify` 会编译应用并执行当前公共框架测试。应用暂时排除数据源和 Flyway 自动配置，使基础框架在没有外部服务时可以启动；开始数据库功能开发时需移除排除项并提供实际连接配置。建表 SQL 已编写，尚未执行。

## 数据库设计与迁移

- [数据库表结构](../docs/design/数据库表结构.md)：V1.5 MVP 的 27 张业务表，含字段、逐表索引、应用关联校验及事务异常回滚约定。
- [V1 建表迁移](src/main/resources/db/migration/V1__create_mvp_tables.sql)：MySQL 8.4，使用 Flyway 默认 `classpath:db/migration` 路径；没有外键、不插入演示数据。本次只写 SQL，未连接数据库或执行迁移。
- [人工结构回退](src/main/resources/db/rollback/V1__create_mvp_tables.rollback.sql)：只适用于未来确认可丢弃的初始化表；不属于自动迁移或 Flyway Undo，不能加入 `flyway.locations`。存在业务数据时使用补偿迁移或备份恢复。

业务操作异常通过 Spring 事务回滚；MySQL DDL 隐式提交，整批建表不能靠 ROLLBACK 撤销。共享环境已执行成功的迁移不可改写，后续追加新版本。

## 后续开发边界

数据库、SMTP 与 OSS 凭据通过本地环境提供；建表使用真实迁移，不添加演示数据。新增业务功能时在对应业务域内补齐三层实现、接口校验和业务测试，不在公共层放置具体业务规则。
