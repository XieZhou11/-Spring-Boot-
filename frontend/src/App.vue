<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { invalidPathResource, routeFeedback } from '@/router/routeFeedback'
import '@/assets/styles/creator.css'

const auth = useAuthStore()
const notifications = useNotificationsStore()
const router = useRouter()
const retrying = ref(false)
// 路由切换复用连接；同账号资格变化只更新聊天范围，管理员仍接收系统通知。
watch([() => auth.session?.userId, () => auth.session?.roles.includes('ADMIN')], ([id, admin]) => id ? notifications.connect(id, !admin) : notifications.disconnect(), { immediate: true })
window.addEventListener('creator-certification-updated', () => {
  if (auth.session) void auth.restoreSession(true).catch(() => { /* 下次导航会再次核验。 */ })
})

async function retryNavigation() {
  const feedback = routeFeedback.value
  if (!feedback || retrying.value) return
  if (feedback.kind === 'resource') {
    const target = new URL(router.resolve(feedback.path).href, window.location.href)
    // 同页面的锚点导航不会重新加载失败的模块，必须重新加载当前文档。
    if (target.href === window.location.href) window.location.reload()
    else if (target.pathname === window.location.pathname && target.search === window.location.search) {
      window.history.replaceState(window.history.state, '', target.href)
      window.location.reload()
    } else window.location.assign(target.href)
    return
  }
  retrying.value = true
  try { await router.push(feedback.path) }
  catch { /* 路由错误钩子负责更新反馈。 */ }
  finally { retrying.value = false }
}
</script>

<template>
  <section
    v-if="routeFeedback"
    class="navigation-feedback"
    aria-label="页面导航反馈"
  >
    <p role="alert">
      {{ routeFeedback.kind === 'connection' ? '暂时无法连接服务，请重试打开原页面。' : '页面资源暂时无法加载，请重试。' }}
    </p>
    <button
      type="button"
      class="button-secondary"
      :disabled="retrying"
      @click="retryNavigation"
    >
      {{ retrying ? '正在重试…' : '重试打开页面' }}
    </button>
  </section>
  <RouterView v-slot="{ Component, route }">
    <main
      v-if="route.name === 'not-found'"
      class="route-missing"
    >
      <h1>{{ invalidPathResource(router.resolve(route.path)) ? '资源编号无效' : '找不到页面' }}</h1>
      <p>请检查链接，或从可用入口继续。</p>
      <RouterLink :to="auth.session?.roles.includes('ADMIN') ? '/admin/dashboard' : '/'">
        {{ auth.session?.roles.includes('ADMIN') ? '返回管理后台' : '返回作品广场' }}
      </RouterLink>
    </main>
    <component
      :is="Component"
      v-else
    />
  </RouterView>
  <ConfirmationDialog />
</template>

<style scoped>
.navigation-feedback {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 12px 24px;
  background: #fff7e6;
  color: #73460c;
}
.navigation-feedback p { margin: 0; }
.route-missing { max-width: 960px; margin: 64px auto; padding: 24px; }
</style>
