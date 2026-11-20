import type { AdminRefundDetailVO, RefundApplicationVO, RefundCreateDTO, RefundDecisionDTO, RefundEvidenceDTO, RefundEvidenceVO } from '@/types/refund'

export const refundReasons: Record<string, string> = { MISMATCH: '与约定不符', QUALITY: '质量问题', SHIPPING_DELAY: '发货延误', CREATOR_UNABLE: '创作者无法履约', OTHER: '其他' }
export const refundStatuses: Record<string, string> = { WAIT_ADMIN: '待管理员处理', REFUNDED: '已全额退款', REJECTED: '已驳回', WITHDRAWN: '已撤回' }
export type RefundAttempt = { kind: 'create'; input: RefundCreateDTO } | { kind: 'evidence'; applicationId: string; input: RefundEvidenceDTO } | { kind: 'withdraw'; applicationId: string }
export interface RefundDraft { mode: 'create' | 'evidence'; applicationId: string; reasonCode: string; content: string; imageIds: string[] }
const prefix = 'order-refund:'
const key = (userId: string, objectId: string, scope: string) => `${prefix}${userId}:${scope}:${objectId}`
const sameImages = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)
const images = (value: unknown, maximum = 3): value is string[] => Array.isArray(value) && value.every(id => typeof id === 'string' && /^[1-9]\d*$/.test(id)) && value.length <= maximum
function read(userId: string, objectId: string, scope: string): unknown { try { return JSON.parse(sessionStorage.getItem(key(userId, objectId, scope)) || 'null') } catch { return null } }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
/** 仅持久化必要表单/原请求参数；地址、账户、整份详情和签名URL均不进入存储。 */
export function saveRefundState(userId: string, objectId: string, scope: 'attempt' | 'draft' | 'admin-attempt' | 'admin-draft', value: unknown) { sessionStorage.setItem(key(userId, objectId, scope), JSON.stringify(value)) }
export function clearRefundState(userId: string, objectId: string, scope: 'attempt' | 'draft' | 'admin-attempt' | 'admin-draft') { try { sessionStorage.removeItem(key(userId, objectId, scope)) } catch { /* 已确认结果不因清理失败变为失败；下次仍精确核验。 */ } }
/** 白名单恢复损坏存储，绝不将任意本地对象直接重放为HTTP参数。 */
export function readRefundAttempt(userId: string, orderId: string): RefundAttempt | undefined {
  const v = read(userId, orderId, 'attempt'); if (!object(v)) return
  if (v.kind === 'withdraw' && typeof v.applicationId === 'string' && /^[1-9]\d*$/.test(v.applicationId)) return { kind: 'withdraw', applicationId: v.applicationId }
  const i = v.input
  if (!object(i) || typeof i.requestKey !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(i.requestKey) || !images(i.imageIds)) return
  if (v.kind === 'create' && typeof i.reasonCode === 'string' && refundReasons[i.reasonCode] && typeof i.description === 'string') return { kind: 'create', input: { requestKey: i.requestKey, reasonCode: i.reasonCode, description: i.description, imageIds: [...i.imageIds] } }
  if (v.kind === 'evidence' && typeof v.applicationId === 'string' && /^[1-9]\d*$/.test(v.applicationId) && typeof i.content === 'string') return { kind: 'evidence', applicationId: v.applicationId, input: { requestKey: i.requestKey, content: i.content, imageIds: [...i.imageIds] } }
}
export function readRefundDraft(userId: string, orderId: string): RefundDraft | undefined {
  const v = read(userId, orderId, 'draft')
  if (object(v) && (v.mode === 'create' || v.mode === 'evidence') && typeof v.applicationId === 'string' && typeof v.reasonCode === 'string' && refundReasons[v.reasonCode] && typeof v.content === 'string' && images(v.imageIds)) return { mode: v.mode, applicationId: v.applicationId, reasonCode: v.reasonCode, content: v.content, imageIds: [...v.imageIds] }
}
export function readRefundDecision(userId: string, applicationId: string, scope: 'admin-attempt' | 'admin-draft'): RefundDecisionDTO | undefined {
  const v = read(userId, applicationId, scope)
  if (!object(v) || !Number.isSafeInteger(v.expectedVersion) || (v.expectedVersion as number) < 0 || !['APPROVE', 'REJECT'].includes(String(v.decision)) || typeof v.reason !== 'string' || typeof v.returnRequired !== 'boolean' || typeof v.returnedConfirmed !== 'boolean' || typeof v.returnTrackingNo !== 'string' || !images(v.returnEvidenceImageIds, 50) || typeof v.noReturnBasis !== 'string') return
  return { expectedVersion: v.expectedVersion as number, decision: v.decision as 'APPROVE' | 'REJECT', reason: v.reason, returnRequired: v.returnRequired, returnedConfirmed: v.returnedConfirmed, returnTrackingNo: v.returnTrackingNo, returnEvidenceImageIds: [...v.returnEvidenceImageIds], noReturnBasis: v.noReturnBasis }
}
export function sameRefundCreation(result: RefundApplicationVO, input: RefundCreateDTO) { return result.createRequestKey === input.requestKey && result.reasonCode === input.reasonCode && result.description === input.description && sameImages(result.imageIds, input.imageIds) }
export function sameRefundEvidence(result: RefundEvidenceVO, input: RefundEvidenceDTO) { return result.requestKey === input.requestKey && (result.content || '') === input.content && sameImages(result.imageIds, input.imageIds) }
/** 裁定必须核对管理员、申请和全部原始参数，不凭订单REFUNDED推断本次操作成功。 */
export function sameRefundDecision(result: AdminRefundDetailVO, userId: string, input: RefundDecisionDTO) {
  const facts = result.decisionFacts
  return result.application.handlerId === userId && !!facts && facts.expectedVersion === input.expectedVersion && facts.decision === input.decision && facts.reason === input.reason && facts.returnRequired === input.returnRequired && facts.returnedConfirmed === input.returnedConfirmed && (facts.returnTrackingNo || '') === input.returnTrackingNo && sameImages(facts.returnEvidenceImageIds || [], input.returnEvidenceImageIds) && (facts.noReturnBasis || '') === input.noReturnBasis
}
/** 登出、账号替换及权限撤销时清掉该账号的售后输入，保留其他账号隔离。 */
export function clearUserRefundState(userId?: string) { if (!userId) return; try { for (const item of Object.keys(sessionStorage)) if (item.startsWith(`${prefix}${userId}:`)) { try { sessionStorage.removeItem(item) } catch { /* 继续清理其余对象。 */ } } } catch { /* 存储不可用不阻止退出。 */ } }
