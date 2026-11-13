# T-003 个人资料与收货地址

- 状态：已完成
- 更新日期：2026-11-13
- 需求依据：[V1.5 需求](../../requirements/requirements.md)4.1.2、3.3、5.2、UC-05
- 关联设计：[数据库表结构](../../design/数据库表结构.md)4.1、4.2、4.7

## 目标与范围

一起完成前后端个人资料、头像上传、收货地址管理及真实 MySQL/浏览器联调。订单建单和地址快照在订单功能实现；本任务不新增角色切换或其他业务入口。

## 验收条件

- 仅本人读取及维护资料和地址，未登录拒绝，CSRF 保留，地址越权与不存在统一 404。
- 昵称 2—8 个 Unicode 字符、简介最多 200 字，可清空；头像实际为 JPEG/PNG，最大 2MiB，失败保留原头像。
- 地址最多 10 条，并发新增不超额；首条自动默认，默认不能单独取消；删除默认后自动选择创建时间、编号倒序的剩余最新地址。
- 默认切换及删除替换在同一事务内完成，失败整体回滚；重复保存和设置默认返回有效结果。
- 省市区本地三级联动，并允许未覆盖地区手动补全；错误保留输入，删除需确认。
- 真实 OSS SDK 上传、私有短时访问、失败补偿；未配置时上传明确 503，其他资料和地址功能可用。配置不写占位项，真实云端验收在用户补齐配置后进行并已通过。
- MySQL 事务、权限及并发回归、浏览器流程、前端检查及后端构建通过，真实 OSS 未验收项如实标记。

## 设计与改动位置

复用 user_account、shipping_address、file_asset，不修改 V1。modules 下按职责同级组织，Controller → Service → Mapper；资料及地址写事务使用用户行锁，默认唯一由数据库生成列唯一键兜底。

所有接口沿用 Result，编号为字符串，身份从服务端会话取得。ProfileVO 返回 userId、email、nickname、bio、avatarUrl、avatarExpiresAt；签名不可用时头像字段为 null，其他字段正常读取。ProfileUpdateDTO 接收 nickname、bio。AddressDTO 接收 recipientName、phone、province、city、district、detailAddress、isDefault；AddressVO 另含 id。列表默认优先，其次创建时间和编号倒序。

| 方法及路径 | 行为与成功状态 |
| --- | --- |
| GET /api/me/profile | 本人资料，200 |
| PUT /api/me/profile | 保存昵称和简介，返回 ProfileVO，200 |
| PUT /api/me/avatar | multipart 字段 file，上传并绑定后返回 ProfileVO，200 |
| GET /api/me/addresses | 本人地址列表，200 |
| POST /api/me/addresses | 新增并返回 AddressVO，201 |
| PUT /api/me/addresses/{id} | 更新并返回 AddressVO，200 |
| DELETE /api/me/addresses/{id} | 删除及默认替换，200 |
| PUT /api/me/addresses/{id}/default | 设为默认并返回 AddressVO，200 |

新增/编辑 isDefault=true 时切换默认；当前默认传 false 仍保持默认，避免单独取消。地址数量超限返回 409；字段错误 400；归属和不存在统一 404；其余错误复用公共约定。OSS 配置键为 app.oss.endpoint、region、bucket、access-key-id、access-key-secret，不添加空配置或假凭据。

字段校验沿用业务码 40000 和 data.fieldErrors；未登录 40100、CSRF 拒绝 40300、地址不存在/越权 40400、地址数量超限 40900。头像错误如下，客户端不能依据 50321 推断绑定一定失败，应重新读取当前头像。

| HTTP / 业务码 | 含义 |
| --- | --- |
| 400 / 40020 | 图片实际格式或内容无效 |
| 413 / 41320 | 业务校验超过 2MiB；容器提前拒绝时为 41300 |
| 409 / 40920 | 预留文件状态已变化，拒绝绑定 |
| 503 / 50320 | OSS 必要配置缺失 |
| 503 / 50321 | 外部上传或绑定失败，或结果尚无法确认 |

头像使用短事务预留 UPLOADING，事务外上传私有对象，再按用户→文件顺序加锁并原子设置 AVAILABLE 和账号引用。提交结果未知时重新核对，曾成功绑定的 AVAILABLE 对象一律保留。未绑定新文件持久化为 CLEANUP_PENDING，调度每分钟重试；删除后保留两分钟稳定窗口并再次删除，覆盖迟到 PUT；进程中断的一小时以上 UPLOADING 记录也会恢复清理。业务成功日志只在事务提交后记录。

## 实施步骤

- [x] 建立关键失败测试并确认功能缺失。
- [x] 完成资料与地址后端、校验、事务和日志。
- [x] 完成头像真实 OSS、文件状态与失败补偿。
- [x] 完成个人中心页面、上传及地区联动。
- [x] 运行 MySQL、浏览器联调、构建及独立审查。
- [x] 同步需求默认地址规则、工程说明与实际测试记录。

## 验证结果

- 总体结果：前后端实现及本地真实 MySQL/浏览器联调完成。后端完整 verify 构建成功，79 项中 77 通过、2 项历史迁移专项测试因缺少指定连接跳过；前端 type-check、lint、build 通过，Playwright 19 项全部通过（含原有 13 项认证回归）。
- 用户补齐配置后，真实北京私有 OSS 页面上传、签名读取、匿名拒绝、替换、刷新及续签触发验收通过；隔离测试账号和上传对象已清理。
- 测试记录：[T-003 测试结果](../../testing/T-003-personal-center.md)。

## 审查与遗留问题

独立审查发现的失败上传迟到对象清理、上传请求超时两项 P2 已修复并复审关闭；增量审查及最终核对无剩余可复现 P1/P2。真实 OSS 配置由用户在代码完成后提供，已独立完成云端验收，凭据仅留本地配置。

## 交接

入口为本任务、V1.5 需求及前后端 README。交付分支为 `codex/personal-center`，具体提交见该分支 Git 记录；本地真实 SMTP、验证码密钥和 OSS 配置不纳入提交。更换 OSS 配置见[后端配置说明](../../../backend/README.md#个人资料地址与头像)，改动后须重启；订单地址快照随订单任务实现。QQ/163 公网实收仍按 T-001、T-002 单独验收。
