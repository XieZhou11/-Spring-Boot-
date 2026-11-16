/** 服务器分页结果，编号始终为字符串。 */
export interface PageVO<T> {
  /** 当前页记录。 */
  items: T[]
  /** 总记录数。 */
  total: number
  /** 从 1 开始的页码。 */
  page: number
  /** 每页数量。 */
  size: number
}

/** 两级手作品类。 */
export interface CategoryVO {
  /** 品类编号。 */
  id: string
  /** 一级品类为 null。 */
  parentId: string | null
  /** 展示名称。 */
  name: string
  /** 当前品类是否启用。 */
  enabled: boolean
  /** 升序展示顺序。 */
  sortOrder: number
  /** 当前启用且为末级，可用于作品提交。 */
  selectableForWork: boolean
  /** 下级品类。 */
  children: CategoryVO[]
}

/** 品类新增或编辑参数；编辑时不传 parentId。 */
export interface CategoryDTO {
  /** 新增时选择的一级父品类，null 表示一级。 */
  parentId?: string | null
  /** 品类名称。 */
  name: string
  /** 是否启用。 */
  enabled: boolean
  /** 展示顺序。 */
  sortOrder: number
}

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'

/** 管理员审核请求，不允许指定审核人。 */
export interface CreatorReviewDTO {
  /** 最终通过或驳回结论。 */
  decision: 'APPROVED' | 'REJECTED'
  /** 审核意见，驳回必填。 */
  reason: string
}

/** 只作用于当前会话的身份切换请求。 */
export interface ActiveRoleDTO {
  /** 已具备资格的买家或创作者身份。 */
  activeRole: 'BUYER' | 'CREATOR'
}

/** 每件原创作品的私有图片引用。 */
export interface OriginalWorkDTO {
  /** 成品图文件编号。 */
  finishedImageIds: string[]
  /** 制作过程图文件编号。 */
  processImageIds: string[]
}

/** 入驻申请，敏感资料只在页面内存中保存。 */
export interface CreatorApplicationDTO {
  /** 本次材料对应的幂等 UUID，响应未知时复用。 */
  requestKey: string
  /** 2—20 字申请人姓名。 */
  realName: string
  /** 联系手机号。 */
  contactPhone: string
  /** 所在省名称。 */
  province: string
  /** 所在市名称。 */
  city: string
  /** 所在区县名称。 */
  district: string
  /** 1—3 个启用一级主品类。 */
  categoryIds: string[]
  /** 0—70 年从业年限。 */
  experienceYears: number
  /** 50—500 字个人介绍。 */
  introduction: string
  /** 3—5 件原创作品。 */
  originalWorks: OriginalWorkDTO[]
  /** 真实支付宝账号，不对外公开。 */
  alipayAccount: string
  /** 与申请人一致的收款人姓名。 */
  payeeName: string
  /** 可选的原创或从业补充说明。 */
  supportingDescription: string
}

/** 历次申请的列表字段，不包含敏感材料。 */
export interface ApplicationSummaryVO {
  /** 申请编号。 */
  id: string
  /** 申请人账号编号。 */
  userId: string
  /** 申请人昵称。 */
  nickname: string
  /** 当前申请结论。 */
  status: ApplicationStatus
  /** 申请提交时间。 */
  submittedAt: string
  /** 审核原因。 */
  reviewReason: string | null
  /** 审核完成时间。 */
  reviewedAt: string | null
  /** 撤回时间。 */
  withdrawnAt: string | null
}

/** 完整申请材料，仅本人和必要审核管理员可读取。 */
export interface ApplicationVO extends ApplicationSummaryVO, Omit<CreatorApplicationDTO, 'requestKey'> {
  /** 审核管理员编号。 */
  reviewerId: string | null
  /** 前次申请编号，用于材料比较。 */
  previousApplicationId: string | null
  /** 提交时关联的品类。 */
  categories: CategoryVO[]
}

/** 当前认证概况，以服务端为准。 */
export interface CertificationVO {
  /** 当前认证状态，撤回后可能为 NONE。 */
  certificationStatus: 'NONE' | ApplicationStatus
  /** 当前申请编号。 */
  currentApplicationId: string | null
  /** 已通过的申请编号。 */
  approvedApplicationId: string | null
}

/** 私有图片短时签名；不保存签名到浏览器持久存储。 */
export interface ImageVO {
  /** 文件编号。 */
  id: string
  /** 当前临时签名地址。 */
  url: string
  /** 签名失效时间。 */
  expiresAt: string
}

/** 系统通知。 */
export interface NotificationVO {
  /** 通知编号。 */
  id: string
  /** 业务事件类型。 */
  eventType: string
  /** 通知标题。 */
  title: string
  /** 通知正文。 */
  content: string
  /** 关联申请。 */
  businessReference: {
    /** 当前任务支持创作者申请通知。 */
    type: 'CREATOR_APPLICATION' | 'WORK'
    /** 作品审核轮次，申请通知不含此字段。 */
    version?: string
    /** 关联申请编号。 */
    id: string
  } | null
  /** 已读时间，未读为 null。 */
  readAt: string | null
  /** 通知生成时间。 */
  createdAt: string
}
