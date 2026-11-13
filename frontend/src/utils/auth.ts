/** 邮箱统一规范化后提交；密码始终保留原值。 */
export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export function validateEmail(value: string) {
  const email = normalizeEmail(value)
  if (!email) return '请输入邮箱地址'
  if (email.length > 254 || !/^[^\s@]+@(qq\.com|163\.com)$/.test(email))
    return '请输入 QQ 邮箱或 163 邮箱'
  return ''
}

export function validatePassword(value: string) {
  if (value.length < 8 || value.length > 20) return '密码需为 8—20 位'
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value) || /[\s\p{Z}]/u.test(value))
    return '密码需包含字母和数字，且不能包含空白字符'
  return ''
}

export function validateNickname(value: string) {
  const nickname = value.trim()
  // 与后端一致，按 Unicode 字符计数，兼容扩展汉字。
  if (Array.from(nickname).length < 2 || Array.from(nickname).length > 8) return '昵称需为 2—8 字'
  if (!/[\p{L}\p{N}]/u.test(nickname)) return '昵称不能为纯符号'
  if (/[<>\p{Cc}]/u.test(nickname)) return '昵称不能包含脚本标记或控制字符'
  return ''
}

export const validateCode = (value: string) =>
  /^[0-9]{6}$/.test(value) ? '' : '请输入六位数字验证码'

/** 只允许已匹配的站内业务页面，避免外部跳转和认证页面循环。 */
export function safeRedirect(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\p{Cc}\p{Z}]/u.test(value)
  )
    return '/'
  try {
    const path = decodeURIComponent(value).split(/[?#]/)[0]
    if (
      !path ||
      path.startsWith('//') ||
      /[\\\p{Cc}\p{Z}]/u.test(path) ||
      /^\/(login|register|forgot-password)(\/|$)/.test(path)
    )
      return '/'
  } catch {
    return '/'
  }
  return value
}
