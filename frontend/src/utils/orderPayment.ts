import type { OrderPaymentDTO } from '@/types/quote'

const prefix = 'order-payment:'
const key = (userId: string, orderId: string) => `${prefix}${userId}:${orderId}`

/** 只存条款版本和日期；写入失败由页面拦截，保存成功前不得发送付款。 */
export function savePaymentAttempt(userId: string, orderId: string, input: OrderPaymentDTO) {
  sessionStorage.setItem(key(userId, orderId), JSON.stringify({ input, unknown: true }))
}
/** 调用方必须先验证当前会话，读取范围严格限定在本人同一订单。 */
export function readPaymentAttempt(userId: string, orderId: string): OrderPaymentDTO | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(userId, orderId)) || 'null')
    if (value?.unknown === true && value.input?.termsConfirmed === true && typeof value.input.termsVersion === 'string' && typeof value.input.confirmedShipDate === 'string') {
      return { termsConfirmed: true, termsVersion: value.input.termsVersion, confirmedShipDate: value.input.confirmedShipDate }
    }
  } catch { /* 损坏的确认记录不能作为付款输入。 */ }
  return undefined
}
/** 浏览器拒绝删除时仍继续清理内存及核验结果，不能把成功付款误判成失败。 */
export function clearPaymentAttempt(userId: string, orderId: string) {
  try { sessionStorage.removeItem(key(userId, orderId)) }
  catch { /* 存储暂不可访问时保留的旧标记，下次只按本人同订单重新核验。 */ }
}
/** 退出及身份替换时移除原账号未确认结果，不留给下一位登录者。 */
export function clearUserPaymentAttempts(userId?: string) {
  if (!userId) return
  let storedKeys: string[]
  try { storedKeys = Object.keys(sessionStorage) }
  catch { return /* 本地存储不可访问不能阻断服务端退出及内存身份清理。 */ }
  for (const storedKey of storedKeys) {
    if (!storedKey.startsWith(`${prefix}${userId}:`)) continue
    try { sessionStorage.removeItem(storedKey) }
    catch { /* 单条删除失败不妨碍其他条目清理；其他账号不会读取此用户的键。 */ }
  }
}
