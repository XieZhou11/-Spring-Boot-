<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import PrivateImage from '@/components/PrivateImage.vue'
import PrivateImagePicker from '@/components/PrivateImagePicker.vue'
import { getConversation, getMessages, readConversation, sendMessage } from '@/api/customRequest'
import { getOrder } from '@/api/quote'
import { useNotificationsStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { formatTime } from '@/utils/creator'
import { orderStatus, progressNodeName } from '@/utils/quote'
import { readConversationDraft, saveConversationDraft } from '@/utils/conversationDraft'
import { ApiError } from '@/utils/request'
import type { ChatMessageVO, ConversationVO } from '@/types/customRequest'
import '@/assets/styles/custom-request.css'
import '@/assets/styles/quote.css'
const route = useRoute(); const notifications = useNotificationsStore(); const auth = useAuthStore()
const conversation = ref<ConversationVO>(); const messages = ref<ChatMessageVO[]>([]); const hasOlder = ref(false)
const loading = ref(false); const olderLoading = ref(false); const sending = ref(false); const uploading = ref(false); const uncertain = ref(false)
const content = ref(''); const imageIds = ref<string[]>([]); const error = ref(''); const loadError = ref(''); const readError = ref(''); const transcript = ref<HTMLElement>()
const referencedNode = ref<{ id: string; nodeCode: string }>(); const referenceLoading = ref(false); const referenceError = ref('')
let referenceRevision = 0; let restoredReferenceId: string | undefined; let activeDraftId = ''; let activeDraftUserId = ''
let generation = 0; let refreshing = false; let refreshAgain = false; let disposed = false; let observer: IntersectionObserver | undefined
// HTTP已补齐游标独立于乐观合并的发送结果，避免自己的较新消息跳过断线缺口。
let syncCursor: string | undefined
let readTimer: ReturnType<typeof setTimeout> | undefined; let desiredRead = '0'; let acknowledgedRead = '0'; let readingGeneration: number | undefined
let attempt: { clientMessageKey: string; content: string; imageIds: string[]; referencedNodeId?: string } | undefined
const id = () => String(route.params.id)
/** 引用只附加到原草稿，不替换正文，也不在跳转后自动发送消息。 */
async function resolveReference() {
  const current = ++referenceRevision
  const requested = uncertain.value ? attempt?.referencedNodeId : typeof route.query.progressNodeId === 'string' ? route.query.progressNodeId : restoredReferenceId
  referencedNode.value = undefined; referenceError.value = ''; referenceLoading.value = false
  if (!requested || !conversation.value?.orderId) return
  referenceLoading.value = true
  try {
    const detail = await getOrder(conversation.value.orderId)
    if (current !== referenceRevision) return
    const node = detail.progressNodes.find(value => value.id === requested)
    if (!node) { referenceError.value = '所引用的进度不属于当前订单，未附加引用。'; return }
    referencedNode.value = { id: node.id, nodeCode: node.nodeCode }
  } catch (failure) { if (current === referenceRevision) referenceError.value = failure instanceof Error ? failure.message : '节点引用读取失败，请重试' }
  finally { if (current === referenceRevision) referenceLoading.value = false }
}
function keepDraft() {
  if (activeDraftUserId && activeDraftUserId === auth.session?.userId && activeDraftId) saveConversationDraft(activeDraftUserId, activeDraftId, { content: content.value, imageIds: [...imageIds.value], referencedNodeId: referencedNode.value?.id, attempt: attempt ? { ...attempt, imageIds: [...attempt.imageIds] } : undefined, uncertain: uncertain.value })
}
/** 唯一编号去重，字符串大整数比较避免序号精度丢失。 */
function merge(items: ChatMessageVO[]) { const map = new Map(messages.value.map(message => [message.id, message])); for (const message of items) map.set(message.id, message); messages.value = [...map.values()].sort((a, b) => BigInt(a.seqNo) < BigInt(b.seqNo) ? -1 : 1) }
function atBottom() { const node = transcript.value; return !node || node.scrollHeight - node.scrollTop - node.clientHeight < 70 }
async function observe(scrollBottom: boolean) {
  const expected = generation
  await nextTick()
  if (disposed || expected !== generation) return
  if (scrollBottom && transcript.value) transcript.value.scrollTop = transcript.value.scrollHeight
  observer?.disconnect()
  // 只把在当前可见窗口实际出现的消息推进已读；隐藏标签页不消耗未读。
  observer = new IntersectionObserver(entries => {
    if (expected !== generation || document.visibilityState !== 'visible' || !document.hasFocus()) return
    for (const entry of entries) { const seq = (entry.target as HTMLElement).dataset.seq; if (entry.isIntersecting && seq && BigInt(seq) > BigInt(desiredRead)) desiredRead = seq }
    clearTimeout(readTimer); readTimer = setTimeout(() => void markRead(), 150)
  }, { threshold: 0.15 })
  transcript.value?.querySelectorAll('[data-seq]').forEach(node => observer!.observe(node))
}
async function markRead() {
  if (readingGeneration === generation || disposed || !conversation.value || BigInt(desiredRead) <= BigInt(acknowledgedRead) || document.visibilityState !== 'visible' || !document.hasFocus()) return
  const current = generation; const target = desiredRead; readingGeneration = current
  try { await readConversation(id(), target); if (current === generation) { acknowledgedRead = target; readError.value = ''; void notifications.refreshChatUnread() } }
  catch { if (current === generation) readError.value = '已读状态同步失败，点击重试。' }
  finally { if (readingGeneration === current) readingGeneration = undefined; if (current === generation && !readError.value && BigInt(desiredRead) > BigInt(acknowledgedRead)) void markRead() }
}
/** 重连或推送只触发持久化补拉；分页补齐断线期间所有消息后再更新界面。 */
async function refresh(initial = false) {
  if (refreshing) { refreshAgain = true; return }
  refreshing = true; const current = generation; const shouldScroll = initial || atBottom(); loading.value = true
  try {
    const detail = await getConversation(id())
    if (current !== generation) return
    const previousOrderId = conversation.value?.orderId
    conversation.value = detail; acknowledgedRead = detail.readSeq || '0'
    if (initial || previousOrderId !== detail.orderId) void resolveReference()
    let cursor = initial ? undefined : syncCursor
    do {
      const result = await getMessages(id(), cursor ? { afterSeq: cursor } : undefined)
      if (current !== generation) return
      merge(result.items)
      syncCursor = result.items.at(-1)?.seqNo || cursor || '0'
      if (!cursor) { hasOlder.value = result.hasMore; break }
      if (!result.hasMore || !result.items.length) break
      cursor = result.items.at(-1)!.seqNo
    } while (!disposed)
    loadError.value = ''; await observe(shouldScroll)
  } catch (failure) { if (current === generation) loadError.value = failure instanceof Error ? failure.message : '消息读取失败' }
  finally { refreshing = false; loading.value = false; if (refreshAgain && !disposed) { refreshAgain = false; void refresh() } }
}
async function older() {
  if (!messages.value.length || olderLoading.value) return
  const current = generation; olderLoading.value = true
  const node = transcript.value; const height = node?.scrollHeight || 0
  try { const result = await getMessages(id(), { beforeSeq: messages.value[0]!.seqNo }); if (current !== generation) return; merge(result.items); hasOlder.value = result.hasMore; await observe(false); if (node) node.scrollTop += node.scrollHeight - height }
  catch (failure) { if (current === generation) loadError.value = failure instanceof Error ? failure.message : '历史消息读取失败' }
  finally { olderLoading.value = false }
}
async function send() {
  if (sending.value || uploading.value || referenceLoading.value || referenceError.value || (!conversation.value?.canSend && !uncertain.value)) return
  error.value = ''
  if (!uncertain.value) {
    const body = { content: content.value.trim(), imageIds: [...imageIds.value], ...(referencedNode.value ? { referencedNodeId: referencedNode.value.id } : {}) }
    if ((!body.content && !body.imageIds.length) || body.content.length > 500) { error.value = '请输入 1—500 字文字，或上传图片'; return }
    if (!attempt || attempt.content !== body.content || JSON.stringify(attempt.imageIds) !== JSON.stringify(body.imageIds) || attempt.referencedNodeId !== body.referencedNodeId) attempt = { ...body, clientMessageKey: crypto.randomUUID() }
  }
  if (!attempt) return
  sending.value = true; const current = generation
  try {
    const result = await sendMessage(id(), attempt)
    if (current !== generation) return
    merge([result]); content.value = ''; imageIds.value = []; attempt = undefined; uncertain.value = false; referencedNode.value = undefined; restoredReferenceId = undefined; keepDraft()
    await observe(true); void refresh()
  } catch (failure) {
    if (current !== generation) return
    uncertain.value = !(failure instanceof ApiError) || !failure.status || failure.status >= 500
    error.value = `${failure instanceof Error ? failure.message : '发送失败'}${uncertain.value ? '。发送结果未知，请重试确认；同一条消息不会重复发送。' : '。输入已保留。'}`
    if (failure instanceof ApiError && failure.retryAfter) error.value += ` 请在 ${failure.retryAfter} 秒后重试。`
    if (!uncertain.value) void refresh()
  } finally { sending.value = false; keepDraft() }
}
function focused() { if (document.visibilityState === 'visible') { void refresh(); void observe(false); if (!notifications.connected) void notifications.reconnect() } }
watch(() => notifications.chatUpdate, update => {
  if (update.all || update.conversationIds.includes(id())) void refresh()
})
watch([() => route.params.id, () => auth.session?.userId], () => {
  if (!route.path.startsWith('/messages/conversations/')) return
  activeDraftId = id(); activeDraftUserId = auth.session?.userId || ''
  generation++; referenceRevision++; observer?.disconnect(); clearTimeout(readTimer); syncCursor = undefined; messages.value = []; conversation.value = undefined; content.value = ''; imageIds.value = []; uploading.value = false; error.value = ''; loadError.value = ''; readError.value = ''; referencedNode.value = undefined; referenceError.value = ''; referenceLoading.value = false; attempt = undefined; uncertain.value = false; desiredRead = '0'; acknowledgedRead = '0'
  const draft = auth.session?.userId ? readConversationDraft(auth.session.userId, id()) : undefined
  if (draft) { content.value = draft.content; imageIds.value = [...draft.imageIds]; attempt = draft.attempt; uncertain.value = draft.uncertain; restoredReferenceId = draft.referencedNodeId }
  else restoredReferenceId = undefined
  if (activeDraftUserId) void refresh(true)
}, { immediate: true })
watch(() => route.query.progressNodeId, () => { if (conversation.value) void resolveReference() })
function canLeave() {
  if (!auth.session) return true
  if (sending.value || uploading.value) return false
  const allowed = !(content.value || imageIds.value.length || uncertain.value) || window.confirm('还有未发送或结果未确认的消息，确定离开？草稿将在本次使用期间保留。')
  if (allowed) keepDraft()
  return allowed
}
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(to => to.params.id === route.params.id || canLeave())
onMounted(() => { window.addEventListener('focus', focused); document.addEventListener('visibilitychange', focused) })
onBeforeUnmount(() => { keepDraft(); disposed = true; generation++; referenceRevision++; observer?.disconnect(); clearTimeout(readTimer); window.removeEventListener('focus', focused); document.removeEventListener('visibilitychange', focused) })
</script>
<template>
  <div class="conversation-current">
    <RouterLink
      to="/messages/conversations"
      class="conversation-back"
    >← 返回会话列表</RouterLink>
    <header class="work-section-heading">
      <div>
        <h1>{{ conversation?.otherNickname || '需求沟通' }}</h1><RouterLink
          v-if="conversation"
          :to="`/requests/${conversation.requestId}`"
        >{{ conversation.requestTitle }} ↗</RouterLink><p
          v-if="conversation?.orderId"
          class="field-help"
        >
          <RouterLink :to="`/orders/${conversation.orderId}`">关联订单：{{ conversation.orderTitle }} · {{ orderStatus[conversation.orderStatus || ''] || conversation.orderStatus }} ↗</RouterLink>
        </p>
      </div>
    </header>
    <p
      v-if="error || loadError"
      class="form-alert"
      role="alert"
    >
      {{ error || loadError }}
    </p><div class="queue-toolbar">
      <button
        class="button-secondary"
        :disabled="loading"
        @click="refresh()"
      >
        刷新消息
      </button><button
        v-if="!notifications.connected"
        class="inline-button"
        @click="notifications.reconnect"
      >
        重新连接
      </button><button
        v-if="readError"
        class="inline-button"
        @click="markRead"
      >
        {{ readError }}
      </button>
    </div>
    <div
      v-if="conversation"
      class="chat-panel"
    >
      <p
        v-if="!conversation.canSend"
        class="review-reason"
        role="status"
      >
        {{ conversation.sendDisabledReason || conversation.archiveReason || '会话已归档，只能查阅历史记录。' }}
      </p>
      <div
        ref="transcript"
        class="chat-transcript"
        role="log"
        aria-label="沟通消息"
        aria-live="polite"
        tabindex="0"
      >
        <button
          v-if="hasOlder"
          class="inline-button"
          :disabled="olderLoading"
          @click="older"
        >
          {{ olderLoading ? '读取中…' : '加载更早消息' }}
        </button><p
          v-if="!messages.length"
          class="muted"
        >
          {{ loading ? '正在读取消息…' : '还没有消息，聊聊制作细节吧。' }}
        </p><article
          v-for="message in messages"
          :key="message.id"
          :data-seq="message.seqNo"
          class="chat-message"
          :class="{ mine: message.senderId === auth.session?.userId }"
        >
          <header>{{ message.senderId === auth.session?.userId ? '我' : conversation.otherNickname }}</header><p v-if="message.content">
            {{ message.content }}
          </p><RouterLink
            v-if="message.referencedNodeId && conversation.orderId"
            class="progress-reference"
            :to="`/orders/${conversation.orderId}#progress-${message.referencedNodeId}`"
          >引用进度：{{ progressNodeName[message.referencedNodeCode || ''] || '制作节点' }} ↗</RouterLink><div
            v-if="message.imageIds.length"
            class="request-images"
          >
            <PrivateImage
              v-for="(imageId, index) in message.imageIds"
              :key="imageId"
              :image-id="imageId"
              scope="chat"
              :label="`消息图片 ${index + 1}`"
            />
          </div><time>{{ formatTime(message.createdAt) }}</time>
        </article>
      </div>
      <form
        v-if="conversation.canSend || uncertain"
        class="chat-compose"
        @submit.prevent="send"
      >
        <p
          v-if="referenceLoading"
          class="field-help"
        >
          正在核验节点引用…
        </p><p
          v-if="referenceError"
          class="form-alert"
          role="alert"
        >
          {{ referenceError }} <button
            type="button"
            class="inline-button"
            @click="resolveReference"
          >
            重新核验引用
          </button><button
            type="button"
            class="inline-button"
            @click="referenceError = ''; restoredReferenceId = undefined"
          >
            取消引用
          </button>
        </p>
        <div
          v-if="referencedNode"
          class="progress-reference"
        >
          引用进度：{{ progressNodeName[referencedNode.nodeCode] || referencedNode.nodeCode }}<button
            type="button"
            class="inline-button"
            :disabled="sending || uncertain"
            @click="referencedNode = undefined; restoredReferenceId = undefined"
          >
            移除引用
          </button>
        </div>
        <label class="work-field">沟通内容<textarea
          v-model="content"
          aria-label="沟通内容"
          rows="3"
          maxlength="500"
          :disabled="sending || uncertain"
          placeholder="说说你对制作的想法…"
        /></label><PrivateImagePicker
          v-model="imageIds"
          label="消息图片"
          :max="3"
          :conversation-id="conversation.id"
          :disabled="sending || uncertain || !conversation.canSend"
          @uploading="uploading = $event"
        /><div class="request-actions">
          <span class="field-help">{{ content.length }} / 500</span><button
            class="button-primary"
            :disabled="sending || uploading || referenceLoading || !!referenceError"
          >
            {{ sending ? '正在发送…' : uncertain ? '重试确认发送' : '发送消息' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
