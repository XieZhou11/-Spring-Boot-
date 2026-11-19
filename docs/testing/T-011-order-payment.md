# T-011 定制订单模拟支付与支付后初始化测试

- 日期：2026-11-17
- 关联任务：[T-011](../development/tasks/T-011-order-payment.md)
- 环境：JDK21、Maven3.9.15、随机隔离MySQL、真实HTTP/Cookie/CSRF/WebSocket及本地SMTP/OSS协议接收器。后端测试源仅本地保留，不纳入Git；不操作开发库或真实支付渠道。

| 测试项与命令或操作 | 结果 | 必要说明 |
| --- | --- | --- |
| 后端关键RED：`OrderPaymentIntegrationTest#paymentPersistsOneAtomicFinancialAndFulfilmentResult` | 失败，符合预期 | 已实际运行1项，预期201、实际404，确认支付入口缺失。初次沙箱依赖访问失败未计入业务RED。 |
| 浏览器关键RED | 失败，符合预期 | 真实注册、认证、需求、报价及定标完成后，订单详情没有“模拟支付”入口。夹具最初期望日期低于原有7天限制，修正为有效数据后才验证缺失入口。失败后worker清理未结束，终止所属测试进程，该轮不作为通过结果。 |
| 首轮支付集成：`-Dtest=OrderPaymentIntegrationTest test` | 通过 | 5项，0失败/错误/跳过。覆盖支付初始化、已有成功结果优先重试、精确截止及扫描、日期/条款冲突、权限与字段隐私。 |
| 锁后关联校验RED→GREEN | 失败后修复通过 | 原需求买家错位时预期409、实际201；补关联一致性校验后，扩展17项集成通过，0失败/错误/跳过，19.41秒。 |
| 首轮真实HTTP/WebSocket：`-Dtest=OrderPaymentHttpFlowTest test` | 失败 | 3项中2项断言失败、1项通过：创作者列表误用默认BUYER侧，管理员非参与者按资源隐私返回404而非预期403。通知插入失败后的全量回滚与重试已通过；修正夹具后继续复测。之前的编译中断未执行用例，不计为业务RED。 |
| HTTP/WebSocket修正复测：`-Dtest=OrderPaymentHttpFlowTest test` | 通过 | 3项，0失败/错误/跳过，19.45秒。创作者明确查询CREATOR侧；买家提权管理员后拒付403。覆盖真实发布→报价→定标→支付、三端通知同编号、通知到达时独立连接读取完整已提交状态、离线通知、幂等200无重复流水或推送、双方隐私、PAID会话及付款后图文沟通。通知故障500整笔回滚，原参数重试201。 |
| 前端`npm run type-check`、`npm run lint`、`npm run build` | 通过 | 首轮及审查修复后均实际执行退出0。 |
| 独立静态审查 | 发现2项P2，已修复 | 存储写入异常发生在try外导致页面永久提交中；无成功流水的CANCELLED投影过早清除未知记录。另要求补订单/需求UPDATE、第2—5节点和第二条通知写入失败，并新增真实跨截止提交竞态验证。 |
| 完整后端verify | 通过 | 209项，0失败/错误，4项云端开关跳过，BUILD SUCCESS，2分55秒。支付集成18项、HTTP/WebSocket3项、迁移5项均通过，并生成最新JAR。新增故障点及跨截止竞态已实际验证。 |
| 审查问题浏览器RED：`npm run test:e2e -- e2e/order-payment.spec.ts --grep '已取消投影\|存储异常'` | 失败，符合预期 | 新JAR下2项均失败，测试进程正常结束。CANCELLED投影后未知提示消失；Storage SecurityError从事件处理器未捕获抛出、未显示错误且停留提交中。保持断言，修复后复测。 |
| 最终付款浏览器专项：`npm run test:e2e -- e2e/order-payment.spec.ts` | 通过 | 7/7，44.5秒。真实支付与双方订单/需求/会话同步；真实成功丢响应、核验503及刷新恢复；双端同流水、延迟旧GET；原参数重试、订单/账号隔离；取消投影保留核验；存储SecurityError/QuotaExceededError不发PUT且恢复操作、清理失败不阻退出；401/403/404清除详情、重试及确认存储。 |
| 全量浏览器回归：`npm run test:e2e` | 通过 | 51/51，2.6分钟。账号、个人中心、入驻、作品、需求、导航、聊天、报价订单及本次付款全部通过。支付后全页截图已目视核对，流水、最终日期、五个未开始节点及买家地址快照显示正常。 |
| 独立复审 | 通过 | 后端12处回滚注入及跨截止竞态已补齐；前端两项P2及权限清理闭环，未发现剩余P1/P2。复审只读，实际测试结果以上述执行为据。 |

支付集成实际覆盖：截止前1毫秒、精确截止、亚毫秒截断、锁等待跨截止、北京午夜重确认，3/180天与跨年计划；并发双付、付款/取消/扫描互斥；双方暂停、品类停用、原作品下架及报价到期不影响旧单；成交和收款快照、错归属/损坏密文503、关联一致性及RR详情/列表快照。12个真实MySQL故障点包括5类INSERT、订单和需求UPDATE、第2—5节点及创作者第二条通知，全部回滚且不误记成功日志。另以触发器和真实外部行锁阻塞已通过截止校验的付款，GET跨截止只投影取消，释放后原付款仍可提交PAID，确认前端需保留未知记录。

本机`.\mvnw.cmd -B -ntp ... verify`在Wrapper初始化时失败：PowerShell `Cannot index into a null array`，尚未运行Maven。后续使用Wrapper已缓存的同版本Maven3.9.15发行版执行完整verify；沙箱内缓存/依赖访问受限时以获准权限执行。测试JVM使用320MB堆、SerialGC、两个处理器及单个Spring上下文缓存，减少本机资源竞争。原始输出在本地工程生成目录，未写入版本库。

完整后端使用参数`-B -ntp -DargLine="-Xms64m -Xmx320m -XX:+UseSerialGC -XX:ActiveProcessorCount=2 -XX:ReservedCodeCacheSize=64m" -Dspring.test.context.cache.maxSize=1 -l target/payment-final-verify.log verify`，显式启用隔离MySQL迁移测试；Maven进程使用192MB堆及相同GC/处理器限制。4项跳过为需要独立云端开关的图片测试，本次未新增云端图片能力，未开启真实OSS验证。

浏览器使用`HANDCRAFT_E2E_PORT=5181`及相同320MB测试Java参数，测试夹具自行启动18080后端、随机隔离库、本地SMTP和OSS协议接收器。取消投影的页面测试注入先前快照，支付201及幂等重试200均为真实后端；对应真实未提交事务跨截止的基础竞态由MySQL集成第18项验证。

本任务验收完成，仅到PAID初始化。未执行开发库迁移、真实支付、远端CI或Git提交。公网邮箱补充验收仍按用户决定暂缓，协议接收器不代表公网或云端验收。完整履约、退款和结算执行继续作为后续任务。
