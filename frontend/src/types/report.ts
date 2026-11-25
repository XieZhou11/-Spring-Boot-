/** 内容举报类型：作品、评论、创作者主页与评价共用同一举报记录结构。 */
export type ContentReportTargetType = 'WORK' | 'COMMENT' | 'CREATOR_PROFILE' | 'REVIEW'
export type ContentReportStatus = 'PENDING' | 'PROCESSED'
export type ContentReportResult = 'NOT_UPHELD' | 'ACTION_TAKEN'
export type ContentReportDecision = 'NOT_UPHELD' | 'OFFLINE' | 'HIDE' | 'PAUSE' | 'RESTORE' | 'RESUME'
/** 评价举报使用专用裁定范围。 */
export type ReviewReportDecision = 'NOT_UPHELD' | 'HIDE' | 'DELETE' | 'RESTORE'

/** 举报当前记录，targetSummary 为被举报对象摘要。 */
export interface ContentReportVO {
  id: string
  targetType: ContentReportTargetType
  targetId: string
  targetSummary: string
  reasonCode: string
  description: string | null
  imageIds: string[]
  status: ContentReportStatus
  latestResult: ContentReportResult | null
  decisionReason: string | null
  createdAt: string
  lastProcessedAt: string | null
}

/** 举报详情：目标快照、证据、处置历史及当前用户可执行动作。 */
export interface ContentReportDetailVO {
  report: ContentReportVO
  ownerId: string | null
  targetSummary: string
  workId: string | null
  targetState: string
  originalComment: string | null
  originalCommentImageIds: string[]
  evidence: ReportEvidenceVO[]
  history: ReviewReportHistoryEntry[]
  allowedDecisions: ContentReportDecision[]
  canSupplement: boolean
  canObjection: boolean
}

/** 补充证据或处置异议条目。 */
export interface ReportEvidenceVO {
  id: string
  submitterId: string
  evidenceType: 'SUPPLEMENT' | 'OBJECTION'
  content: string | null
  imageIds: string[]
  createdAt: string
}

/** 处置及更正历史条目。 */
export interface ReviewReportHistoryEntry {
  id: string
  operatorId: string | null
  action: string
  beforeStatus: string | null
  afterStatus: string | null
  reason: string | null
  detail: Record<string, unknown> | null
  createdAt: string
}

/** 举报提交与补证输入。 */
export interface ReportInput {
  reasonCode: string
  description: string
  imageIds: string[]
}
