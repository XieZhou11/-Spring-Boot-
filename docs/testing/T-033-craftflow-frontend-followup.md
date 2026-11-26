# T-033 CraftFlow 前端审查问题修复测试记录

关联 [T-033](../development/tasks/T-033-craftflow-frontend-followup.md) 和 [问题清单](<../development/CraftFlow 前端后续问题清单.md>)。2026-11-26 使用 Node 24.22.2、npm 11.19.1、Edge 和 Chrome 验收。故障和竞态通过 Playwright 控制响应与时序。最终集成联验使用独立的 MySQL 8.4 临时容器、测试邮件接收器和本地存储接收器。布局以 1366 CSS 像素为基准，按条目补测矮窗与窄窗。

## 待修复问题

| 清单条目 | 验收操作与预期 | 实际结果与证据 |
| --- | --- | --- |
| R2 会话核验 | 登录后点击「我的订单」，会话查询返回 503。应留在广场并保存输入。恢复后应进入订单。冷启动时身份未知应只显示提示，真实 401 应回登录。 | 通过。核验失败时关键词保留，重试进入 `/orders`。冷启动无订单内容，401 回跳保留查询和锚点。真实注册登录后的连续故障重试也通过。 [路由用例](../../frontend/e2e/frontend-routing-followup.spec.ts) · [认证用例](../../frontend/e2e/auth.spec.ts) |
| R4 懒加载 | 生产预览阻断首页或订单组件模块。首访和站内点击均应提示，可主动重试。 | 通过。Edge、Chrome 各复测两种故障，持续阻断时一次点击只触发一次重载，解除阻断后恢复原地址和锚点。 |
| I4 入驻草稿 | 买家在 `/account/creator-certification` 输入姓名并上传一张测试图，分别取消站内跳转、浏览器刷新和关闭标签页，最后确认离开。 | 通过。取消三种离页操作后姓名和图片预览仍在，确认后进入 `/account/profile`。 [交互用例](../../frontend/e2e/frontend-audit-interactions.spec.ts) |
| I5 交易字段 | 已上架作品输入售价 0，再改为 20.00。 | 通过。非法值未写入，成功后不再显示旧错误，展示内容草稿仍保留。 [交互用例](../../frontend/e2e/frontend-audit-interactions.spec.ts) |
| R1 滚动恢复 | 广场滚到第 18 件作品进入详情，后退时延迟作品查询。另直接打开 `/#discover`。 | 通过。列表渲染后恢复原位置，直接打开时结果区位于页头下方。 [布局用例](../../frontend/e2e/frontend-layout-followup.spec.ts) |
| R5、R6 无效链接及编号 | 直接输入未知路径、非法或超上限编号，另从已打开的作品详情站内切到非法编号。 | 通过。对应错误页保留地址与返回入口，未向作品详情接口发送非法编号。兼容书签与登录回跳按认证回归。 [路由用例](../../frontend/e2e/frontend-routing-followup.spec.ts) |
| R7 定向邀约 | 受邀创作者从系统通知查看需求。 | 通过。详情使用工作台布局，链接返回收到的邀约。既有业务复测覆盖邀约、定标及关闭通知。 [来路用例](../../frontend/e2e/frontend-list-navigation.spec.ts) |
| I2 页面激活 | 在订单详情展开第二批证据，同次派发焦点和可见性事件，再模拟详情请求在途时的较迟焦点。 | 通过。同次三类 GET 各发一次，旧版重现时各发两次。在途详情没有重复读取，已展开证据继续显示。真实售后分页与后台只读会话游标回归通过。 [售后激活用例](../../frontend/e2e/order-refund.spec.ts) · [售后分页](../../frontend/e2e/order-refund-pagination.spec.ts) |
| I10 广场失败重试 | 已应用关键词和第 2 页，返回 503 后改填新关键词并重试。 | 通过。重放原关键词和页码，未应用输入保留，错误时旧结果和分页隐藏。 [列表用例](../../frontend/e2e/frontend-list-navigation.spec.ts) |
| L5 分页名称 | 用超过一页的需求检查导航角色及名称。 | 通过。需求导航显示「需求分页」，已统一各业务分页的名称参数。 [布局用例](../../frontend/e2e/frontend-layout-followup.spec.ts) |
| 退出提示遮挡 | 1366×768 下模拟前台退出返回 503，关闭提示后再次退出。 | 通过。提示随布局显示并可关闭，焦点返回原按钮，重试成功进入登录。 [布局用例](../../frontend/e2e/frontend-layout-followup.spec.ts) |

## 边界修复与可选优化

| 清单条目 | 验收操作与预期 | 实际结果与证据 |
| --- | --- | --- |
| I3 签名续期 | 分别模拟非法与合法时间，推进时钟，观察图片请求，再离开页面。 | 通过。非法时间无快速连续 GET，可手动恢复。合法签名如期续签，卸载后停止。 [图片用例](../../frontend/e2e/frontend-layout-followup.spec.ts) |
| I6 入驻审核历史 | 管理员打开 `/admin/creator-applications/11`，上次申请读取返回 404，重试再返回 403，第三次恢复 200。 | 通过。两次失败时均禁用通过和驳回，重试成功后保留意见并解锁裁定。 [交互用例](../../frontend/e2e/frontend-audit-interactions.spec.ts) |
| I7 验证码 | 发信在途时切换邮箱再切回。真实隔离 SMTP 重发并尝试旧码。 | 通过。迟到提示不串邮箱，旧码被拒。发送未知或失败如实反馈，沿用现有发信规则。 [交互用例](../../frontend/e2e/frontend-audit-interactions.spec.ts) · [认证用例](../../frontend/e2e/auth.spec.ts) |
| R3 认证后续接 | 未认证账号访问带查询和锚点的大厅。授权生效后刷新，并验证异账号与外部来路。 | 通过。同一账号可续接完整地址，成功后消费目标。另一账号及外部目标不显示续接。 [路由用例](../../frontend/e2e/frontend-routing-followup.spec.ts) |
| I8 六类列表 | 从带第 2 页的 URL 打开六类列表并刷新，另外覆盖末页缩减和会话返回。 | 通过。保留页码、已应用状态和独立的详情选择。页码超界回到有效末页。 [列表用例](../../frontend/e2e/frontend-list-navigation.spec.ts) |
| I9 订单原需求 | 从有筛选的需求列表进入定标，打开订单内「查看原需求」。 | 通过。需求来路保留筛选和页码。订单列表入口继续恢复订单参数。既有定标未知结果和原键重试用例通过。 [列表用例](../../frontend/e2e/frontend-list-navigation.spec.ts) · [定标回归](../../frontend/e2e/quote-award.spec.ts) |
| I1 操作确认 | 买家取消未付款订单，在确认框分别按取消和确认。 | 通过。取消写请求为 0，确认写请求为 1，焦点恢复。真实业务还覆盖退款、审核、下架、撤回。 [交互用例](../../frontend/e2e/frontend-audit-interactions.spec.ts) |
| L1 局部旧样式 | 打开报价图片，检查表面样式、图片完整性与关闭、返回时焦点。 | 通过。采用现有 CraftFlow 样式，大图完整适配，Esc 可关闭且焦点回原控件。 [布局用例](../../frontend/e2e/frontend-layout-followup.spec.ts) |
| L2 窄窗报价锚点 | 创作者直接打开长详情 `/requests/1?returnTo=%2Frequests#quotes`，分别在 600、760、1024、1366 和 1440px 宽度检查页头位置。买家在 1366×768 的 `/requests/1/quotes` 选择报价。 | 通过。Edge 和 Chrome 均验证报价标题和首个金额输入框完整位于页头下方且在视口内。定标确认标题和收货地址选择器也完整可见。 [布局用例](../../frontend/e2e/frontend-layout-followup.spec.ts) |
| 补证文件校验 | 选择超限及错误类型图片，检查是否上传。切换同一评价的两条举报。 | 通过。不合规文件上传请求为 0。合法附件保留且只属于所选举报。 [列表用例](../../frontend/e2e/frontend-list-navigation.spec.ts) |
| 地址和品类草稿 | 在 `/account/addresses` 编辑收件人后尝试进入个人资料，再点击编辑区的「取消」。在 `/admin/categories` 修改品类后按 Esc。在放弃提示中取消。 | 通过。取消跳转后保留原地址和输入，取消关闭后编辑器与已改字段仍在。地址删除和品类维护的既有流程回归通过。 [交互用例](../../frontend/e2e/frontend-audit-interactions.spec.ts) |

## 回归检查

| 清单条目 | 操作与实际结果 | 结果 |
| --- | --- | --- |
| 广场普通翻页 | 从页底点击下一页可见新页顶部，浏览器后退独立恢复历史位置。 [布局用例](../../frontend/e2e/frontend-layout-followup.spec.ts) | 通过 |
| 广场旧结果 | 第 2 页读取 503 时旧卡片和分页隐藏。 [列表用例](../../frontend/e2e/frontend-list-navigation.spec.ts) | 通过 |
| I11 双身份资格 | 普通买家受拦截，已认证账号可访问创作者入口，实际身份切换保有默认入口。 [入驻回归](../../frontend/e2e/creator-onboarding.spec.ts) · [定标回归](../../frontend/e2e/quote-award.spec.ts) | 通过 |
| 订单公开授权定位 | 买家在 1366、1024、760、600px 直接打开 `/orders/1#publication-consent` 或点击订单内授权链接，标题可见且区块聚焦。直接打开 `/orders/1#progress-9` 也聚焦到对应进度，标题完整可见。 [布局用例](../../frontend/e2e/frontend-layout-followup.spec.ts) | 通过 |
| L3 认证布局 | 1366×768 三页位置一致。1366×540 遇到错误可以键盘到达提交。 [布局用例](../../frontend/e2e/frontend-layout-followup.spec.ts) | 通过 |
| L4 管理员分区 | 后台入口及角色分工回归，普通用户个人中心入口保留。 [导航回归](../../frontend/e2e/navigation-layout.spec.ts) · [后台通知](../../frontend/e2e/admin-notifications.spec.ts) | 通过 |
| L5 已有分页名称 | 多页订单、通知及相关列表使用对应业务名称。 [列表用例](../../frontend/e2e/frontend-list-navigation.spec.ts) · [布局用例](../../frontend/e2e/frontend-layout-followup.spec.ts) | 通过 |
| 网格、焦点、窄窗需求 | 复测作品网格在 1366、1000、901、900px 的布局、键盘品类及分页，760px 需求详情返回恢复条件。 [布局用例](../../frontend/e2e/frontend-layout-followup.spec.ts) | 通过 |
| 空报价 | 买家打开 `/requests/15/quotes`，对比接口返回空列表。显示「暂无有效报价」，页面不出现对比表、最低价、最短工期或 `Infinity`。非空时两类标记由真实定标用例核对。 [空报价回归](../../frontend/e2e/frontend-list-navigation.spec.ts) · [定标回归](../../frontend/e2e/quote-award.spec.ts) | 通过 |
| 举报基线查询 | 举报人从 `/me/reports` 打开待处理的举报，填写补证并附图。主动阻断一次 `GET /api/reports/:id`，保留文字和预览图，`POST /api/reports/:id/evidence` 为 0。恢复后使用原草稿提交，写请求为 1，页面显示提交成功与新增材料。 [举报回归](../../frontend/e2e/content-report.spec.ts) | 通过 |
| 无障碍说明 | 在 `/works/1` 与 `/messages/notifications` 提供测试计数。Edge、Chrome 的无障碍树分别确认按钮「点赞 点赞数 12」、按钮「收藏 收藏数 8」和链接「系统通知 3 条未读」。业务用例还核对点赞、收藏后按钮名称与可见计数同步更新。按用户更新的验收口径，以浏览器 E2E 为准。 [布局用例](../../frontend/e2e/frontend-layout-followup.spec.ts) · [互动回归](../../frontend/e2e/work-interactions.spec.ts) | 通过 |

## 命令与复测

- 从当前源码复制干净的临时前端目录，顺序执行标准 `npm run type-check`、`npm run lint`、`npm run build`，均通过。原工作目录有旧 Vite 测试缓存。
- 较早的真实接口测试沿用夹具的默认 MySQL 端口，在开发实例创建并清理了独立命名的临时测试库。最终联验仅在临时源码副本中把 `mysql2` 与 JDBC 重定向到新建的临时容器，端口 `13306`，数据目录使用内存挂载。夹具和项目配置保留原样。
- 首轮 Edge 全量 132 通过、1 失败，原因是新断网用例未保留原登录页的注册成功查询。修正为捕获原完整地址后专项通过。后续全量发现后台金额筛选用例未等首屏请求完成，补充等待及 URL 金额断言后独立两项通过。站内非法编号用例随后收窄请求计数到作品详情端点，正常评论和互动读取不计为非法详情请求。
- 最终 Edge 全量按 `npm run test:e2e -- --shard=1/2` 和 `npm run test:e2e -- --shard=2/2` 分片执行，前端及后端端口分别隔离。两片分别通过 73 和 71 项，共 144 项。结果在 `frontend/test-results/t033-accepted-edge1` 与 `frontend/test-results/t033-accepted-edge2`。
- Chrome 使用 1366×768 视口，在独立容器联验中运行认证、交互、布局、列表、路由、售后、导航、举报、作品互动和定制需求十个文件，共 85 项通过。结果在 `frontend/test-results/t033-accepted-chrome`。
- 增强入驻图片草稿、地址站内跳转、交易设置草稿和入驻历史权限边界的断言后，Edge、Chrome 各重新执行交互专项，均为 6 项通过。补充关闭标签页提示后，双浏览器各复测入驻 1 项通过。标准 Lint 复跑通过。
- 补足需求报价、定标确认和订单进度的锚点断言后，Edge 和 Chrome 分别复跑布局专项，各 12 项通过。
- Windows 讲述人实测发现单独设置描述时默认聚焦会漏读次数，三个控件改用包含计数的可访问名称。调试过程中，曾把说明文本放进互动按钮的 DOM，导致既有可见文案断言失败。最终保留原可见文案和按钮状态。Edge 与 Chrome 已复核无障碍树及实际互动。按更新口径，Windows 讲述人未作为签收依据。
- 在生产构建的 Vite preview 阻断 `HomeView-*.js` 和 `OrdersView-*.js`。Edge、Chrome 分别验证首页首访 `/?keyword=check#discover` 和站内点击订单，两浏览器共 4 项通过。
