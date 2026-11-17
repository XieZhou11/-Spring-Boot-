<script setup lang="ts">
import { ref } from 'vue'
import PrivateImage from './PrivateImage.vue'
defineProps<{ imageIds: string[] }>()
const dialog = ref<HTMLDialogElement>(); const selected = ref('')
/** 放大图仍通过同一私有读取接口签名，不持久保存访问地址。 */
function enlarge(id: string) { selected.value = id; dialog.value?.showModal() }
</script>
<template>
  <div
    v-if="imageIds.length"
    class="quote-images"
  >
    <div
      v-for="(id, index) in imageIds"
      :key="id"
      class="quote-image-card"
    >
      <PrivateImage
        :image-id="id"
        scope="quote"
        :label="`方案效果图 ${index + 1}`"
      />
      <button
        type="button"
        class="inline-button"
        :aria-label="`放大方案图片 ${index + 1}`"
        @click="enlarge(id)"
      >
        放大图片
      </button>
    </div>
  </div>
  <dialog
    ref="dialog"
    class="quote-image-dialog"
    @click="($event.target === dialog) && dialog?.close()"
    @close="selected = ''"
  >
    <button
      type="button"
      class="button-secondary"
      @click="dialog?.close()"
    >
      关闭大图
    </button>
    <PrivateImage
      v-if="selected"
      :image-id="selected"
      scope="quote"
      label="方案图片大图"
    />
  </dialog>
</template>
