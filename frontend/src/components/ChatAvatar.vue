<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/** 头像签名由会话页统一取得，加载失败时显示昵称首字。 */
const props = defineProps<{
  url?: string | null
  nickname?: string
  label: string
}>()
const broken = ref(false)
const initial = computed(() => Array.from(props.nickname?.trim() || '')[0] || '客')
watch(() => props.url, () => { broken.value = false })
</script>
<template>
  <img
    v-if="url && !broken"
    class="chat-avatar"
    :src="url"
    :alt="label"
    referrerpolicy="no-referrer"
    @error="broken = true"
  >
  <span
    v-else
    class="chat-avatar chat-avatar-fallback"
    role="img"
    :aria-label="label"
  >{{ initial }}</span>
</template>
