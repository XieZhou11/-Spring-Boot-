import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { ImageVO, PageVO } from '@/types/creator'
import type { CreatorPublicVO } from '@/types/work'
import type { ChatMessageVO, ConversationVO, CustomRequestVO, RequestContent, RequestQuotaVO } from '@/types/customRequest'

async function get<T>(path: string, params?: object) { return (await request.get<ApiResult<T>>(path, { params })).data.data }
async function put<T>(path: string, data: object) { return (await request.put<ApiResult<T>>(path, data)).data.data }
async function post<T>(path: string, data?: object) { return (await request.post<ApiResult<T>>(path, data)).data.data }
/** 所有写入沿用统一请求层的当前会话和CSRF。 */
export const getRequests = (params: object, scope: 'hall' | 'mine' | 'invitations') => get<PageVO<CustomRequestVO>>(scope === 'mine' ? '/me/custom-requests' : scope === 'invitations' ? '/me/custom-request-invitations' : '/custom-requests', params)
export const getCustomRequest = (id: string, mine = false) => get<CustomRequestVO>(`${mine ? '/me' : ''}/custom-requests/${id}`)
export const getRequestQuota = () => get<RequestQuotaVO>('/me/custom-request-quota')
export const createRequest = (data: RequestContent, requestKey: string) => post<CustomRequestVO>('/me/custom-requests', { ...data, requestKey })
export const saveRequest = (id: string, data: RequestContent, version: string) => put<CustomRequestVO>(`/me/custom-requests/${id}`, { ...data, version })
export const publishRequest = (id: string, data: RequestContent, version: string) => put<CustomRequestVO>(`/me/custom-requests/${id}/publication`, { ...data, version })
export const closeRequest = (id: string, version: string) => put<CustomRequestVO>(`/me/custom-requests/${id}/closure`, { version })
export const copyRequest = (id: string, requestKey: string) => post<CustomRequestVO>(`/me/custom-requests/${id}/copies`, { requestKey })
export const deleteRequest = (id: string, version: string) => request.delete(`/me/custom-requests/${id}`, { params: { version } })
export const getCandidateCreators = (categoryId: string, keyword = '') => get<PageVO<CreatorPublicVO>>('/creators', { categoryId, keyword, size: 50 })
export const openConversation = (id: string) => post<ConversationVO>(`/custom-requests/${id}/conversations`)
export const getConversations = (page = 1) => get<PageVO<ConversationVO>>('/me/conversations', { page })
export const getChatUnread = () => get<{ count: number }>('/me/conversations/unread-count')
export const getConversation = (id: string) => get<ConversationVO>(`/conversations/${id}`)
export const getMessages = (id: string, cursor?: { beforeSeq?: string; afterSeq?: string }) => get<{ items: ChatMessageVO[]; hasMore: boolean }>(`/conversations/${id}/messages`, cursor)
export const sendMessage = (id: string, data: { clientMessageKey: string; content: string; imageIds: string[]; referencedNodeId?: string }) => post<ChatMessageVO>(`/conversations/${id}/messages`, data)
export const readConversation = (id: string, lastReadSeq: string) => put<unknown>(`/conversations/${id}/read-cursor`, { lastReadSeq })
/** 每次续签都由服务端重新验证用途与当前订单/会话参与方。 */
export const getPrivateImage = (id: string, scope: 'request' | 'chat' | 'quote' | 'progress' | 'refund') => get<ImageVO>(`/${({ request: 'custom-request-images', chat: 'conversation-images', quote: 'quote-images', progress: 'order-progress-images', refund: 'order-refund-images' })[scope]}/${id}`)
export async function uploadPrivateImage(file: File, conversationId?: string) {
  const data = new FormData(); data.append('file', file)
  return (await request.post<ApiResult<ImageVO>>(conversationId ? `/conversations/${conversationId}/images` : '/custom-request-images', data, { timeout: 60_000 })).data.data
}
