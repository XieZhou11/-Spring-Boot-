import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getUnreadCount } from '@/api/creator'
import { getChatUnread } from '@/api/customRequest'
import type { NotificationVO } from '@/types/creator'
import { useAuthStore } from '@/stores/auth'

/** 全应用共享一个原生 WebSocket，断线后重连并从持久化接口核对未读。 */
export const useNotificationsStore = defineStore('notifications', () => {
  const unreadCount = ref(0)
  const chatUnreadCount = ref(0)
  const chatRevision = ref(0)
  // 批次只保存本轮受影响会话，避免长期积累每个会话的版本状态。
  const chatUpdate = ref<{ all: boolean; conversationIds: string[] }>({ all: false, conversationIds: [] })
  const revision = ref(0)
  const connected = ref(false)
  const connectionMessage = ref('')
  let socket: WebSocket | undefined
  let userId: string | undefined
  let chatEnabled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let heartbeatTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeatTimeout: ReturnType<typeof setTimeout> | undefined
  let chatTimer: ReturnType<typeof setTimeout> | undefined
  const changedConversations = new Set<string>()
  let refreshAllConversations = false
  let requestChanged = false
  let retry = 0
  let generation = 0
  let chatUnreadRevision = 0

  /** 连续推送合并为一次列表刷新，详情仅补拉当前会话；重连要求所有已打开页面核对。 */
  function queueChatUpdate(conversationId?: string, all = false, requestUpdated = false) {
    if (!chatEnabled) return
    if (conversationId) changedConversations.add(conversationId)
    refreshAllConversations ||= all
    requestChanged ||= requestUpdated
    if (chatTimer !== undefined) return
    const expected = generation
    chatTimer = setTimeout(() => {
      chatTimer = undefined
      if (expected !== generation || !userId || !chatEnabled) return
      chatUpdate.value = { all: refreshAllConversations, conversationIds: [...changedConversations] }
      chatRevision.value++
      if (requestChanged) window.dispatchEvent(new Event('custom-request-updated'))
      changedConversations.clear()
      refreshAllConversations = false
      requestChanged = false
    }, 100)
  }

  function clearHeartbeat() {
    clearTimeout(heartbeatTimer)
    clearTimeout(heartbeatTimeout)
    heartbeatTimer = undefined
    heartbeatTimeout = undefined
  }

  async function refreshUnread() {
    const expected = generation
    try {
      const result = await getUnreadCount()
      if (expected === generation && userId) unreadCount.value = result.count
    } catch {
      // 通知读取失败不阻断当前业务表单，通知页仍显示具体请求错误。
    }
  }

  async function refreshChatUnread() {
    if (!userId || !chatEnabled) return
    const expected = generation
    const expectedUnread = ++chatUnreadRevision
    try { const result = await getChatUnread(); if (expected === generation && expectedUnread === chatUnreadRevision && userId && chatEnabled) chatUnreadCount.value = result.count }
    catch { /* 聊天未读查询失败不阻断当前表单，消息中心提供重试。 */ }
  }

  function disconnect() {
    generation++
    userId = undefined
    chatEnabled = false
    clearTimeout(timer)
    clearHeartbeat()
    clearTimeout(chatTimer)
    chatTimer = undefined
    changedConversations.clear()
    refreshAllConversations = false
    requestChanged = false
    socket?.close()
    socket = undefined
    connected.value = false
    connectionMessage.value = ''
    unreadCount.value = 0
    chatUnreadCount.value = 0
    chatUnreadRevision++
  }

  function connect(id: string, allowChat: boolean) {
    if (userId === id) {
      if (chatEnabled === allowChat) return
      // 同一账号的管理员资格可在恢复会话时变化，旧聊天响应和合并事件不得泄漏到新范围。
      chatEnabled = allowChat
      chatUnreadRevision++
      chatUnreadCount.value = 0
      clearTimeout(chatTimer)
      chatTimer = undefined
      changedConversations.clear()
      refreshAllConversations = false
      requestChanged = false
      chatUpdate.value = { all: false, conversationIds: [] }
      if (allowChat) {
        void refreshChatUnread()
        queueChatUpdate(undefined, true)
      }
      return
    }
    disconnect()
    userId = id
    chatEnabled = allowChat
    retry = 0
    // 持久化未读独立于实时握手，连接失败时首页仍能显示已有消息。
    void refreshUnread()
    void refreshChatUnread()
    open()
  }

  /** 自动重试有界；手动重连或页面重新激活时先核验原会话是否仍有效。 */
  async function reconnect() {
    if (!userId || socket?.readyState === WebSocket.CONNECTING || socket?.readyState === WebSocket.OPEN) return
    const expected = generation
    try {
      const session = await useAuthStore().restoreSession(true)
      if (expected !== generation || !userId) return
      if (!session || session.userId !== userId) return disconnect()
      clearTimeout(timer)
      retry = 0
      connectionMessage.value = ''
      open()
    } catch {
      if (expected === generation && userId) connectionMessage.value = '暂时无法核验连接，请稍后重新连接。已保存的消息仍可查询。'
    }
  }

  function open() {
    if (!userId || socket?.readyState === WebSocket.CONNECTING || socket?.readyState === WebSocket.OPEN) return
    const expected = generation
    const endpoint = new URL(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:18080/api', location.origin)
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:'
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/ws`
    const current = new WebSocket(endpoint)
    socket = current
    let openedAt = 0
    /** 主动释放失联连接，不等待可能永远无法完成的关闭握手；旧事件不再参与重试。 */
    const lost = (code?: number) => {
      if (expected !== generation || !userId || socket !== current) return
      socket = undefined
      connected.value = false
      clearHeartbeat()
      current.onopen = null
      current.onmessage = null
      current.onclose = null
      current.onerror = null
      current.close()
      if (code === 1008) {
        connectionMessage.value = '实时连接已关闭，请核对登录状态或重新连接。'
        void useAuthStore().restoreSession(true).catch(() => { /* 保持关闭，等待手动核验。 */ })
        return
      }
      if (retry >= 5) {
        connectionMessage.value = '实时连接暂时不可用，已停止自动重试。可刷新或重新连接，已保存的消息仍可查询。'
        return
      }
      connectionMessage.value = '实时连接中断，正在尝试恢复。已保存的消息仍可查询。'
      timer = setTimeout(async () => {
        try {
          const session = await useAuthStore().restoreSession(true)
          if (expected !== generation || !userId) return
          if (!session || session.userId !== userId) return disconnect()
          open()
        } catch {
          if (expected === generation && userId) connectionMessage.value = '暂时无法核验连接，请刷新或重新连接。已保存的消息仍可查询。'
        }
      }, Math.min(16_000, 1000 * 2 ** retry++))
    }
    // 浏览器不暴露协议层Ping；应用心跳用于识别未触发onclose的无响应连接。
    const ping = () => {
      if (expected !== generation || socket !== current) return
      try {
        current.send('PING')
        heartbeatTimeout = setTimeout(() => lost(), 10_000)
      } catch { lost() }
    }
    current.onopen = () => {
      if (expected !== generation || socket !== current) return current.close()
      connected.value = true
      connectionMessage.value = ''
      openedAt = Date.now()
      revision.value++
      queueChatUpdate(undefined, true)
      void refreshUnread()
      void refreshChatUnread()
      ping()
    }
    current.onmessage = (event: MessageEvent<string>) => {
      if (expected !== generation || socket !== current) return
      try {
        const payload = JSON.parse(event.data) as { type: string; count?: number; notification?: NotificationVO; conversationId?: string; orderId?: string; userId?: string; message?: { conversationId?: string } }
        if (payload.type === 'PONG' && heartbeatTimeout !== undefined) {
          clearTimeout(heartbeatTimeout)
          heartbeatTimeout = undefined
          // 必须在持续连接后收到有效回应才恢复额度，避免仅握手成功的故障反复归零。
          if (Date.now() - openedAt >= 30_000) retry = 0
          heartbeatTimer = setTimeout(ping, 20_000)
          return
        }
        if (payload.type === 'UNREAD_UPDATED' && typeof payload.count === 'number') {
          unreadCount.value = payload.count
          revision.value++
        }
        if (payload.type === 'SYSTEM_NOTIFICATION') {
          revision.value++
          void refreshUnread()
          // 资料页自行重新核验资格，不把推送内容当作认证权威数据。
          if (payload.notification?.businessReference?.type === 'WORK') window.dispatchEvent(new Event('work-updated'))
          else if (payload.notification?.businessReference?.type === 'CUSTOM_REQUEST') window.dispatchEvent(new Event('custom-request-updated'))
          else if (payload.notification?.businessReference?.type === 'QUOTE') { window.dispatchEvent(new Event('quote-updated')); window.dispatchEvent(new Event('custom-request-updated')) }
          else if (payload.notification?.businessReference?.type === 'ORDER') { window.dispatchEvent(new Event('order-updated')); window.dispatchEvent(new Event('quote-updated')); window.dispatchEvent(new Event('custom-request-updated')) }
          else if (payload.notification?.businessReference?.type === 'CREATOR_APPLICATION') window.dispatchEvent(new Event('creator-certification-updated'))
        }
        if (payload.type === 'CHAT_UNREAD_UPDATED' && typeof payload.count === 'number' && chatEnabled) { chatUnreadRevision++; chatUnreadCount.value = payload.count }
        if (['CHAT_MESSAGE', 'CHAT_READ', 'CONVERSATION_UPDATED'].includes(payload.type)) {
          // 订单履约推送也发给操作者的其他端，先重新查询订单，不能只刷新会话标题。
          if (payload.type === 'CONVERSATION_UPDATED' && typeof payload.orderId === 'string') window.dispatchEvent(new Event('order-updated'))
          // 对方已读不改变本人的游标或未读；本人其他端的已读仍须刷新。
          if (payload.type === 'CHAT_READ' && payload.userId !== userId) return
          const conversationId = payload.type === 'CHAT_MESSAGE' ? payload.message?.conversationId : payload.conversationId
          if (typeof conversationId === 'string') queueChatUpdate(conversationId, false, payload.type === 'CONVERSATION_UPDATED')
        }
      } catch {
        // 忽略无法识别的推送，不影响离线列表读取。
      }
    }
    current.onclose = event => lost(event.code)
    current.onerror = () => lost()
  }

  return { unreadCount, chatUnreadCount, revision, chatRevision, chatUpdate, connected, connectionMessage, connect, disconnect, reconnect, refreshUnread, refreshChatUnread }
})
