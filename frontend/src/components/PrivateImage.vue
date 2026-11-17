<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { getPrivateImage } from '@/api/customRequest'
const props = defineProps<{ imageId: string; scope: 'request' | 'chat' | 'quote'; label: string }>()
const url = ref(''); const error = ref(''); const loading = ref(false)
let revision = 0; let timer: ReturnType<typeof setTimeout> | undefined
/** 续签重新核验需求、会话或报价图片的读取权限；失败立即撤下旧签名。 */
async function load() {
  const current = ++revision; clearTimeout(timer); loading.value = true; error.value = ''
  try {
    const result = await getPrivateImage(props.imageId, props.scope)
    if (current !== revision) return
    url.value = result.url
    timer = setTimeout(() => void load(), Math.max(5000, Date.parse(result.expiresAt) - Date.now() - 20_000))
  } catch (failure) { if (current === revision) { url.value = ''; error.value = failure instanceof Error ? failure.message : '图片读取失败' } }
  finally { if (current === revision) loading.value = false }
}
watch(() => [props.imageId, props.scope], () => { url.value = ''; void load() }, { immediate: true })
onBeforeUnmount(() => { revision++; clearTimeout(timer) })
</script>
<template>
  <div class="work-image">
    <img
      v-if="url"
      :src="url"
      :alt="label"
      referrerpolicy="no-referrer"
      @error="url = ''; error = '图片显示失败'"
    >
    <div
      v-else
      class="work-image-placeholder"
    >
      <span>{{ loading ? '图片读取中…' : error }}</span><button
        v-if="!loading"
        type="button"
        class="inline-button"
        @click="load"
      >
        重新读取图片
      </button>
    </div>
  </div>
</template>
