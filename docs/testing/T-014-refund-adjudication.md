# T-014 普通售后与管理员退款裁定测试记录

- 日期：2026-11-19
- 任务：[T-014](../development/tasks/T-014-refund-adjudication.md)
- 状态：已通过，最终后端完整verify、真实OSS、前端检查及全量浏览器完成；结算扫描竞争按任务边界留待结算实施。

## 失败先行

- 核心 `./mvnw.cmd -B -ntp -Dtest=OrderRefundIntegrationTest -Dspring.test.context.cache.maxSize=4 test`：4项按预期失败、0错误，申请/补证资源尚不存在（HTTP404）；覆盖申请幂等/撤回、补证版本、原完成七天及已发货恢复期限。首次未引用点号JVM参数导致Maven解析失败，纠正命令后才计入上述有效RED。
- 管理员 `AdminRefundIntegrationTest#adminQueueRequiresIndependentAdminPermission`：1项按预期失败，普通参与者访问新后台接口预期403、实际404（资源未实现）。随机隔离库迁移至V7，开发库未操作。

## 实际验证与复测

- 首次联合专项：`./mvnw.cmd -B -ntp -Dtest=OrderRefundIntegrationTest,AdminRefundIntegrationTest,RefundConcurrencyIntegrationTest,OrderFulfillmentIntegrationTest,OrderImageAndNodeChatIntegrationTest,DatabaseMigrationTest -Dspring.test.context.cache.maxSize=4 test`，76项、3失败、1错误、0跳过。启用真实MySQL迁移专项；测试上下文缓存上限4。
- 两项失败同源：相同管理员/版本/裁定输入在终局重试返回409；JSON树序列化前的Long节点与数据库JSON解析后的Int节点深比较不等。修复为统一序列化/解析后比较，保留全部输入和操作者校验。
- 另一项为旧退款图片上传断言仍采用T-013仅未开工规则，新普通申请阶段允许买家上传，更新对应行为断言并增加阶段/双方边界；没有放宽用途及归属限制。
- 错误为跨单请求键测试克隆CUSTOM订单夹具缺quote_id，触发既有订单来源CHECK；修正为匹配需求和报价的真实来源，不修改数据库约束或业务断言。
- 该轮其余竞争和原子失败注入已执行：重复申请、补证/裁定、双管理员、撤回/裁定、申请/开工与自动收货竞争；退款流水、申请、订单、需求、结算、历史和双方通知故障回滚。修正复测结果见下。
- 修正联合复测：AdminRefundIntegrationTest 10、AdminRefundImageIntegrationTest 4、OrderFulfillmentIntegrationTest 20、OrderImageAndNodeChatIntegrationTest 9、RefundConcurrencyIntegrationTest 14，共57/57通过；随后OrderRefundIntegrationTest 16/16通过，共73项、0失败/错误/跳过。补充纯图/500字及3图边界、暂停旧单权限、跨对象原键、排他游标、管理员仅相关私图和不写已读等验证。
- 真实OSS首轮2项中1失败（新补证云端签名GET400），原订单云端回归1项通过。新测试复用了固定业务时钟，生成的签名相对真实云端已过期；去掉云端夹具的固定时钟、保留业务/权限断言后，`HANDCRAFT_TEST_REAL_OSS=1`运行RefundImageCloudIntegrationTest及OrderImageCloudTest，2/2通过。包含真实买家上传、卖方纯图补证、上下文管理员签名、匿名直链403、撤回后历史读取、临时图清理和凭证保留；仅删除本轮自己上传的对象。
- 独立后端审查未发现阻断缺陷；前端审查确认管理员多于3张引用的恢复、同账号撤权清理、ALL筛选参数及退货切换隐藏字段4处问题，均已修复并增加对应回归，不以静态审查代替测试。
- 后端完整`verify`：307项、0失败/错误、7项真实云端条件跳过（实际执行300项），BUILD SUCCESS，3分51秒。V1—V7迁移专项7项实际执行。为保留开发服务占用的标准JAR，仅临时复制正式POM增加`build.finalName=handcraft-platform-t014-verify`后运行`./mvnw.cmd -B -ntp -f .t014-verification-pom.xml -Dspring.test.context.cache.maxSize=4 verify`；验证后删除临时POM，正式POM不改。产物`backend/target/handcraft-platform-t014-verify.jar`用于后续隔离浏览器。
- 前端上述4项定向独立复审逐项ADDRESSED；修复空运单号发送空字符串触发后端Pattern校验的问题（发送时规范化为null），以及相同订单通知刷新错误重置草稿的问题。受控网络恢复及交互专项最终11/11通过（21.5秒），涵盖原键重试、精确核验、草稿保留、版本冲突重阅、他人退款不误认、双方存储失败、筛选/乱序、退回分支、4张凭证恢复、同账号撤权及旧订单GET隔离。早期测试误用过宽的`**/api/**`拦截，连前端源码模块也被误拦；修为精确后端URL，该失败不计有效业务RED。
- 在完整verify后新增4项真实MySQL并发边界：申请与第五节点原子发货、申请与手动收货、相同补证键并发只增加一次版本、普通申请跨48小时保持原类型且撤回后可走原无责入口。`./mvnw.cmd -B -ntp -Dtest=RefundConcurrencyIntegrationTest -Dspring.test.context.cache.maxSize=4 test`，18/18通过（33.3秒），包含原14项。
- 最终后端补齐3个参与方只读查询的中文业务日志，再以同样临时POM方式运行完整`verify`：311项、0失败/错误、7项真实云端条件跳过（实际执行304项），BUILD SUCCESS（4分44秒），迁移专项7项实际执行。命令为`./mvnw.cmd -B -ntp -f .t014-final-verification-pom.xml -Dspring.test.context.cache.maxSize=4 verify`，仅临时设置`finalName=handcraft-platform-t014-final-verify`，完成后临时POM已删除；正式POM及开发服务未修改。日志`backend/target/t014-final-verify.log`。
- 真实浏览器专项：`npm run test:e2e -- e2e/order-refund-flow.spec.ts --output=test-results/refund-flow`，4/4通过（35.3秒）。覆盖已付款图文/纯图与500字/3图、补证双方刷新、发货后驳回/撤回顺延、已完成原窗口、私图及聊天不改已读、版本冲突、退回确认或免退依据、裁定成功响应丢失后精确核验及取消待结算。收集阶段曾将worker级storageMode放在describe中，移至文件顶层；真实首轮3/4中一项因第三次申请POST未完成就读旧订单而失败，按trace增加售后状态完成等待后4/4通过，生产代码未作迁就。
- 全量浏览器：`npm run test:e2e -- --output=test-results/t014-all`，81/81通过（5.9分钟）。使用15184/18184隔离端口、T-014独立JAR、随机MySQL库、真实HTTP/WebSocket与OSS协议接收器，覆盖原66项及新增15项；测试进程和随机库由夹具清理，开发服务未操作。追加真实流程1/1通过（30.5秒）生成买家截图；实际查看买家售后历史、管理员双栏证据/结论的1366×1000截图，未见溢出，私图正常。
- 收尾检查发现管理员终结申请后，对方已打开的补证草稿仍可编辑/上传（正式POST已有资格保护）。新增浏览器断言先复现textarea未禁用的有效RED；最小修复为保留草稿但按最新资格冻结字段、上传和提交，仍可关闭或进入原会话，复测通过。未用清空草稿规避问题。
- 最终受控专项：`playwright test e2e/order-refund.spec.ts e2e/order-refund-pagination.spec.ts --reporter=line --output=test-results/refund-recovery-review`，5197隔离前端，16/16通过（28.7秒）。完整保留原11项，新增终态草稿、补证未知结果按提交者原键核验、撤回响应丢失，以及双方/后台证据排他游标、只读聊天before分页、队列页码和返回筛选保留。新增分页代码及终态修复独立复审未发现阻断问题。
- 最终`npm run lint`、`npm run build`（含完整type-check及1082模块Vite构建）通过；新增真实流程的单文件ESLint及`tsc --noEmit -p tsconfig.node.json`亦退出0。
- 最终全量：`npm run test:e2e -- --output=test-results/t014-final-all`，86/86通过（5.9分钟、退出0），使用最终`handcraft-platform-t014-final-verify.jar`及15184/18184，包含原66项、受控16项和真实售后4项。`.last-run.json`为passed、失败列表为空；日志位于`frontend/test-results/t014-final-all/backend-chromium.log`，最终买家截图已查看。隔离服务退出后两端口监听数为0；未修改开发服务。

## 验证边界

测试使用随机隔离MySQL库，仅清理各自测试库；后端测试源码按约定仅本地保留。真实OSS结果与协议接收器分别记录；完整verify的7项真实云端条件跳过不计通过，本任务订单/退款云端已另行2/2验证，其他历史云端结果见原任务。真实结算扫描尚未实现，与退款双向并发留待结算任务；未以当前用例替代。未主动迁移用户开发库，未创建Git提交。
