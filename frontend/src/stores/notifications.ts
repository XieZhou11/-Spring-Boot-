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
  const revision = ref(0)
  const connected = ref(false)
  const connectionMessage = ref('')
  let socket: WebSocket | undefined
  let userId: string | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let stableTimer: ReturnType<typeof setTimeout> | undefined
  let retry = 0
  let generation = 0
  let chatUnreadRevision = 0

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
    const expected = generation
    const expectedUnread = ++chatUnreadRevision
    try { const result = await getChatUnread(); if (expected === generation && expectedUnread === chatUnreadRevision && userId) chatUnreadCount.value = result.count }
    catch { /* 聊天未读查询失败不阻断当前表单，消息中心提供重试。 */ }
  }

  function disconnect() {
    generation++
    userId = undefined
    clearTimeout(timer)
    clearTimeout(stableTimer)
    socket?.close()
    socket = undefined
    connected.value = false
    connectionMessage.value = ''
    unreadCount.value = 0
    chatUnreadCount.value = 0
    chatUnreadRevision++
  }

  function connect(id: string) {
    if (userId === id) return
    disconnect()
    userId = id
    retry = 0
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
      connectionMessage.value = '暂时无法核验连接，请稍后重新连接。已保存的通知仍可查询。'
    }
  }

  function open() {
    if (!userId || socket?.readyState === WebSocket.CONNECTING || socket?.readyState === WebSocket.OPEN) return
    const expected = generation
    const endpoint = new URL(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api', location.origin)
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:'
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/ws`
    const current = new WebSocket(endpoint)
    socket = current
    current.onopen = () => {
      if (expected !== generation || socket !== current) return current.close()
      connected.value = true
      connectionMessage.value = ''
      // 短暂建立后立即断开的连接，不能无限刷新重试额度。
      stableTimer = setTimeout(() => { if (expected === generation && socket === current) retry = 0 }, 30_000)
      revision.value++
      chatRevision.value++
      void refreshUnread()
      void refreshChatUnread()
    }
    current.onmessage = (event: MessageEvent<string>) => {
      if (expected !== generation || socket !== current) return
      try {
        const payload = JSON.parse(event.data) as { type: string; count?: number; notification?: NotificationVO }
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
          else if (payload.notification?.businessReference?.type === 'CREATOR_APPLICATION') window.dispatchEvent(new Event('creator-certification-updated'))
        }
        if (payload.type === 'CHAT_UNREAD_UPDATED' && typeof payload.count === 'number') { chatUnreadRevision++; chatUnreadCount.value = payload.count }
        if (['CHAT_MESSAGE', 'CHAT_READ', 'CONVERSATION_UPDATED'].includes(payload.type)) {
          chatRevision.value++
          if (payload.type === 'CONVERSATION_UPDATED') window.dispatchEvent(new Event('custom-request-updated'))
        }
      } catch {
        // 忽略无法识别的推送，不影响离线列表读取。
      }
    }
    current.onclose = (event) => {
      if (expected !== generation || !userId || socket !== current) return
      connected.value = false
      clearTimeout(stableTimer)
      socket = undefined
      // 服务端明确撤销凭证时停止自动重连，防止旧会话持续请求。
      if (event.code === 1008) {
        connectionMessage.value = '实时连接已关闭，请核对登录状态或重新连接。'
        void useAuthStore().restoreSession(true).catch(() => { /* 保持关闭，等待手动核验。 */ })
        return
      }
      if (retry >= 5) {
        connectionMessage.value = '实时连接暂时不可用，已停止自动重试。可刷新或重新连接，已保存的通知仍可查询。'
        return
      }
      connectionMessage.value = '实时连接中断，正在尝试恢复。已保存的通知仍可查询。'
      timer = setTimeout(async () => {
        try {
          const session = await useAuthStore().restoreSession(true)
          if (expected !== generation || !userId) return
          if (!session || session.userId !== userId) return disconnect()
          open()
        } catch {
          // 会话查询失败也消耗一次重试，不绕过凭证核验建立新连接。
          connectionMessage.value = '暂时无法核验连接，请刷新或重新连接。已保存的通知仍可查询。'
        }
      }, Math.min(16_000, 1000 * 2 ** retry++))
    }
    current.onerror = () => current.close()
    void refreshUnread()
    void refreshChatUnread()
  }

  return { unreadCount, chatUnreadCount, revision, chatRevision, connected, connectionMessage, connect, disconnect, reconnect, refreshUnread, refreshChatUnread }
})
