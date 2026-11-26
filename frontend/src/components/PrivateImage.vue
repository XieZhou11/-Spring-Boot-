<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { getPrivateImage } from '@/api/customRequest'
import { getOrderStockImage } from '@/api/quote'
import { getAdminRefundImage } from '@/api/refund'
import { getAdminReviewReportImage, getReviewImage } from '@/api/review'
import { getReportImage, getReportedCommentImage } from '@/api/report'
import { useAuthStore } from '@/stores/auth'
import { imageRenewalDelay } from '@/utils/imageExpiry'
const props = defineProps<{
  imageId: string
  scope: 'request' | 'chat' | 'quote' | 'progress' | 'refund' | 'review' | 'report' | 'stock'
  label: string
  orderId?: string
  adminApplicationId?: string
  adminReportId?: string
  adminReviewReportId?: string
}>()
const auth = useAuthStore()
const url = ref(''); const error = ref(''); const loading = ref(false)
let revision = 0; let timer: ReturnType<typeof setTimeout> | undefined
/** 续签重新核验业务图片的读取权限；失败立即撤下旧签名。 */
async function load() {
  const current = ++revision; clearTimeout(timer); loading.value = true; error.value = ''
  try {
    const result = await read()
    if (current !== revision) return
    const delay = imageRenewalDelay(result.expiresAt)
    if (delay === undefined) throw new Error('图片有效期无法读取，请重新读取')
    url.value = result.url
    timer = setTimeout(() => void load(), delay)
  } catch (failure) { if (current === revision) { url.value = ''; error.value = failure instanceof Error ? failure.message : '图片读取失败' } }
  finally { if (current === revision) loading.value = false }
}
function read() {
  if (props.adminReviewReportId) return getAdminReviewReportImage(props.adminReviewReportId, props.imageId)
  if (props.adminReportId) return getReportedCommentImage(props.adminReportId, props.imageId)
  if (props.scope === 'report') return getReportImage(props.imageId)
  if (props.scope === 'review') return getReviewImage(props.imageId)
  if (props.adminApplicationId) return getAdminRefundImage(props.adminApplicationId, props.imageId)
  if (props.scope === 'stock') {
    if (!props.orderId) throw new Error('缺少现货订单编号')
    return getOrderStockImage(props.orderId, props.imageId)
  }
  return getPrivateImage(props.imageId, props.scope)
}
watch([
  () => props.imageId, () => props.scope, () => props.orderId, () => props.adminApplicationId,
  () => props.adminReportId, () => props.adminReviewReportId, () => auth.session?.userId,
  () => auth.session?.roles.includes('ADMIN'),
], () => { url.value = ''; void load() }, { immediate: true })
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
