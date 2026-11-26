import type { ApplicationStatus } from '@/types/creator'

/** 结论用统一中文呈现，时间始终使用北京时间。 */
export const applicationStatusLabels: Record<ApplicationStatus | 'NONE', string> = {
  NONE: '未申请', PENDING: '待审核', APPROVED: '已认证', REJECTED: '已驳回', WITHDRAWN: '已撤回',
}
/** 使用北京时间显示业务时间，精确截止可显示秒。 */
export function formatTime(value: string | null | undefined, timeStyle: 'short' | 'medium' = 'short') {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle }).format(new Date(value))
}
