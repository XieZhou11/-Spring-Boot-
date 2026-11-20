import type { ImageVO, PageVO } from './creator'

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
  evidence: { id: string; submitterId: string; evidenceType: string; content: string | null; imageIds: string[]; createdAt: string }[]
  messages: { id: string; conversationId: string; seqNo: string; senderId: string; content: string | null; imageIds: string[]; createdAt: string; referencedNodeCode: string | null }[]
  history: { id: string; operatorId: string | null; action: string; beforeStatus: string | null; afterStatus: string | null; reason: string | null; detail: Record<string, unknown>; createdAt: string }[]
}
export type ReviewPage<T> = PageVO<T>
