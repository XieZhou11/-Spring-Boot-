import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/auth'
import { switchActiveRole } from '@/api/creator'
import type { LoginDTO, SessionVO } from '@/types/auth'
import { advanceAuthenticationRevision, ApiError } from '@/utils/request'
import { clearUserPaymentAttempts } from '@/utils/orderPayment'
import { clearUserFulfillmentAttempts } from '@/utils/orderFulfillment'
import { clearUserConversationDrafts } from '@/utils/conversationDraft'

/** 只在内存缓存本人会话；刷新及业务页导航均向服务端核验 Cookie。 */
export const useAuthStore = defineStore('auth', () => {
  const session = ref<SessionVO | null>(null)
  let initialized = false
  let revision = 0
  let restoring: { revision: number; promise: Promise<SessionVO | null> } | undefined

  function advanceRevision() {
    revision++
    advanceAuthenticationRevision()
  }

  function clearSession() {
    clearUserPaymentAttempts(session.value?.userId)
    clearUserFulfillmentAttempts(session.value?.userId)
    clearUserConversationDrafts(session.value?.userId)
    advanceRevision()
    session.value = null
    initialized = true
  }

  async function restoreSession(force = false) {
    if (restoring?.revision === revision) return restoring.promise
    if (initialized && !force) return session.value
    const startedRevision = revision
    const pending = (async () => {
      try {
        const current = await api.getCurrentSession()
        // 登录、退出或重置期间到达的旧请求，不得覆盖之后的身份。
        if (startedRevision !== revision) return session.value
        session.value = current
        initialized = true
        return session.value
      } catch (error) {
        if (startedRevision !== revision) return session.value
        if (error instanceof ApiError && error.status === 401) {
          clearSession()
          return null
        }
        throw error
      } finally {
        if (restoring?.revision === startedRevision) restoring = undefined
      }
    })()
    restoring = { revision: startedRevision, promise: pending }
    return pending
  }

  async function signIn(input: LoginDTO) {
    advanceRevision()
    const current = await api.login(input)
    if (session.value?.userId !== current.userId) { clearUserPaymentAttempts(session.value?.userId); clearUserFulfillmentAttempts(session.value?.userId); clearUserConversationDrafts(session.value?.userId) }
    advanceRevision()
    session.value = current
    initialized = true
  }

  async function signOut() {
    advanceRevision()
    try {
      await api.logout()
    } catch (error) {
      // 服务端已失效等同于退出成功；网络失败时保留会话，允许重试。
      if (!(error instanceof ApiError && error.status === 401)) throw error
    }
    clearSession()
  }

  /** 当前身份由服务端校验资格，不能仅更新页面角色。 */
  async function switchRole(role: 'BUYER' | 'CREATOR') {
    const current = await switchActiveRole(role)
    advanceRevision()
    session.value = current
  }

  return { session, restoreSession, signIn, signOut, clearSession, switchRole }
})
