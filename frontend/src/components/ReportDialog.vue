<script setup lang="ts">
import { ref } from 'vue'
import { uploadCommentImage } from '@/api/interaction'
import type { ImageVO } from '@/types/creator'
import type { ReportInput } from '@/types/report'
import CommentImage from './CommentImage.vue'

/** 通用举报表单：理由、说明与证据图片，提交动作由调用方决定目标接口。 */
const props = defineProps<{ submitLabel?: string; maxImages?: number }>()
const emit = defineEmits<{ submit: [input: ReportInput] }>()

const reason = ref('COPYRIGHT')
const description = ref('')
const images = ref<ImageVO[]>([])
const busy = ref(false)
const error = ref('')

const maxImages = props.maxImages ?? 6

/** 上传证据图片，复用作品评论私有图片通道。 */
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]; input.value = ''
  if (!file || busy.value || images.value.length >= maxImages) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { error.value = '请选择不超过5MB的JPG、PNG或WebP图片'; return }
  busy.value = true; error.value = ''
  try { images.value.push(await uploadCommentImage(file)) }
  catch (failure) { error.value = failure instanceof Error ? failure.message : '上传失败' }
  finally { busy.value = false }
}

/** 说明与图片至少一项，提交后清空草稿。 */
async function submit() {
  if (busy.value) return
  if (!description.value.trim() && !images.value.length) { error.value = '举报说明和证据图片至少填写一项'; return }
  busy.value = true; error.value = ''
  try {
    emit('submit', { reasonCode: reason.value, description: description.value.trim(), imageIds: images.value.map(image => image.id) })
    description.value = ''; images.value = []
  } finally { busy.value = false }
}
</script>
<template>
  <form
    class="report-dialog"
    @submit.prevent="submit"
  >
    <label>举报理由<select
      v-model="reason"
      :disabled="busy"
    ><option value="COPYRIGHT">盗图</option><option value="FALSE_ADVERTISING">虚假宣传</option><option value="OFFSITE">站外引流</option><option value="ABUSE">辱骂</option><option value="OTHER">其他</option></select></label>
    <label>说明<textarea
      v-model="description"
      maxlength="1000"
      :disabled="busy"
      placeholder="描述需要核实的问题；也可仅附图片证据"
    /></label>
    <label>证据图片（最多{{ maxImages }}张）<input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      :disabled="busy || images.length >= maxImages"
      @change="upload"
    ></label>
    <div class="report-dialog-images">
      <CommentImage
        v-for="(image, index) in images"
        :key="image.id"
        :image="image"
        :label="`举报证据图片 ${index + 1}`"
      />
    </div>
    <p
      v-if="error"
      class="field-error"
      role="alert"
    >
      {{ error }}
    </p>
    <button
      class="button-primary"
      :disabled="busy"
    >
      {{ busy ? '正在提交…' : submitLabel ?? '提交举报' }}
    </button>
  </form>
</template>
<style scoped>
.report-dialog { display: grid; gap: 12px; margin-top: 12px; padding: 16px; background: #f5f2eb; border-radius: 8px; }
.report-dialog textarea { display: block; box-sizing: border-box; width: 100%; min-height: 80px; margin-top: 8px; padding: 10px; border: 1px solid #d9d3c7; border-radius: 4px; font: inherit; resize: vertical; }
.report-dialog select { margin-left: 8px; padding: 4px 8px; }
.report-dialog-images { display: flex; flex-wrap: wrap; gap: 10px; }
.report-dialog-images :deep(img) { width: 96px; height: 96px; object-fit: cover; border-radius: 4px; }
</style>
