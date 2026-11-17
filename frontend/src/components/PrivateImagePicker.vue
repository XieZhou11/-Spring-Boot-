<script setup lang="ts">
import { nextTick, ref } from 'vue'
import PrivateImage from './PrivateImage.vue'
import { uploadPrivateImage } from '@/api/customRequest'
import { uploadQuoteImage } from '@/api/quote'
const props = defineProps<{ modelValue: string[]; label: string; max: number; conversationId?: string; scope?: 'quote'; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [ids: string[]]; uploading: [value: boolean] }>()
const error = ref(''); const busy = ref(false)
/** 逐张真实上传，失败保留已完成的图片和表单；服务端再次解码并校验归属。 */
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || []); input.value = ''
  if (busy.value || props.disabled) return
  error.value = ''
  if (files.length + props.modelValue.length > props.max) { error.value = `最多上传 ${props.max} 张图片`; return }
  busy.value = true; emit('uploading', true)
  try {
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) throw new Error('每张图片不能超过 5MB')
      const result = props.scope === 'quote' ? await uploadQuoteImage(file) : await uploadPrivateImage(file, props.conversationId)
      emit('update:modelValue', [...props.modelValue, result.id])
      // 父级v-model更新后再开始下一张，避免多选覆盖前一张。
      await nextTick()
    }
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '图片上传失败，请重试' }
  finally { busy.value = false; emit('uploading', false) }
}
</script>
<template>
  <div class="private-image-picker">
    <label class="work-field">{{ label }}<input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      :aria-label="label"
      :disabled="disabled || busy || modelValue.length >= max"
      @change="upload"
    ></label>
    <small class="field-help">最多 {{ max }} 张，单张不超过 5MB。{{ busy ? '正在上传…' : '' }}</small>
    <p
      v-if="error"
      class="field-error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="request-images">
      <div
        v-for="(id, index) in modelValue"
        :key="id"
      >
        <PrivateImage
          :image-id="id"
          :scope="scope || (conversationId ? 'chat' : 'request')"
          :label="`${label} ${index + 1}`"
        /><button
          type="button"
          class="inline-button"
          :disabled="disabled || busy"
          :aria-label="`移除${label}${index + 1}`"
          @click="emit('update:modelValue', modelValue.filter(value => value !== id))"
        >
          移除
        </button>
      </div>
    </div>
  </div>
</template>
