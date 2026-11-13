import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/auth'
import type { LoginDTO, SessionVO } from '@/types/auth'
import { advanceAuthenticationRevision, ApiError } from '@/utils/request'

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

  return { session, restoreSession, signIn, signOut, clearSession }
})
