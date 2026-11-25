import { getMyReports, getReport } from '@/api/report'
import { getReviewReport } from '@/api/review'
import type { ContentReportTargetType, ReportInput } from '@/types/report'

export const reportTypes: Record<ContentReportTargetType, string> = { WORK: '作品', COMMENT: '评论', CREATOR_PROFILE: '创作者主页', REVIEW: '评价' }
export const reportReasons: Record<string, string> = { COPYRIGHT: '盗图', FALSE_ADVERTISING: '虚假宣传', OFFSITE: '站外引流', ABUSE: '辱骂', OTHER: '其他' }
export const reportDecisions: Record<string, string> = { NOT_UPHELD: '举报不成立', OFFLINE: '下架作品', HIDE: '隐藏', DELETE: '删除评价', PAUSE: '暂停新业务', RESTORE: '恢复', RESUME: '恢复新业务' }

/** 以完整说明和图片编号核对超时请求已保存的材料。 */
export function matchesReportMaterial(item: { content: string | null; imageIds: string[] }, input: ReportInput) {
  return (item.content ?? '') === input.description
    && item.imageIds.length === input.imageIds.length
    && item.imageIds.every(id => input.imageIds.includes(id))
}

/** 从本人队列取得相同材料的持久化编号，用于比较提交前后新增的记录。 */
export async function findOwnReportMaterial(type: ContentReportTargetType, targetId: string, input: ReportInput) {
  const matches = new Set<string>()
  for (let page = 1; ; page++) {
    const result = await getMyReports(page)
    for (const row of result.items) {
      if (row.targetType !== type || row.targetId !== targetId) continue
      if (row.reasonCode === input.reasonCode && matchesReportMaterial({ content: row.description, imageIds: row.imageIds }, input)) matches.add(`report:${row.id}`)
      const detail = await (type === 'REVIEW' ? getReviewReport(row.id) : getReport(row.id))
      for (const item of detail.evidence) {
        if (item.evidenceType === 'SUPPLEMENT' && matchesReportMaterial(item, input)) matches.add(`evidence:${item.id}`)
      }
    }
    if (page * result.size >= result.total) return matches
  }
}

/** 只有新建举报或新增补证才可确认本次操作。 */
export async function prepareOwnReportVerification(type: ContentReportTargetType, targetId: string, input: ReportInput, onFound: () => void) {
  const existing = await findOwnReportMaterial(type, targetId, input)
  return async () => {
    const latest = await findOwnReportMaterial(type, targetId, input)
    const found = [...latest].some(id => !existing.has(id))
    if (found) onFound()
    return found
  }
}
