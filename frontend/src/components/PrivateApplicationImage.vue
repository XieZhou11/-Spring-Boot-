<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { getApplicationImage } from '@/api/creator'
import { imageRenewalDelay } from '@/utils/imageExpiry'

const props = defineProps<{ imageId: string; label: string }>()
const url = ref('')
const error = ref('')
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let disposed = false
let revision = 0

/** 只按文件编号请求短时签名，过期前自动续签，卸载后取消。 */
async function load() {
  const current = ++revision
  clearTimeout(timer)
  loading.value = true
  error.value = ''
  try {
    const image = await getApplicationImage(props.imageId)
    if (disposed || current !== revision) return
    const delay = imageRenewalDelay(image.expiresAt)
    if (delay === undefined) throw new Error('图片有效期无法读取，请重新读取')
    url.value = image.url
    timer = setTimeout(() => void load(), delay)
  } catch (failure) {
    if (current !== revision) return
    url.value = ''
    error.value = failure instanceof Error ? failure.message : '图片读取失败'
  } finally {
    if (current === revision) loading.value = false
  }
}
watch(() => props.imageId, () => void load(), { immediate: true })
onBeforeUnmount(() => { disposed = true; revision++; clearTimeout(timer) })
</script>

<template>
  <figure class="private-image">
    <a
      v-if="url && !error"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="`查看${label}原图`"
    ><img
      :src="url"
      :alt="label"
      referrerpolicy="no-referrer"
      @error="error = '图片显示失败，请重新读取'"
    ></a>
    <div
      v-else
      class="image-placeholder"
    >
      <span>{{ loading ? '读取中…' : '暂无法显示' }}</span>
    </div>
    <figcaption>{{ label }}</figcaption>
    <p
      v-if="error"
      class="field-error"
    >
      {{ error }} <button
        class="inline-button"
        type="button"
        :disabled="loading"
        @click="load"
      >
        重新读取
      </button>
    </p>
  </figure>
</template>
