/** 本人资料；头像访问地址可用时返回到期时间，不向页面暴露存储对象键。 */
export interface ProfileVO {
  /** 当前登录用户编号，使用字符串避免大整数精度丢失。 */
  userId: string
  /** 只读登录邮箱。 */
  email: string
  /** 对外展示昵称。 */
  nickname: string
  /** 个人简介，可为空。 */
  bio: string | null
  /** 私有头像的临时访问地址，不可用时为空。 */
  avatarUrl: string | null
  /** 头像地址到期时刻，用于仅刷新头像。 */
  avatarExpiresAt: string | null
}

/** 头像独立上传，基本资料仅提交可编辑字段。 */
export interface ProfileUpdateDTO {
  /** 昵称，2—8 个 Unicode 字符。 */
  nickname: string
  /** 最多 200 字的个人简介，空字符串表示清空。 */
  bio: string
}

/** 地址字段使用地区名称，兼容联动数据未覆盖地区的手动补全。 */
export interface AddressDTO {
  /** 收件人姓名。 */
  recipientName: string
  /** 大陆 11 位收货手机号。 */
  phone: string
  /** 省、自治区或直辖市名称。 */
  province: string
  /** 市级地区名称。 */
  city: string
  /** 区县名称。 */
  district: string
  /** 街道、门牌等详细收件地址。 */
  detailAddress: string
  /** 请求设为默认；false 不会取消已有默认地址。 */
  isDefault: boolean
}

export interface AddressVO extends AddressDTO {
  /** 本人地址编号，编辑、删除及设为默认使用。 */
  id: string
}
