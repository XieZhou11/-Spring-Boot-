<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { getWorkImage } from '@/api/work'
import { imageRenewalDelay } from '@/utils/imageExpiry'
import type { ImageVO } from '@/types/creator'

const props = defineProps<{ imageId: string; label: string; initial?: ImageVO | null }>()
const url = ref('')
const error = ref('')
const loading = ref(false)
let revision = 0
let timer: ReturnType<typeof setTimeout> | undefined
let disposed = false
/** 续签重新核验作品可见性；失去权限时立即撤下旧图。 */
async function load(initial?: ImageVO | null) {
  const current = ++revision
  clearTimeout(timer)
  error.value = ''
  loading.value = true
  try {
    const image = initial && Date.parse(initial.expiresAt) > Date.now() + 25_000 ? initial : await getWorkImage(props.imageId)
    if (disposed || current !== revision) return
    const delay = imageRenewalDelay(image.expiresAt)
    if (delay === undefined) throw new Error('图片有效期无法读取，请重新读取')
    url.value = image.url
    timer = setTimeout(() => void load(), delay)
  } catch (failure) {
    if (current !== revision) return
    url.value = ''
    error.value = failure instanceof Error ? failure.message : '图片读取失败'
  } finally { if (current === revision) loading.value = false }
}
watch(() => props.imageId, () => { url.value = ''; void load(props.initial) }, { immediate: true })
onBeforeUnmount(() => { disposed = true; revision++; clearTimeout(timer) })
</script>
<template>
  <div class="work-image">
    <img
      v-if="url && !error"
      :src="url"
      :alt="label"
      referrerpolicy="no-referrer"
      @error="error = '图片显示失败，请重新读取'"
    >
    <div
      v-else
      class="work-image-placeholder"
    >
      <span>{{ loading ? '图片读取中…' : '暂无法显示' }}</span>
    </div>
    <div
      v-if="error"
      class="work-image-error"
    >
      <span>{{ error }}</span><button
        type="button"
        class="inline-button"
        :disabled="loading"
        @click.prevent="load()"
      >
        重新读取图片
      </button>
    </div>
  </div>
</template>
