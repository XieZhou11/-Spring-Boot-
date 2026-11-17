# T-009 报价对比与定标建单测试

- 日期：2026-11-16—2026-11-17
- 范围：[T-009](../development/tasks/T-009-quote-award.md)，已完成回归及独立审查整改。
- 环境：JDK21、缓存Maven3.9.15、随机隔离MySQL测试库、Spring HTTP/WebSocket、OSS协议接收器及真实私有OSS；不主动迁移开发库。后端测试源仅本地保留，不纳入Git。

## 已执行

| 验证 | 结果与覆盖 |
| --- | --- |
| 初始后端RED | 报价POST预期201、实际404，确认接口尚未实现。 |
| 初始浏览器RED | 创建并发布需求后找不到报价金额输入，确认缺失业务入口。 |
| 图片/口碑RED→GREEN | 最初5项中4失败：图片接口404、旧评分统计包含退款且为两位小数；实现后5/5通过。 |
| QuoteImageCloudTest | 显式`HANDCRAFT_TEST_REAL_OSS=1`，1/1通过：私有上传、签名读取字节一致、裸URL403、续签；删除本轮随机对象并验证不存在。 |
| QuoteAwardIntegrationTest首次整体验证 | 25项中10失败，0错误。撤回重算/到期扫描的无操作者日志误写USER，触发既有CHECK导致回滚；另已撤销认证者读取本人需求报价历史404。 |
| QuoteAwardIntegrationTest修复复测 | 25/25通过、0失败/错误/跳过。空操作者统一SYSTEM，本人历史按作者关系授权；覆盖金额工期边界、1/5/20并发额度、北京时间跨日、身份隐私、七天/24小时截止、幂等、定标与撤回/关闭竞争、建单及通知失败整笔回滚、地址快照、取消后沟通。 |
| 浏览器审查问题RED | 三项专项首次2失败/1通过：需求刷新503卸载未知提交表单、非当前创作者角色无法进入本人历史；多报价比较通过。随后主流程复现取消成功后被延迟旧GET覆盖为待付款。保留原行为断言并补充回归。 |
| 后端审查问题RED→GREEN | 11月17日三项均准确失败：关闭将已到期报价误标REQUEST_CLOSED、撤销认证后订单参考图404、STOCK订单被列出且取消500。修复后3/3通过、0失败/错误/跳过。图片用例同时验证未认证非参与者404、原有公开需求认证浏览者可读图片但不可读他人订单。 |
| 最终后端verify | 11月17日188项，0失败/错误，4项云端开关跳过，BUILD SUCCESS。其中报价事务27项、实际HTTP/WebSocket闭环1项、图片/口碑/关联会话9项、显式启用迁移5项均通过；生成最终JAR，耗时2分50秒。 |
| 最终报价浏览器专项 | 最终JAR下3/3通过，29.5秒：503刷新保留未知报价原文及同键重试、撤回重报、图片隐私、定标丢响应重试、地址快照、取消慢GET与路由竞争、取消后继续沟通、历史入口、比较排序与无评价。 |
| 全量浏览器回归 | `npm run test:e2e`：44/44通过，3.1分钟。账号、个人中心、入驻、作品、需求、导航、聊天及报价订单均通过；本地接收器不代表公网邮箱验收。 |
| 前端静态检查与构建 | `npm run lint`、`npm run build`（含`npm run type-check`）均退出0；1366px对比表、订单快照截图人工核对，关键流程保留端到端回归。 |
| 独立审查 | 重要事务、隐私和页面重试已独立审查；上述问题修正后定向复审无新增P1/P2。 |

后端使用缓存发行版`C:/Users/1/.m2/wrapper/dists/apache-maven-3.9.15/0226a00282e400185496f3b60ec5a3f029cbdc6893912937d4876d57695224e1/bin/mvn.cmd`，`JAVA_HOME=D:/JDK/jdk-21`、`MAVEN_OPTS=-Xms64m -Xmx256m`，命令参数`-DargLine=-Xms64m -Xmx384m -Dtest=QuoteAwardIntegrationTest test -B -ntp`。本机Wrapper脚本遇到PowerShell取值问题，改为调用已下载的同版本Maven；默认堆曾触发本机原生内存不足，低堆配置执行成功。

组合HTTP/图片/迁移/需求回归首次尝试仍遇到本机原生内存分配失败，JVM中断；该轮不作为业务通过结果。后续改为串行GC、限制测试上下文缓存并降低并发资源占用后复测，不跳过断言。

11月17日续测先遇到沙箱依赖访问限制；获准运行后发现Docker Desktop未启动，MySQL连接拒绝，测试上下文没有进入业务断言。恢复现有Docker及MySQL容器后继续使用随机隔离测试库；这些环境失败不计为业务RED或通过。

审查回归首轮复测2/3通过，图片最后一条误将已认证公开需求浏览者设为无权用户；按原需求规则改用未认证非参与者验证404，并增加认证浏览者图片200、他人订单404，未修改生产权限迁就测试。前端中间一次用例在第二次POST被网络钩子捕获前读取断言，改为等待两次请求后继续严格比较原请求体，不放宽等键重试要求。

最终后端命令使用`MAVEN_OPTS=-Xms48m -Xmx192m -XX:+UseSerialGC -XX:ActiveProcessorCount=2 -XX:ReservedCodeCacheSize=64m`，`-DargLine=-Xms64m -Xmx320m -XX:+UseSerialGC -XX:ActiveProcessorCount=2 -XX:ReservedCodeCacheSize=64m -Dspring.test.context.cache.maxSize=1 verify -B -ntp -l target/quote-award-final-verify.log`；显式设置`HANDCRAFT_TEST_MYSQL_URL=jdbc:mysql://localhost:3306/`及已授权测试账号，实际创建随机库。云端开关关闭的4项为入驻图、需求图、报价图、作品图；本任务报价图真实OSS另行1项通过，不计入本轮verify通过数。

浏览器在`frontend/`使用`HANDCRAFT_E2E_PORT=5181`、`JAVA_TOOL_OPTIONS=-Xms64m -Xmx320m -XX:+UseSerialGC -XX:ActiveProcessorCount=2 -XX:ReservedCodeCacheSize=64m`，专项命令`npm run test:e2e -- e2e/quote-award.spec.ts`；测试进程自行创建隔离库、本地SMTP和OSS协议接收器，不能将这些接收器视为公网邮箱或云端OSS验收。

## 验证边界与后续

本任务验收范围已完成。没有远端CI执行；没有执行开发库迁移或创建Git提交。后端测试源依约仅本地保留，新检出仓库不能直接复现相同用例数。支付、履约、退款、结算及现货交易不计入本次验收；后续可从已生成的CUSTOM/PENDING_PAY订单接入模拟支付。
