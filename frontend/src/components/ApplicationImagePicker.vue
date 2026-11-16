<script setup lang="ts">
import { ref } from 'vue'
import { uploadApplicationImage } from '@/api/creator'
import PrivateApplicationImage from '@/components/PrivateApplicationImage.vue'

defineProps<{ label: string; disabled?: boolean; error?: string }>()
const images = defineModel<string[]>({ required: true })
const emit = defineEmits<{ busy: [value: boolean] }>()
const uploading = ref(false)
const uploadError = ref('')

/** 上传成功才绑定文件编号；单张失败不丢弃已有图片和其他输入。 */
async function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length || uploading.value) return
  uploadError.value = ''
  uploading.value = true
  emit('busy', true)
  try {
    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        uploadError.value = '请选择 JPEG、PNG 或 WebP 图片'
        break
      }
      if (file.size > 5 * 1024 * 1024) {
        uploadError.value = '单张图片最多 5 MiB'
        break
      }
      const result = await uploadApplicationImage(file)
      images.value = [...images.value, result.id]
    }
  } catch (failure) {
    uploadError.value = failure instanceof Error ? failure.message : '图片上传失败，请重试'
  } finally {
    uploading.value = false
    emit('busy', false)
  }
}
</script>

<template>
  <div class="image-picker">
    <p class="image-picker-label">
      {{ label }} <span>至少 1 张</span>
    </p>
    <div class="work-images">
      <div
        v-for="(id, index) in images"
        :key="id"
        class="image-tile"
      >
        <PrivateApplicationImage
          :image-id="id"
          :label="`${label} ${index + 1}`"
        />
        <button
          class="inline-button delete-button"
          type="button"
          :disabled="disabled || uploading"
          :aria-label="`移除${label} ${index + 1}`"
          @click="images = images.filter((_, i) => i !== index)"
        >
          移除
        </button>
      </div>
      <label
        class="image-upload"
        :class="{ 'is-disabled': disabled || uploading }"
      ><span aria-hidden="true">＋</span>{{ uploading ? '正在上传…' : '添加图片' }}
        <input
          class="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          :aria-label="`上传${label}`"
          :disabled="disabled || uploading"
          @change="choose"
        >
      </label>
    </div>
    <p
      v-if="uploadError || error"
      class="field-error"
      role="alert"
    >
      {{ uploadError || error }}
    </p>
  </div>
</template>
