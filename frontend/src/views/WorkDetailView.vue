<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import WorkMaterials from '@/components/WorkMaterials.vue'
import { getWork } from '@/api/work'
import type { WorkVO } from '@/types/work'
const route = useRoute()
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
watch(() => route.params.id, () => void load(), { immediate: true })
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
    /><p
      v-else
      class="account-loading"
      role="status"
    >
      正在读取作品…
    </p>
  </WorkLayout>
</template>
