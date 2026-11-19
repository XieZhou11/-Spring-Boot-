<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import WorkInteractions from '@/components/WorkInteractions.vue'
import CreatorFollow from '@/components/CreatorFollow.vue'
import WorkMaterials from '@/components/WorkMaterials.vue'
import { getWork } from '@/api/work'
import { useAuthStore } from '@/stores/auth'
import type { WorkVO } from '@/types/work'
const route = useRoute()
const auth = useAuthStore()
const work = ref<WorkVO>()
const error = ref('')
let revision = 0
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
    <nav class="work-breadcrumb">
      <RouterLink to="/">发现作品</RouterLink><span>/</span><span>作品详情</span>
    </nav><p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }} <button
        class="inline-button"
        @click="load"
      >
        重新读取
      </button>
    </p><WorkMaterials
      v-else-if="work"
      :key="work.id"
      :work="work"
    >
      <template #creator-actions>
        <CreatorFollow :creator-id="work.creatorId" />
      </template>
    </WorkMaterials><WorkInteractions
      v-if="work && !error"
      :work-id="work.id"
    /><p
      v-else-if="!error"
      class="account-loading"
      role="status"
    >
      正在读取作品…
    </p>
  </WorkLayout>
</template>
