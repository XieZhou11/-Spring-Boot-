import type { ImageVO, PageVO } from './creator'
import type { ReportEvidenceVO, ReviewReportDecision, ReviewReportHistoryEntry } from './report'

export interface OrderReviewVO {
  id: string | null
  orderId: string
  buyerNickname: string | null
  rating: number | null
  content: string | null
  images: ImageVO[]
  createdAt: string | null
  canView: boolean
  canReport: boolean
  canCreate: boolean
  reviewDeadlineAt: string | null
}
export interface CreatorReviewVO {
  id: string
  buyerNickname: string
  rating: number
  content: string
  images: ImageVO[]
  canReport: boolean
  createdAt: string
}
export interface ReviewReportVO {
  id: string
  reviewId: string
  reporterId: string
  reasonCode: string
  description: string | null
  imageIds: string[]
  status: 'PENDING' | 'PROCESSED'
  latestResult: string | null
  decisionReason: string | null
  createdAt: string
  processedAt: string | null
}
export interface ReviewReportDetailVO {
  report: ReviewReportVO
  review: OrderReviewVO
  orderId: string
  orderNo: string
  conversationId: string | null
  buyerId: string
  creatorId: string
  evidence: ReportEvidenceVO[]
  messages: { id: string; conversationId: string; seqNo: string; senderId: string; content: string | null; imageIds: string[]; createdAt: string; referencedNodeCode: string | null }[]
  history: ReviewReportHistoryEntry[]
  targetState: string
  allowedDecisions: ReviewReportDecision[]
  canSupplement: boolean
  canObjection: boolean
}
export type ReviewPage<T> = PageVO<T>
