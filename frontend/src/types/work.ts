import type { CategoryVO, ImageVO } from './creator'

export type WorkStatus = 'DRAFT' | 'PENDING' | 'ONLINE' | 'REJECTED' | 'OFFLINE'
/** 作品内容；价格保持十进制字符串，不经过浮点计算。 */
export interface WorkContent {
  /** 作品标题。 */
  title: string
  /** 最具体的启用品类。 */
  categoryId: string | null
  /** 有序主图，首图为封面。 */
  mainImageIds: string[]
  /** 尺寸说明图。 */
  specificationImageIds: string[]
  /** 主材与辅料。 */
  material: string
  /** 尺寸或规格。 */
  specification: string
  /** 作品及保养介绍。 */
  description: string
  /** 可选制作过程。 */
  processDescription: string
  /** 是否出售当前一件成品。 */
  saleEnabled: boolean
  /** 是否接受另外制作。 */
  customEnabled: boolean
  /** 当前现货售价。 */
  stockPrice: string | null
  /** 同类定制参考自然日。 */
  customReferenceDays: number | null
}
/** 作品详情；管理端增加审核原因，公开接口不返回私密审核意见。 */
export interface WorkVO extends WorkContent {
  /** 作品编号。 */
  id: string
  /** 创作者账号编号。 */
  creatorId: string
  /** 公开昵称。 */
  creatorNickname: string
  /** 头像签名地址。 */
  creatorAvatarUrl: string | null
  /** 头像签名失效时间。 */
  creatorAvatarExpiresAt: string | null
  /** 品类名称路径。 */
  categoryPath: string[]
  /** 审核与公开状态。 */
  reviewStatus: WorkStatus
  /** 单件现货状态。 */
  stockStatus: 'AVAILABLE' | 'RESERVED' | 'SOLD_OUT' | null
  /** 乐观锁版本。 */
  version: string
  /** 首次提交时间。 */
  firstSubmittedAt: string | null
  /** 本轮提交时间。 */
  submittedAt: string | null
  /** 最近上架时间。 */
  onlineAt: string | null
  /** 创建时间。 */
  createdAt: string
  /** 最后更新时间。 */
  updatedAt: string
  /** 审核或下架原因。 */
  reviewReason: string | null
  /** 当前资格及库存允许直购。 */
  purchasable: boolean
  /** 当前资格允许定制。 */
  customizable: boolean
  /** 列表封面短时签名。 */
  coverImage: ImageVO | null
}
export interface PublicationQuotaVO {
  /** 北京时间当日已用首次提交数。 */
  used: number
  /** 每日上限。 */
  limit: number
  /** 剩余首次提交数。 */
  remaining: number
  /** 真实发布资格。 */
  canPublish: boolean
  /** 不可发布原因。 */
  reason: string | null
}
export interface CreatorPublicVO {
  /** 账号编号。 */
  id: string
  /** 公开昵称。 */
  nickname: string
  /** 公开简介。 */
  bio: string | null
  /** 头像签名。 */
  avatarUrl: string | null
  /** 头像签名期限。 */
  avatarExpiresAt: string | null
  /** 认证主品类。 */
  categories: CategoryVO[]
  /** 认证所在省。 */
  province: string | null
  /** 认证所在市。 */
  city: string | null
  /** 暂停新业务。 */
  paused: boolean
  /** 实际平均评分，无评价时为 null。 */
  averageRating: string | null
  /** 实际评价数。 */
  reviewCount: number
  /** 四至五星占有效评价比例，无评价为空。 */
  positiveRate: string | null
  /** 实际完成订单数。 */
  completedOrderCount: number
  /** 当前已上架作品数。 */
  publicWorkCount: number
}
export interface WorkHistoryVO {
  /** 历史编号。 */
  id: string
  /** 操作类型。 */
  action: string
  /** 原状态。 */
  beforeStatus: WorkStatus | null
  /** 结果状态。 */
  afterStatus: WorkStatus
  /** 操作说明。 */
  reason: string | null
  /** 操作者编号。 */
  operatorId: string
  /** 操作者身份。 */
  operatorType: string
  /** 操作时间。 */
  createdAt: string
  /** 轮次、内容快照及字段修改。 */
  detail: { snapshot?: Partial<WorkVO>; before?: Partial<WorkVO>; after?: Partial<WorkVO>; submittedVersion?: string }
}
/** 列表参数；公开页固定每页二十条。 */
export interface WorkQuery {
  /** 页码。 */
  page?: number
  /** 标题及描述搜索。 */
  keyword?: string
  /** 一级或二级品类。 */
  categoryId?: string
  /** 指定作者。 */
  creatorId?: string
  /** 可购现货最低价。 */
  minPrice?: string
  /** 可购现货最高价。 */
  maxPrice?: string
  /** 只看可直购。 */
  purchasable?: boolean
  /** 只看可定制。 */
  customizable?: boolean
  /** 最新或价格顺序。 */
  sort?: 'LATEST' | 'PRICE_ASC' | 'PRICE_DESC'
  /** 管理队列的审核状态。 */
  status?: WorkStatus | ''
}
