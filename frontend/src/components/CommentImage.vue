<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { getCommentImage } from '@/api/interaction'
import { useAuthStore } from '@/stores/auth'
import { imageRenewalDelay } from '@/utils/imageExpiry'
import type { ImageVO } from '@/types/creator'
const props = defineProps<{ image: ImageVO; label: string }>()
const auth = useAuthStore()
const url = ref('')
const failed = ref(false)
let revision = 0
let timer: ReturnType<typeof setTimeout> | undefined
async function load(initial = false) {
  const current = ++revision
  clearTimeout(timer); failed.value = false
  try {
    const image = initial && Date.parse(props.image.expiresAt) > Date.now() + 25_000 ? props.image : await getCommentImage(props.image.id)
    if (current !== revision) return
    const delay = imageRenewalDelay(image.expiresAt)
    if (delay === undefined) throw new Error('图片有效期无法读取，请重新读取')
    url.value = image.url
    timer = setTimeout(() => void load(), delay)
  } catch { if (current === revision) { url.value = ''; failed.value = true } }
}
// 只响应图片及身份值变化，避免同账号会话回读打断在途图片读取。
watch([() => props.image.id, () => auth.session?.userId, () => auth.session?.activeRole], () => { url.value = ''; void load(true) }, { immediate: true })
onBeforeUnmount(() => { revision++; clearTimeout(timer) })
</script>
<template>
  <div class="comment-image">
    <img
      v-if="url && !failed"
      :src="url"
      :alt="label"
      referrerpolicy="no-referrer"
      @error="failed = true"
    >
    <button
      v-else
      type="button"
      class="inline-button"
      @click="load()"
    >
      重新读取评论图片
    </button>
  </div>
</template>
