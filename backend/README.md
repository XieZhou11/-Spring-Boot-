# 后端工程骨架

本轮只建立依赖、构建和目录，没有编写任何 Java 类、应用配置或 SQL。当前不能启动后端，也没有连接数据库、SMTP 或 OSS。

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
    │   │   ├── common/              # 后续跨域公共能力
    │   │   └── modules/             # 后续按具体业务域建包
    │   └── resources/
    │       ├── mapper/              # 后续 MyBatis XML
    │       └── db/migration/        # 后续 Flyway 迁移
    └── test/java/com/handcraft/platform/
```

空目录只有 `.gitkeep`，资源打包排除这些占位文件。后续在 `modules/<业务域>/` 内按实际需要建立 controller、service、mapper、entity、dto 等职责包，不提前创建大量空业务模块。

## 检查命令

在本目录的 PowerShell 执行：

```powershell
.\mvnw.cmd --version
.\mvnw.cmd -B -ntp verify
.\mvnw.cmd -B -ntp dependency:tree
```

macOS/Linux 使用 `sh ./mvnw` 替代 `.\mvnw.cmd`。项目不需要全局 Maven；首次解析需要能访问 Maven Central。需要网络代理的环境在个人 Maven `settings.xml` 中配置，可用 `-s <本地设置文件>` 指定，不提交个人代理或凭据。

`verify` 检查工程与依赖构建。当前没有 Java 源码和测试，Maven 会报告无源码、无测试；不能据此宣称业务测试通过。由于没有启动类，POM 暂设 `spring-boot-maven-plugin.skip=true`，产物是普通骨架 JAR，不能 `java -jar` 启动；没有跳过测试阶段。

## 后续启动条件

下一任务明确实现基础应用后，再添加 `com.handcraft.platform` 下的启动类、实际环境配置和验证，移除上述重打包 `skip` 设置。数据库、SMTP 与 OSS 凭据通过本地环境提供；建表使用真实迁移，不添加演示数据。当前不提供会失败或误导的启动命令。
