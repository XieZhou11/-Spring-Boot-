<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getFollowState, setFollow } from '@/api/interaction'
const props = defineProps<{ creatorId: string }>()
const auth = useAuthStore()
const allowed = computed(() => !!auth.session && !auth.session.roles.includes('ADMIN'))
const following = ref(false)
const busy = ref(false)
const ready = ref(false)
const error = ref('')
let revision = 0
async function load() {
  const current = ++revision
  following.value = false; ready.value = false; error.value = ''; busy.value = false
  if (!allowed.value) return
  try { const state = await getFollowState(props.creatorId); if (current === revision) { following.value = state.following; ready.value = true } }
  catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '关注状态读取失败' }
}
async function toggle() {
  if (busy.value || !ready.value) return
  const current = revision
  busy.value = true; error.value = ''
  try { const state = await setFollow(props.creatorId, !following.value); if (current === revision) following.value = state }
  catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '关注操作失败，可重试' }
  finally { if (current === revision) busy.value = false }
}
// 实际身份或作者切换才清空旧关系；同账号会话刷新不打断正在提交的关注。
watch([() => props.creatorId, () => auth.session?.userId, () => auth.session?.activeRole], () => void load(), { immediate: true })
onBeforeUnmount(() => { revision++ })
</script>
<template>
  <div
    v-if="allowed"
    class="interaction-follow"
  >
    <button
      class="button-secondary"
      :disabled="busy || !ready"
      @click="toggle"
    >
      {{ following ? '取消关注' : '关注创作者' }}
    </button>
    <p
      v-if="error"
      class="field-error"
      role="alert"
    >
      {{ error }} <button
        class="inline-button"
        :disabled="busy"
        @click="load"
      >
        重新读取关注状态
      </button>
    </p>
  </div>
</template>
