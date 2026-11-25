<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import WorkLayout from '@/layouts/WorkLayout.vue'
import WorkInteractions from '@/components/WorkInteractions.vue'
import CreatorFollow from '@/components/CreatorFollow.vue'
import WorkMaterials from '@/components/WorkMaterials.vue'
import StockPurchase from '@/components/StockPurchase.vue'
import { getWork } from '@/api/work'
import { useAuthStore } from '@/stores/auth'
import type { WorkVO } from '@/types/work'
import '@/assets/styles/craftflow-works.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const work = ref<WorkVO>()
const error = ref('')
let revision = 0

/** 保留导航来源的已应用条件，独立链接使用当前身份的广场入口。 */
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
  <WorkLayout presentation="craftflow">
    <div class="cf-work-detail">
      <nav aria-label="作品详情导航">
        <RouterLink
          class="cf-work-back"
          :to="browsePath"
        >
          <AppIcon name="arrow" />返回作品广场
        </RouterLink>
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
          <template #creator-actions>
            <CreatorFollow :creator-id="work.creatorId" />
          </template>
        </WorkMaterials>
        <WorkInteractions :work-id="work.id" />
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
