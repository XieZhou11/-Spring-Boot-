# 后端工程

已有账号、个人资料、头像、收货地址，以及创作者入驻、管理员审核、两级品类和系统通知接口。真实 SMTP 发送逻辑已接入，本机 QQ SMTP 连接与认证已验证，QQ/163 公网收件及找回密码补充验收用户明确暂缓；头像已完成真实 OSS 联调。认证页面见 [T-002](../docs/development/tasks/T-002-frontend-auth.md)，个人中心见 [T-003](../docs/development/tasks/T-003-personal-center.md)，入驻接口与联调结果见 [T-004](../docs/development/tasks/T-004-creator-onboarding.md)。作品发布、审核、检索及基础公开资料接口已完成，见 [T-005](../docs/development/tasks/T-005-work-publication.md)。

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
    │   │   └── modules/             # controller、service、serviceImpl、mapper、dto、vo、entity 等同级职责包
    │   └── resources/
    │       ├── application.yml     # 数据源、迁移、Cookie 和跨域白名单
    │       ├── mapper/              # 后续 MyBatis XML
    │       └── db/
    │           ├── migration/      # Flyway V1 建表、V2 申请幂等键、V3 作品请求键及版本
    │           └── rollback/       # 人工结构回退，不加入 Flyway 扫描
    └── test/java/                  # 仅供本地业务测试，Git 忽略
```

账号源码位于 `modules` 下直接创建的 `controller`、`service`、`serviceImpl`、`mapper`、`dto`、`vo`、`entity`、`security`、`exception` 同级职责包；不增加业务域层级。Controller → Service → Mapper 按三层组织，`service` 放接口，`serviceImpl` 放实现类，调用方注入 Service 接口，事务注解保留在实现方法上。

## 公共约定

- HTTP JSON 响应使用 `Result<T>`，字段固定为 `code`、`message`、`data`，通过 `ok` 和 `error` 工厂方法创建。
- 成功码为 `0`，通用异常码由 `CommonErrorCode` 提供；业务域可通过 `ErrorCode` 扩展自己的错误码枚举。
- 可预期的业务失败抛出 `BusinessException`；参数校验、请求体解析和未捕获异常由 `GlobalExceptionHandler` 统一转换。
- Spring 请求异常保留原 HTTP 状态及必要响应头；参数类型转换失败使用通用提示，不返回原始输入和 Java 类型细节。
- 未捕获异常仅在服务端记录异常类型及调用栈，移除可能包含敏感输入的原始异常消息，客户端固定返回“系统内部错误”。
- 请求使用以 `DTO` 结尾的普通 Java 类，标准 Jakarta 校验注解直接标在字段上，通过控制器 `@Valid` 触发，不另设自定义校验包。Entity、DTO 每个字段及 VO 返回字段均说明含义；校验失败 HTTP 400，`data.fieldErrors` 返回 `{field,message}` 列表，不包含原始输入；其他失败通常 `data=null`。全系统采用 RESTful 路径和 HTTP 方法。

## 排查日志

所有业务在 Service 实现层的关键节点记录中文日志，默认只输出到后端控制台。后续新增或修改业务均遵守根目录 [AGENTS.md](../AGENTS.md) 中的日志约定。代码或配置调整后须重启后端。

- `WARN`：业务失败、字段校验失败、请求体格式错误、未登录、CSRF/权限拒绝及凭证失效。按 `method`、`path`、`status`、`code`、`reason` 或 `fields` 定位；无路由模板的未知路径只显示固定标记，避免路径中输入泄露。
- `INFO`：注册、登录、当前会话查询、退出、验证码发送/核验及密码重置的关键过程和结果；按需要携带内部用户编号、发送请求键、截止时间，邮箱仅保留域名。注册和密码重置仅在事务提交后记录成功。
- `WARN/ERROR`：邮件配置缺失会指出配置项；发送失败按 `sendRequestKey` 区分预留事务失败、SMTP 认证失败、传输未知、被新请求替代及数据库回写失败，并提供经脱敏的异常类型与调用位置。

Service 失败日志会标明业务阶段，例如 `账号注册异常：stage=写入账号`、`密码重置失败：stage=校验验证码, code=40001`；验证码核验日志会区分未找到记录、发送未确认、已使用、过期和不匹配。登录在内部区分邮箱未注册与密码不匹配，前端仍返回原来的统一提示。全局异常处理器继续补充 HTTP 方法、路由与响应码，不能替代业务层日志。

例如 `请求处理失败：method=POST, path=/api/sessions, status=401, code=40101, reason=邮箱或密码错误`。日志不记录请求体、查询参数、Cookie、CSRF 令牌、密码、验证码或 SMTP 授权码；不通过开启 SMTP 协议调试或 SQL 参数输出排查登录问题。

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
- 公开写接口仅为注册、登录、发送验证码和找回密码，仍须 Cookie/CSRF；其他路径须认证。未登录返回 HTTP 401、`code=40100`；CSRF 或权限拒绝返回 HTTP 403、`code=40300`。

CORS 在 Spring Security 过滤链内处理，预检不需要登录，身份/权限失败响应仍包含可信来源的 CORS 响应头；未允许来源被拒绝。默认仅允许 `http://localhost:5173`、`http://127.0.0.1:5173` 及对应 4173 预览端口，允许 Cookie，不使用 `*`。前端不配 Vite 代理，Axios 直接访问后端；前后端须统一使用 `localhost` 或统一使用 `127.0.0.1`，否则 SameSite Cookie 无法按本地同站方式发送。增加来源或改端口须同步配置并重启。

## 验证范围

测试源码仅保留本地、不纳入 Git。当前本地账号集成用例会连接本机 MySQL 并创建随机独立测试库，测试后仅删除自己的测试库；不会读取或清空开发库。启动和安全回归同样使用独立库。迁移历史用例须显式设置其测试连接才执行，不能把跳过当通过。新检出的仓库无本地测试源码，不能复现相同用例数。

账号验证包含 MockMvc + MySQL 事务、并发与故障用例，以及真实 Tomcat HTTP + 本地 SMTP 协议闭环。测试邮件只进入测试接收端，不代表 QQ/163 公网实收；实际结果见 [T-001 测试记录](../docs/testing/T-001-backend-auth.md)。

框架或配置调整应至少构建后端、实际启动并请求 `/api/health`；跨域变更验证可信来源预检与 Cookie/CSRF 行为。涉及数据库结构时使用真实 MySQL 验证，不以空测试或 Mock 推断数据库行为。

## 数据库设计与迁移

- [数据库表结构](../docs/design/数据库表结构.md)：V1.5 MVP 的 27 张业务表，含字段、逐表索引、应用关联校验及事务异常回滚约定。
- [V1 建表迁移](src/main/resources/db/migration/V1__create_mvp_tables.sql)：MySQL 8.4，使用 Flyway 默认 `classpath:db/migration` 路径；没有外键、不插入演示数据。已在当前本地开发库执行，后续修改必须追加迁移版本。
- [人工结构回退](src/main/resources/db/rollback/V1__create_mvp_tables.rollback.sql)：只适用于未来确认可丢弃的初始化表；不属于自动迁移或 Flyway Undo，不能加入 `flyway.locations`。存在业务数据时使用补偿迁移或备份恢复。

MySQL DDL 隐式提交，整批建表不能靠 ROLLBACK 撤销。V1 使用临时初始化存储过程 `initialize_mvp_v1`：每次成功建表后登记表名，异常处理器执行 ROLLBACK，再逆序 DROP 本次已创建表，并 RESIGNAL 原错误；原有重名表不会登记或删除。需有 CREATE ROUTINE、ALTER ROUTINE、EXECUTE、CREATE 和 DROP 等权限。

这是结构补偿，不是多表原子事务。进程中断、连接断开、补偿自身失败时可能留表；失败也可能遗留初始化过程和 Flyway 失败历史。先核对本次残留，必要时人工清理，再决定 repair/重试；不自动 repair，不对整个库运行人工回退。成功后过程会删除。`initialize_mvp_v1` 为迁移保留名称，不用于业务过程。业务 DML 仍须按设计使用 Spring 事务。

2026-11-12 框架验证：Node/前端检查另见前端 README；后端启用 MySQL 8.4 集成测试执行 `clean verify`，20 项测试全部通过、无跳过。当前本地 MySQL 8.0.46 的空开发库启动迁移成功，27 张业务表及一张 Flyway 历史表已建立。此段为历史框架结果，账号业务验证见 T-001。

## 账号接口与邮件配置

接口、字段及错误码的维护入口是 [T-001](../docs/development/tasks/T-001-backend-auth.md)。注册时提交邮箱、验证码、密码、昵称，成功后另行登录。只支持 qq.com、163.com；邮箱去首尾空格并转小写，密码不去空格。注册与找回共用最新六位验证码，五分钟有效，重发立即失效旧码。

在 `application.yml` 的 `spring.mail` 中填写平台 QQ 发件邮箱及 SMTP 授权码；默认 `smtp.qq.com:465` 使用 SSL。`app.auth.verification-secret` 填至少 32 字节的随机密钥并保持稳定。密钥不入库，轮换会使现有验证码失效。真实授权码、邮箱及密钥仅留本地，不加入提交、示例或日志；不拆本地配置、不使用环境变量占位。缺少凭据或密钥时接口返回 HTTP 503、业务码 50301，不创建账号或伪装发送成功。

2026-11-13 本机检查：用户填写的 QQ SMTP 配置连接与认证成功；检查发现验证码密钥为空，已生成并保存在本地配置。检查只调用 `JavaMailSenderImpl.testConnection()`，未发送邮件，不能据此宣称 QQ/163 收件成功。真实收件结果继续维护在 [T-001 测试记录](../docs/testing/T-001-backend-auth.md)。

调用顺序：先 GET `/api/csrf`，保留 Cookie，并按返回的 headerName/token 发起写请求；登录会销毁旧会话并创建新会话，因此下一次写请求重新获取 CSRF。发送验证码成功只说明 SMTP 接受且状态保存成功，仍需在收件箱确认收信；超时、发送或保存未知时返回 50302，重新获取后用最新邮件的验证码。

会话 Cookie 为 HttpOnly、SameSite=Lax，七天保存；容器空闲超时七天，服务端另检查登录时固定的七天截止时间，多端登录互不挤出。应用重启须重新登录；退出仅撤销当前会话，密码重置撤销全部旧凭证，后续请求再次核对密码指纹。两种暂停标记均不禁止登录。系统通知 WebSocket 复用同一截止时间与指纹，在退出、重置、到期时断开旧连接。

## 个人资料、地址与头像

个人中心业务及接口入口见 [T-003](../docs/development/tasks/T-003-personal-center.md)。登录后通过首页的个人资料、收货地址入口使用；昵称、简介和地址使用真实 MySQL。资料更新不会改变密码或延长登录态；地址最多 10 条，首条自动默认，删除默认后选择剩余最新地址，归属、容量和默认切换在用户行锁事务中校验。当前尚无订单建单实现，地址快照随订单功能验收。

头像由后端校验实际 JPEG/PNG 和 2MiB 大小，上传至私有 OSS，再短事务绑定本人头像。数据库仅保存文件对象键，读取本人资料时签发 15 分钟访问 URL；成功替换保留旧文件，失败的新上传通过持久化补偿清理，不把外部网络调用放在长数据库事务中。

2026-11-13 已按用户提供的信息在本地 `application.yml` 配置北京地域私有 OSS，不使用空项、示例凭据或占位值。更换配置时维护 `app.oss` 下以下全部属性并重启后端：

| 属性 | 填写内容 |
| --- | --- |
| `app.oss.endpoint` | Bucket 所在地域的 OSS Endpoint（包含 HTTPS 协议） |
| `app.oss.region` | 与 Bucket 一致的签名地域名称 |
| `app.oss.bucket` | 已设为私有的 Bucket 名称 |
| `app.oss.access-key-id` | 具备该 Bucket 必要读写权限的访问密钥编号 |
| `app.oss.access-key-secret` | 对应访问密钥秘密，仅在本地保存 |

配置仍集中在 `application.yml`，不使用环境变量占位或额外 local 文件；真实密钥不加入 Git、前端或日志。缺少任一配置时应用仍可启动，上传明确返回 HTTP 503，昵称、简介和地址仍可保存；不会写入假文件或返回假上传成功。前端只呈现“头像上传暂时不可用”等用户提示。

本地协议测试验证 SDK、文件状态和失败补偿；另已使用隔离账号与真实北京 OSS 完成页面上传、刷新、替换、签名读取及匿名访问拒绝，并推进浏览器时钟触发续签。测试账号数据库及本轮上传对象均已清理，结果维护在 [T-003 测试记录](../docs/testing/T-003-personal-center.md)。

## 创作者入驻、审核与通知

完整接口与字段见 [T-004](../docs/development/tasks/T-004-creator-onboarding.md)。管理员账号由用户在开发库设置 `is_admin`，应用不创建默认管理员或内置密码。普通买家申请 1—3 个启用一级主品类、3—5 件原创作品；提交材料只读，撤回或驳回后重提新增记录，通过后姓名和收款资料只读。审核结论、账号资格、通知、操作记录在同一事务提交。品类提供两级新增、编辑、排序及停用，历史引用保留。

`app.security.payment-account-key` 须为 Base64 编码的 32 字节随机密钥，已在本地 `application.yml` 显式配置；不向日志或版本库输出。AES-256-GCM 密文包含版本、随机 nonce 和认证标签，并绑定用户编号。保留密钥才能解密历史收款账号；更换时须迁移已有密文，不能直接覆盖密钥。密钥缺失、错误或密文损坏明确返回 50332。

入驻图片与头像共用已配置的私有 OSS，实际解码 JPEG/PNG/WebP（WebP 使用 TwelveMonkeys 3.15.3），单张最大 5MiB。HTTP 单文件上限 5MB、请求上限 6MB；头像业务仍单独限制 2MiB。图片预留短事务后上传，失败对象持久化重试清理；超过 24 小时未被任何历史申请引用的临时图自动回收。所有历史申请图片保留，管理员仅能读取已引用材料；本人读取和管理员审核均返回 15 分钟签名。

`PUT /api/sessions/current/active-role` 仅切换本会话 BUYER/CREATOR 默认入口，保持登录截止时间；每次请求刷新最新资格。`/api/ws` 是原生 WebSocket，使用登录 Cookie 和与 HTTP 相同的 Origin 白名单，推送系统通知及未读数；通知先入库、提交后推送，断线后可分页补查。当前没有普通业务聊天。

测试记录见 [T-004 联调记录](../docs/testing/T-004-creator-onboarding.md)。

## 后续开发边界

后端配置按用户要求集中在 `application.yml` 显式维护；SMTP、OSS 接入时也遵守此约定。建表使用真实迁移，不添加演示数据。新增业务功能时在 `modules` 下对应职责包中补齐三层实现、接口校验和业务测试，不在公共层放置具体业务规则。

## 作品发布、审核与浏览（T-005）

接口、状态、版本与验收约定见 [T-005](../docs/development/tasks/T-005-work-publication.md)。新增 V3 为作品补齐创作者范围创建请求键及版本；已有 V1、V2 保持原样，启动时由 Flyway 追加迁移。所有浏览接口均要求登录；资格、归属、状态、额度和图片引用在服务端复核。图片使用独立 OSS 前缀，复用当前私有配置；无引用且超过 24 小时的临时作品图定时清理，草稿与历史引用继续保留。审核状态、通知、快照同事务写入，推送与成功日志在提交后执行。

本轮使用本地隔离 MySQL 验证 V1—V3、额度及审核竞争、事务回滚，另执行真实 HTTP 和真实 OSS；结果见 [测试记录](../docs/testing/T-005-work-publication.md)。QQ/163 公网收件及找回密码的补充验收为“用户明确暂缓”，保留已有实现。后端业务测试源码仍只在本地，重新检出没有相同测试用例；构建通过不能替代业务验证。
