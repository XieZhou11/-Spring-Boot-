# T-006 作品互动与个人收藏、关注

- 状态：待验收（实际页面接入与联合回归通过；正式 Git 集成待授权）
- 更新日期：2026-11-16
- 需求依据：[V1.5](../../requirements/requirements.md)3.1、3.3、4.2.3、4.2.4，R-14、UC-08。
- 关联设计：[数据库表结构](../../design/数据库表结构.md)4.9—4.11、文件与锁序约定。

## 目标与范围

完成点赞、收藏、图文评论、关注及个人收藏和关注列表。举报治理、订单评价与聊天独立实施；本任务保留隐藏和删除状态及图片证据，不增加无调用能力的按钮。

## 验收条件

- 关系可添加和取消，重复及并发请求不多计；统计来自真实关系。
- 新互动须针对可见作品或认证创作者；管理员不能参与互动；身份来自会话。
- 评论10—500字、0—3张本人评论图片，仅本人可逻辑删除；隐藏及自删不公开。
- 失效收藏显示已下架，不泄漏非公开标题、图片或审核材料，仍可取消；下架不阻止删除本人评论。
- 私有OSS实际解码、大小校验、签名读取、续签及无引用临时图补偿；历史评论引用不误删。
- 前后端接入T-005实际页面，并通过真实MySQL、HTTP、浏览器及独立审查。

## 设计与改动位置

独立分支codex/work-interactions与worktree，从共同已提交基线开始；不修改作品窗口。复用V1关系、评论、文件表，不修改既有迁移。分层代码遵守modules同级职责包。

实际接口见下表，已核对 T-005 没有重复能力；后续作品链路变化时同步调整调用方及相关测试。

统一Result、编号字符串、北京时间偏移；分页items、total、page、size，默认20最大50。评论及关系按created_at、id倒序；PUT返回当前状态，DELETE成功204，POST评论201。收藏失效时只返回编号、收藏时间及失效标记，其他内容字段为null。图片使用独立work-comments/对象前缀。

**依赖适配：开始前、页面接入前、集成前重新核对T-005实际完成情况和最终接口；对应调整请求、类型、组件、图片鉴权及测试，不能要求T-005迁就暂定接口。行为冲突仍以V1.5为依据。** 已核实作品链路实际提交`bd693e6`，互动分支基于该提交实现。使用实际`WorkVO.id/creatorId`、`ONLINE`状态、字符串文件编号及`ImageVO`；通过`WorkMaterials`作者区slot仅在公开详情接入关注，管理预览不受影响。沿用实际公共布局、路由守卫、CSRF和T-005下架404响应。原窗口未提交配置保持原样；本次无迁移或开发配置变更。

### 最终接口与字段

全部要求登录。管理员可读公开统计和评论，不能写互动。写请求携带当前CSRF；身份只取会话。个人查询只返回本人关系。

| 方法与路径（统一`/api`前缀） | 参数及响应data |
| --- | --- |
| GET `/works/{id}/interactions` | `likeCount/favoriteCount/commentCount/liked/favorited` |
| PUT、DELETE `/me/work-likes/{workId}` | PUT无需请求体，返回`{active:true}`；DELETE 204 |
| GET `/me/favorite-works` | `page/size`；items为`workId/available/title/creatorId/creatorNickname/coverImage/favoritedAt` |
| PUT、DELETE `/me/favorite-works/{workId}` | PUT返回`{active:true}`；DELETE 204 |
| GET `/works/{id}/comments` | `page/size`；items为`id/workId/authorId/authorNickname/avatarUrl/avatarExpiresAt/content/imageIds/images/createdAt/canDelete` |
| POST `/works/{id}/comments` | JSON `content`必填10—500个Unicode码点，`imageIds`可省略或0—3个不重复编号；201返回新评论 |
| DELETE `/me/work-comments/{commentId}` | 本人逻辑删除，保留图片引用；重复删除204，其他用户404 |
| GET `/me/followed-creators` | `page/size`；items为`creatorId/nickname/bio/avatarUrl/avatarExpiresAt/paused/available/followedAt` |
| GET、PUT、DELETE `/me/followed-creators/{creatorId}` | GET、PUT返回`{following:boolean}`；PUT无请求体，DELETE 204 |
| POST `/work-comment-images` | multipart `file`，JPEG/PNG/WebP实际解码、单张最大5MB，201返回`ImageVO{id,url,expiresAt}` |
| GET `/work-comment-images/{id}` | 15分钟私有签名；上传者可预览，其他人需有当前可见作品中的公开评论引用 |

通用错误：40000参数/文本/图片引用规则，40100未登录，40300管理员参与或CSRF错误，40400非公开作品/无资格创作者/非本人评论，40900图片状态变化。图片错误：40050图片无效、41350超过5MB、50350存储不可用、50351上传结果无法确认。字段校验沿用统一`fieldErrors`。DTO的`@Size(max=1000)`限制UTF-16安全上限，Service精确检查10—500个码点，前端使用相同计数规则。

关系以用户行锁、唯一键及显式添加/删除保持幂等；作品写入在事务内锁定作品复核可见性，关注按用户编号顺序锁双方。图片绑定与清理共享用户→作品→文件（文件编号升序）锁序。清理每分钟扫描，超过24小时无任何历史评论引用的可用临时图及上传失败资源进入补偿，沿用稳定清理窗口；隐藏、自删评论引用不会回收。

前端入口：`/works/:id`互动区、作者区和`/creators/:id`关注；`/account/favorites`、`/account/following`个人列表。请求使用组件上下文与读取版本，账号/作品切换清除草稿并忽略迟到响应。评论响应未知时保留文字图片、锁定再发，先核对列表后由用户明确选择；不自动重发。签名到期前重新读取原鉴权端点；分页删除末条后退回有效页。

## 实施步骤

- [x] 独立MySQL关键失败测试与数据接口。
- [x] 评论图片实际上传、鉴权及补偿测试。
- [x] 互动组件、个人列表、路由导航及T-005实际页面接入。
- [x] 隔离端口15173/19081浏览器回归、真实OSS、构建与独立审查。
- [x] 同步结果和项目入口，记录依赖快照及遗留。
- [ ] 明确授权后建立`codex/work-integration`并执行正式合并及提交后集成回归。

## 验证结果

- 总体结果：核心15项、图片SDK协议4项、真实OSS1项通过；联合Maven verify实际执行136项、失败0，6项条件跳过（本任务云测试另行执行通过）。完整浏览器36项通过；最后局部收藏封面样式修正后，互动7项再次通过，Lint及含类型检查的构建通过。独立审查发现的问题均已修复、复现验证并定向复审关闭。
- 测试记录：见[实际验证](../../testing/T-006-work-interactions.md)。

## 审查与遗留问题

后端独立审查发现Unicode长度边界；前端独立审查发现图片重读误提交、评论末页删除问题；最终联合审查发现外部取消收藏/关注后的越界刷新问题，截图核验补充发现收藏封面全高挤出正文的问题。均先复现、修复并通过定向复审，无未解决的已确认审查缺陷。日志、历史证据保留及真实数据库竞争等验收证据见测试记录。

用户于2026-11-16明确授权提交代码并推送远程，本轮交付在`codex/work-interactions`固定，提交编号从该分支Git历史定位。作品链路基线为`bd693e629576917ac4d63aff2c679aff9b621e28`；正式合并仍须另获明确授权，计划使用`codex/work-integration`完成最终分支集成，保留原功能分支。尚未创建集成分支或集成提交。原作品窗口仅有的本地配置改动未触碰，后端本地测试、凭据和生成物不纳入提交。举报治理、交易、聊天保持原任务边界；QQ/163补充验收仍按既有任务暂缓。

## 交接

继续读取本任务、[T-005](T-005-work-publication.md)及测试记录。功能已接入实际交付页面并通过联合验收流程，因尚未执行正式Git集成保留待验收状态。正式集成获得明确授权后，从共同基线建立集成分支，先作品后互动，核对两个稳定提交、路由导航、图片清理及测试夹具，解决冲突并运行提交后的联合回归。若T-005继续变更，依照本任务依赖适配规则调整，不能将当前接口视为永久不变。
