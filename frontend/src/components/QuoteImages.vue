<script setup lang="ts">
import { ref } from 'vue'
import PrivateImage from './PrivateImage.vue'
withDefaults(defineProps<{
  imageIds: string[]
  scope?: 'request' | 'chat' | 'quote' | 'progress' | 'refund' | 'stock'
  label?: string
  orderId?: string
  adminApplicationId?: string
  adminReviewReportId?: string
}>(), {
  scope: 'quote',
  label: '方案图片',
  orderId: undefined,
  adminApplicationId: undefined,
  adminReviewReportId: undefined,
})
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
        :scope="scope"
        :order-id="orderId"
        :admin-application-id="adminApplicationId"
        :admin-review-report-id="adminReviewReportId"
        :label="`${scope === 'quote' ? '方案效果图' : label} ${index + 1}`"
      />
      <button
        type="button"
        class="inline-button"
        :aria-label="`放大${label} ${index + 1}`"
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
      :scope="scope"
      :order-id="orderId"
      :admin-application-id="adminApplicationId"
      :admin-review-report-id="adminReviewReportId"
      :label="`${label}大图`"
    />
  </dialog>
</template>
