/** 会话草稿仅存本次应用内存，不把聊天正文、图片签名或订单隐私写入浏览器存储。 */
export interface ConversationDraft {
  /** 尚未手动发送的正文。 */
  content: string
  /** 当前草稿的会话图片编号。 */
  imageIds: string[]
  /** 用户手动选择的同订单节点引用。 */
  referencedNodeId?: string
  /** 网络结果未知时冻结的原消息与幂等键。 */
  attempt?: { clientMessageKey: string; content: string; imageIds: string[]; referencedNodeId?: string }
  /** 原消息是否仍需确认发送结果。 */
  uncertain: boolean
}
const drafts = new Map<string, ConversationDraft>()
const key = (userId: string, conversationId: string) => `${userId}:${conversationId}`
export function saveConversationDraft(userId: string, conversationId: string, draft: ConversationDraft) { drafts.set(key(userId, conversationId), structuredClone(draft)) }
export function readConversationDraft(userId: string, conversationId: string) { const draft = drafts.get(key(userId, conversationId)); return draft ? structuredClone(draft) : undefined }
export function clearUserConversationDrafts(userId?: string) { if (userId) for (const draftKey of drafts.keys()) if (draftKey.startsWith(`${userId}:`)) drafts.delete(draftKey) }
