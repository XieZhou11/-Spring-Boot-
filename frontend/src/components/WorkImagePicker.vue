<script setup lang="ts">
import { ref, useId } from 'vue'
import WorkImage from './WorkImage.vue'
import { uploadWorkImage } from '@/api/work'

const props = defineProps<{ label: string; max: number; disabled?: boolean; cover?: boolean }>()
const ids = defineModel<string[]>({ required: true })
const emit = defineEmits<{ uploading: [busy: boolean] }>()
const inputId = useId()
const loading = ref(false)
const error = ref('')
/** 串行真实上传；部分失败保留已成功图片，不清空原有顺序。 */
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files || [])]
  input.value = ''
  error.value = ''
  loading.value = true
  emit('uploading', true)
  try {
    for (const file of files) {
      if (ids.value.length >= props.max) throw new Error(`最多选择 ${props.max} 张图片`)
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPEG、PNG 或 WebP 图片')
      if (file.size > 5 * 1024 * 1024) throw new Error('单张图片不可超过 5 MiB')
      const image = await uploadWorkImage(file)
      ids.value = [...ids.value, image.id]
    }
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '上传失败，请重试' }
  finally { loading.value = false; emit('uploading', false) }
}
function move(index: number, offset: number) {
  const next = [...ids.value]
  const target = index + offset
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  ids.value = next
}
</script>
<template>
  <fieldset
    class="image-picker"
    :disabled="disabled || loading"
  >
    <legend>{{ label }}</legend>
    <p class="field-help">
      JPEG / PNG / WebP，每张不超过 5 MiB；{{ cover ? '首张为封面，可调整顺序。' : '可选的尺寸补充说明。' }}
    </p>
    <div class="image-picker-grid">
      <div
        v-for="(id, index) in ids"
        :key="id"
        class="image-picker-item"
      >
        <WorkImage
          :image-id="id"
          :label="`${label} ${index + 1}`"
        />
        <span class="cover-mark">{{ index === 0 && cover ? '封面' : index + 1 }}</span>
        <div class="image-picker-actions">
          <button
            type="button"
            :disabled="index === 0"
            :aria-label="`${label}第${index + 1}张前移`"
            @click="move(index, -1)"
          >
            ←
          </button>
          <button
            type="button"
            :disabled="index === ids.length - 1"
            :aria-label="`${label}第${index + 1}张后移`"
            @click="move(index, 1)"
          >
            →
          </button>
          <button
            type="button"
            :aria-label="`删除${label}第${index + 1}张`"
            @click="ids = ids.filter((_, i) => i !== index)"
          >
            移除
          </button>
        </div>
      </div>
      <label
        v-if="ids.length < max"
        :for="inputId"
        class="image-upload-box"
      ><span aria-hidden="true">＋</span>{{ loading ? '上传中…' : '添加图片' }}<input
        :id="inputId"
        :aria-label="label"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        :disabled="disabled || loading"
        @change="upload"
      ></label>
    </div>
    <p
      v-if="error"
      role="alert"
      class="field-error"
    >
      {{ error }}
    </p>
  </fieldset>
</template>
