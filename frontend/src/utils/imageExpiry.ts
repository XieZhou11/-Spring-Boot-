/** 只用有效的签名时间计算续签，单个坏值不能打断整页图片。 */
export function imageRenewalDelay(...expiries: (string | null | undefined)[]) {
  const times = expiries.flatMap(expiry => {
    const time = Date.parse(expiry ?? '')
    return Number.isFinite(time) ? [time] : []
  })
  if (times.length === 0) return undefined
  return Math.min(Math.max(Math.min(...times) - Date.now() - 20_000, 5000), 2_147_000_000)
}
