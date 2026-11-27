<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteLocationResolved } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import HistoryBackLink from '@/components/HistoryBackLink.vue'
import WorkLayout from '@/layouts/WorkLayout.vue'
import WorkInteractions from '@/components/WorkInteractions.vue'
import CreatorFollow from '@/components/CreatorFollow.vue'
import WorkMaterials from '@/components/WorkMaterials.vue'
import StockPurchase from '@/components/StockPurchase.vue'
import { getWork } from '@/api/work'
import { useAuthStore } from '@/stores/auth'
import { useHistoryReturn } from '@/composables/useHistoryReturn'
import type { WorkVO } from '@/types/work'
import '@/assets/styles/craftflow-works.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { source } = useHistoryReturn()
const work = ref<WorkVO>()
const error = ref('')
const interactionActions = ref<HTMLElement | null>(null)
let revision = 0

/** 从收藏或创作者主页进入时显示实际来路，历史详情也兼容旧版广场筛选。 */
function acceptsSource(previous: RouteLocationResolved) {
  const record = previous.matched.at(-1)?.path
  return previous.name === 'home' || record === '/account/favorites' || record === '/creators/:id'
}
const backLabel = computed(() => {
  const record = source(acceptsSource)?.matched.at(-1)?.path
  if (record === '/account/favorites') return '返回收藏作品'
  if (record === '/creators/:id') return '返回创作者主页'
  return '返回作品广场'
})
const browsePath = computed(() => {
  const { state } = router.options.history
  const source = state.current === route.fullPath ? state.workBrowsePath : null
  if (typeof source === 'string') {
    const path = source.split(/[?#]/, 1)[0]
    if (path === '/discover' || (path === '/' && !auth.session?.roles.includes('ADMIN'))) return source
  }
  return auth.session?.roles.includes('ADMIN') ? '/discover' : '/'
})

/** 页面恢复焦点时核验下架，避免旧页面继续展示过期状态。 */
async function load() {
  const current = ++revision
  error.value = ''
  try { const value = await getWork(String(route.params.id)); if (current === revision) work.value = value }
  catch (failure) { if (current === revision) { work.value = undefined; error.value = failure instanceof Error ? failure.message : '作品暂不可浏览' } }
}
// 只在作品或身份值变化时重置；同账号恢复焦点刷新会话不能卸载互动草稿。
watch([() => route.params.id, () => auth.session?.userId, () => auth.session?.activeRole], () => { work.value = undefined; void load() }, { immediate: true })
window.addEventListener('focus', load)
onBeforeUnmount(() => { revision++; window.removeEventListener('focus', load) })
</script>
<template>
  <WorkLayout>
    <div
      class="cf-work-detail"
      :data-history-ready="work || error ? route.fullPath : undefined"
    >
      <nav aria-label="作品详情导航">
        <HistoryBackLink
          class="cf-work-back"
          :fallback="browsePath"
          :accept="acceptsSource"
        >
          <AppIcon name="arrow" />{{ backLabel }}
        </HistoryBackLink>
      </nav>
      <p
        v-if="error"
        class="cf-work-state cf-work-error"
        role="alert"
      >
        {{ error }} <button
          class="inline-button"
          @click="load"
        >
          重新读取
        </button>
      </p>
      <div
        v-else-if="work"
        class="cf-work-detail-content"
      >
        <WorkMaterials
          :key="work.id"
          :work="work"
          presentation="public"
        >
          <template #trade-actions>
            <StockPurchase :work="work" />
          </template>
          <template #interaction-actions>
            <div ref="interactionActions" />
          </template>
          <template #creator-actions>
            <CreatorFollow :creator-id="work.creatorId" />
          </template>
        </WorkMaterials>
        <WorkInteractions
          :work-id="work.id"
          :creator-id="work.creatorId"
          :actions-target="interactionActions"
        />
      </div>
      <p
        v-else
        class="cf-work-state cf-work-status"
        role="status"
      >
        正在读取作品…
      </p>
    </div>
  </WorkLayout>
</template>
