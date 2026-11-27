# 本机演示环境

日常开发在主工作区从 IDE 启动，使用 `http://localhost:5173` 和 `http://localhost:8080/api`。演示使用独立目录里的前端构建、后端 JAR 和 `app.private.properties`。主工作区的 `application.yml`、`application-local.yml` 或当前检出的分支都可以按日常开发维护。演示脚本直接读取自己的文件，两套服务可以同时运行。

| 项目 | 日常开发 | 本机演示 |
| --- | --- | --- |
| 前端 | `http://localhost:5173` | `http://127.0.0.1:15173` |
| 后端 API | `http://localhost:8080/api` | `http://127.0.0.1:18080/api` |
| MySQL 库 | `handcraft_trade_platform` | `handcraft_trade_platform_test`，使用演示运行账号及迁移账号 |
| 图片 | 开发环境的阿里云 OSS | `http://127.0.0.1:19090`，地域 `cn-beijing`，桶 `craftflow-demo-local` |
| 邮件 | 开发环境的 SMTP | `127.0.0.1:19025` 本地邮件接收器 |

## 启动与停止

1. 确认本机 MySQL 已启动。打开 Windows 终端或 PowerShell，运行启动脚本。脚本会依次检查本机图片服务、后端和前端，最后输出演示网址。

   ```powershell
   $demoRoot = Join-Path $env:LOCALAPPDATA 'CraftFlowDemo\handcraft_trade_platform_test'
   & (Join-Path $demoRoot 'start-demo.ps1')
   ```

2. 打开 [演示前台](http://127.0.0.1:15173/) 或 [演示后台](http://127.0.0.1:15173/admin/dashboard)。演示账号和操作顺序在演示目录的 `DEMO.md`。端口检查可以分别打开 [后端健康检查](http://127.0.0.1:18080/api/health) 和 [图片服务健康检查](http://127.0.0.1:19090/health)。打开作品广场并查看一张封面，可确认浏览器实际读到了演示图片。

3. 演示结束后，在 PowerShell 中停止演示进程。

   ```powershell
   $demoRoot = Join-Path $env:LOCALAPPDATA 'CraftFlowDemo\handcraft_trade_platform_test'
   & (Join-Path $demoRoot 'stop-demo.ps1')
   ```

## 更新演示代码

`codex/demo` 固定用于演示的源码版本。日常开发继续在 `main` 或功能分支进行。需要演示新版时，将选定的代码更新到 `codex/demo`，合入公共改动时保留该分支的演示 `application.yml`。演示前端的 API 地址在构建时写入，后端启动脚本使用演示目录的 `app.private.properties`。两个构建产物都需要更新。

1. 在 `codex/demo` 的独立工作树中，用 Java 21 打包后端。运行 Maven 的目录是该工作树下的 `backend`。

   ```powershell
   .\mvnw.cmd -B -ntp -DskipTests package
   ```

2. 用 Node 24.22.2 和 npm 11.19.1 构建前端。运行命令的目录是同一工作树下的 `frontend`。

   ```powershell
   npm ci
   $env:VITE_API_BASE_URL = 'http://127.0.0.1:18080/api'
   try { npm run build } finally { Remove-Item Env:VITE_API_BASE_URL }
   ```

3. 先在演示目录备份上一版的 JAR 和 `dist`，然后运行 `stop-demo.ps1`。把新 JAR 放到 `source/backend/target/handcraft-platform-0.0.1-SNAPSHOT.jar`，把 `source/frontend/dist` 整体换成新构建。`start-demo.ps1` 使用 `source/frontend/node_modules` 的 Vite。若前端依赖锁文件变化，同步 `package.json` 和 `package-lock.json`，在 `source/frontend` 执行 `npm ci`。
4. 运行 `start-demo.ps1`，打开前台，确认图片、登录和本次要展示的页面。演示库迁移由演示后端启动执行。若新版未改变数据库结构，可以用备份的前后端产物恢复上一版。

## 演示文件与故障排查

- `$env:LOCALAPPDATA\CraftFlowDemo\handcraft_trade_platform_test\app.private.properties` 保存演示专用连接配置和密钥，作为本机文件管理。演示收款资料继续使用建库时的加密密钥。
- 同目录下的 `objects` 保存实际图片内容和元数据。MySQL 保存作品、订单及图片的对象键。备份演示环境时，将数据库、`objects` 和私有配置一起保留。
- 如果脚本报端口被占用，先检查 `15173`、`18080`、`19090`、`19025` 的现有进程。正常运行的演示环境可以直接打开首页，更新构建时先用 `stop-demo.ps1` 停止。
- 如果作品能列出但图片打不开，先检查 `19090/health`，再核对演示库与 `craftflow-demo-local` 的配置是否成套使用。脚本启动日志在演示目录下的 `logs`。
