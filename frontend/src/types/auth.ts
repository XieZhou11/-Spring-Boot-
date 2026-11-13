/** 邮箱密码登录参数，字段与后端 LoginDTO 一致。 */
export interface LoginDTO {
  /** QQ 或 163 邮箱。 */
  email: string
  /** 原始密码，保留输入，不去除空白。 */
  password: string
}

/** 注册参数，不允许客户端指定角色。 */
export interface RegistrationDTO extends LoginDTO {
  /** 最新邮件中的六位数字验证码。 */
  verificationCode: string
  /** 2—8 字昵称。 */
  nickname: string
}

/** 邮箱找回密码参数。 */
export interface PasswordResetDTO {
  /** 已注册的 QQ 或 163 邮箱。 */
  email: string
  /** 最新邮件中的六位数字验证码。 */
  verificationCode: string
  /** 校验通过后设置的新密码。 */
  newPassword: string
}

/** 仅供本人读取的账号信息。 */
export interface AccountVO {
  /** 字符串账号编号，避免长整数精度损失。 */
  userId: string
  /** 规范化后的邮箱。 */
  email: string
  /** 用户昵称。 */
  nickname: string
}

/** 服务端确定的当前会话，不写入 localStorage。 */
export interface SessionVO extends AccountVO {
  /** 当前账号拥有的角色集合。 */
  roles: string[]
  /** 当前会话使用的身份。 */
  activeRole: string
  /** 带时区偏移的绝对失效时间。 */
  expiresAt: string
}

/** 邮件发送及保存成功后返回的验证码有效期。 */
export interface VerificationCodeVO {
  /** 验证码失效时刻。 */
  expiresAt: string
}
