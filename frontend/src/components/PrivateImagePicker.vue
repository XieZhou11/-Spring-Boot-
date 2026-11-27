<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import PrivateImage from './PrivateImage.vue'
import { uploadPrivateImage } from '@/api/customRequest'
import { uploadOrderImage, uploadQuoteImage } from '@/api/quote'
const props = defineProps<{ modelValue: string[]; label: string; max: number; conversationId?: string; orderId?: string; scope?: 'quote' | 'progress' | 'refund'; disabled?: boolean; compact?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [ids: string[]]; uploading: [value: boolean] }>()
const error = ref(''); const busy = ref(false); const fileInput = ref<HTMLInputElement>()
const uploadDisabled = computed(() => props.disabled || busy.value || props.modelValue.length >= props.max)
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
      if (props.scope === 'progress' || props.scope === 'refund') {
        if (!props.orderId) throw new Error('请先读取有效订单后上传图片')
      }
      const result = props.scope === 'progress' || props.scope === 'refund'
        ? await uploadOrderImage(props.orderId!, file, props.scope)
        : props.scope === 'quote' ? await uploadQuoteImage(file) : await uploadPrivateImage(file, props.conversationId)
      emit('update:modelValue', [...props.modelValue, result.id])
      // 父级v-model更新后再开始下一张，避免多选覆盖前一张。
      await nextTick()
    }
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '图片上传失败，请重试' }
  finally { busy.value = false; emit('uploading', false) }
}
</script>
<template>
  <div
    class="private-image-picker"
    :class="{ compact }"
  >
    <label
      v-if="!compact"
      class="work-field"
    >{{ label }}<input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      :aria-label="label"
      :disabled="uploadDisabled"
      @change="upload"
    ></label>
    <!-- 聊天条只保留一个可聚焦的上传按钮，原生文件输入负责打开选择器。 -->
    <template v-else>
      <button
        type="button"
        class="chat-image-button"
        :aria-label="`${label}上传`"
        :title="busy ? '正在上传图片' : '上传图片'"
        :aria-busy="busy"
        :disabled="uploadDisabled"
        @click="fileInput?.click()"
      >
        <span
          v-if="busy"
          class="chat-image-spinner"
          aria-hidden="true"
        />
        <AppIcon
          v-else
          name="image"
        />
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        :aria-label="label"
        :disabled="uploadDisabled"
        @change="upload"
      >
    </template>
    <small
      v-if="!compact"
      class="field-help"
    >最多 {{ max }} 张，单张不超过 5MB。{{ busy ? '正在上传…' : '' }}</small>
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
