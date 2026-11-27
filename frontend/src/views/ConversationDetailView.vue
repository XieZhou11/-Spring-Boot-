<script setup lang="ts">
import { usePageActivation } from '@/utils/pageActivation'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import ChatAvatar from '@/components/ChatAvatar.vue'
import { useListQuery } from '@/composables/useListQuery'
import PrivateImage from '@/components/PrivateImage.vue'
import PrivateImagePicker from '@/components/PrivateImagePicker.vue'
import { getConversation, getMessages, readConversation, sendMessage } from '@/api/customRequest'
import { getOrder } from '@/api/quote'
import { useNotificationsStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { requestStatus } from '@/utils/customRequest'
import { orderStatus, progressNodeName } from '@/utils/quote'
import { readConversationDraft, saveConversationDraft } from '@/utils/conversationDraft'
import { ApiError } from '@/utils/request'
import type { ChatMessageVO, ConversationVO } from '@/types/customRequest'
import '@/assets/styles/custom-request.css'
import { useConfirmation } from '@/composables/useConfirmation'
import { hasOrderReturn } from '@/utils/orderDetail'

const confirm = useConfirmation()
const route = useRoute(); const router = useRouter(); const notifications = useNotificationsStore(); const auth = useAuthStore()
const { page } = useListQuery()
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
const orderEnded = computed(() => ['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(conversation.value?.orderStatus || ''))
const canReturnToOrder = computed(() => !!(conversation.value?.orderId && hasOrderReturn(router, route, conversation.value.orderId)))
function returnToOrder() { if (canReturnToOrder.value) router.back() }
/** 交易卡片：订单会话优先展示订单快照，其次需求状态；两者都没有时不渲染。 */
const tradeCard = computed(() => {
  const current = conversation.value
  if (!current) return null
  if (current.orderId && (current.orderTitle || current.orderStatus)) {
    return {
      kind: 'order' as const,
      title: current.orderTitle || '关联订单',
      amount: current.orderAmount,
      status: current.orderStatus,
      statusText: orderStatus[current.orderStatus || ''] || current.orderStatus || '',
      coverImageId: current.orderCoverImageId,
      orderId: current.orderId,
      pendingPay: current.orderStatus === 'PENDING_PAY',
      action: current.orderStatus === 'PENDING_PAY' ? '去支付' : '查看订单',
    }
  }
  if (current.requestId && (current.requestTitle || current.requestStatus)) {
    return {
      kind: 'request' as const,
      title: current.requestTitle || '关联需求',
      amount: null,
      status: current.requestStatus,
      statusText: requestStatus[current.requestStatus || ''] || current.requestStatus || '',
      coverImageId: null,
      requestId: current.requestId,
      action: '查看需求',
    }
  }
  return null
})
/** 聊天时间分组：同一分钟内的连续消息只显示一次时间，跨天插入日期分隔。 */
const messageGroups = computed(() => {
  const groups: Array<{ key: string; time: string; timestamp: number; dayKey: string; dayLabel: string; messages: ChatMessageVO[] }> = []
  for (const message of messages.value) {
    const date = new Date(message.createdAt)
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const minuteKey = `${dayKey}-${Math.floor(date.getTime() / 60000)}`
    const existing = groups.at(-1)
    if (!existing || existing.key !== minuteKey) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0)
      const dayLabel = dayStart.getTime() === today.getTime() ? '今天'
        : dayStart.getTime() === today.getTime() - 86_400_000 ? '昨天'
          : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' }).format(date)
      groups.push({ key: minuteKey, time: new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(date), timestamp: date.getTime(), dayKey, dayLabel, messages: [message] })
    }
    else if (existing.dayKey !== dayKey) { groups.push({ ...existing, key: minuteKey, messages: [message] }) }
    else existing.messages.push(message)
  }
  return groups
})
function showDayDivider(index: number) { return index === 0 || messageGroups.value[index - 1].dayKey !== messageGroups.value[index].dayKey }
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
async function canLeave() {
  if (!auth.session) return true
  if (sending.value || uploading.value) return false
  const allowed = !(content.value || imageIds.value.length || uncertain.value) || await confirm({ title: '离开会话？', message: '还有未发送或结果未确认的消息。草稿将在本次使用期间保留。', confirmLabel: '确认离开' })
  if (allowed) keepDraft()
  return allowed
}
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(to => to.params.id === route.params.id || canLeave())
onBeforeUnmount(() => { keepDraft(); disposed = true; generation++; referenceRevision++; observer?.disconnect(); clearTimeout(readTimer) })
usePageActivation(focused)
</script>
<template>
  <div class="conversation-current">
    <button
      v-if="canReturnToOrder"
      type="button"
      class="conversation-order-back button-secondary"
      @click="returnToOrder"
    >
      <span aria-hidden="true">←</span> 返回订单
    </button>
    <RouterLink
      :to="{ path: '/messages/conversations', query: page > 1 ? { page: String(page) } : undefined }"
      class="conversation-back"
    >← 返回会话列表</RouterLink>
    <header class="conversation-header">
      <div>
        <h2>{{ conversation?.otherNickname || '交易会话' }}</h2>
      </div>
      <div class="conversation-tools">
        <button
          type="button"
          class="button-secondary"
          :disabled="loading"
          @click="refresh()"
        >
          刷新消息
        </button>
        <button
          v-if="!notifications.connected"
          type="button"
          class="inline-button conversation-reconnect"
          @click="notifications.reconnect"
        >
          重新连接
        </button>
      </div>
    </header>
    <!-- 交易上下文常驻卡片：买家进入会话即可看到成交对象、金额和当前状态。 -->
    <section
      v-if="tradeCard"
      class="conversation-trade-card"
      :aria-label="tradeCard.kind === 'order' ? '关联订单信息' : '关联需求信息'"
    >
      <PrivateImage
        v-if="tradeCard.coverImageId"
        :image-id="tradeCard.coverImageId"
        scope="stock"
        :order-id="tradeCard.orderId"
        :label="`${tradeCard.title}封面`"
        class="trade-card-cover"
      />
      <div class="trade-card-main">
        <RouterLink
          class="trade-card-title"
          :to="tradeCard.kind === 'order' ? `/orders/${tradeCard.orderId}` : `/requests/${tradeCard.requestId}`"
        >{{ tradeCard.title }}</RouterLink>
        <div class="trade-card-meta">
          <span
            class="trade-card-status"
            :class="{ 'is-pay': tradeCard.pendingPay }"
          >{{ tradeCard.statusText }}</span>
          <span
            v-if="tradeCard.amount"
            class="trade-card-amount"
          >¥ {{ tradeCard.amount }}</span>
        </div>
      </div>
      <RouterLink
        class="button-primary trade-card-action"
        :to="tradeCard.kind === 'order' ? `/orders/${tradeCard.orderId}` : `/requests/${tradeCard.requestId}`"
      >{{ tradeCard.action }} <AppIcon name="arrow" /></RouterLink>
    </section>
    <p
      v-if="error || loadError"
      class="form-alert"
      role="alert"
    >
      {{ error || loadError }}
    </p>
    <p
      v-if="readError"
      class="chat-state"
      role="status"
    >
      <button
        type="button"
        class="inline-button"
        @click="markRead"
      >
        {{ readError }}
      </button>
    </p>
    <p
      v-if="!conversation && loading"
      class="account-loading"
      role="status"
    >
      正在读取会话…
    </p>
    <div
      v-if="conversation"
      class="chat-panel"
    >
      <p
        v-if="!conversation.canSend"
        class="chat-state"
        role="status"
      >
        <AppIcon name="lock" />
        {{ conversation.sendDisabledReason || conversation.archiveReason || '会话已归档，只能查阅历史记录。' }}
      </p>
      <p
        v-else-if="orderEnded"
        class="chat-state"
      >
        订单已结束，双方仍可沟通与补充证据。
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
          type="button"
          class="inline-button chat-older"
          :disabled="olderLoading"
          @click="older"
        >
          {{ olderLoading ? '读取中…' : '加载更早消息' }}
        </button><p
          v-if="!messages.length"
          class="chat-empty"
        >
          {{ loading ? '正在读取消息…' : '暂无消息' }}
        </p><template
          v-for="(group, groupIndex) in messageGroups"
          :key="group.key"
        >
          <div
            v-if="showDayDivider(groupIndex)"
            class="chat-day-divider"
            role="separator"
          >
            {{ group.dayLabel }}
          </div>
          <div class="chat-group-time">
            {{ group.time }}
          </div>
          <article
            v-for="message in group.messages"
            :key="message.id"
            :data-seq="message.seqNo"
            class="chat-message"
            :class="{ mine: message.senderId === auth.session?.userId }"
          >
            <ChatAvatar
              class="chat-message-avatar"
              :conversation="conversation"
              :mine="message.senderId === auth.session?.userId"
              :label="message.senderId === auth.session?.userId ? '我的头像' : `${conversation.otherNickname}的头像`"
            />
            <div class="chat-message-body">
              <div class="chat-bubble">
                <RouterLink
                  v-if="message.referencedNodeId && conversation.orderId"
                  class="progress-reference"
                  :to="`/orders/${conversation.orderId}#progress-${message.referencedNodeId}`"
                >引用进度：{{ progressNodeName[message.referencedNodeCode || ''] || '制作节点' }} ↗</RouterLink>
                <p v-if="message.content">
                  {{ message.content }}
                </p>
                <div
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
                </div>
              </div>
            </div>
          </article>
        </template>
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
        <label class="chat-input-field">
          <span class="visually-hidden">沟通内容</span>
          <textarea
            v-model="content"
            rows="2"
            maxlength="500"
            :disabled="sending || uncertain"
            placeholder="输入消息…"
            aria-label="沟通内容"
          />
        </label>
        <div class="chat-compose-toolbar">
          <PrivateImagePicker
            v-model="imageIds"
            label="消息图片"
            compact
            :max="3"
            :conversation-id="conversation.id"
            :disabled="sending || uncertain || !conversation.canSend"
            @uploading="uploading = $event"
          />
          <span class="field-help">{{ content.length }} / 500</span>
          <button
            type="submit"
            class="button-primary chat-send-button"
            :disabled="sending || uploading || referenceLoading || !!referenceError"
          >
            {{ sending ? '正在发送…' : uncertain ? '重试确认发送' : '发送' }}
            <AppIcon name="arrow" />
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
