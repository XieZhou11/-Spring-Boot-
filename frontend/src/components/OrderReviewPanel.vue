<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PrivateImage from '@/components/PrivateImage.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import { createOrderReview, getOrderReview, reportReview, uploadReviewImage } from '@/api/review'
import { useAuthStore } from '@/stores/auth'
import type { ImageVO } from '@/types/creator'
import type { OrderVO } from '@/types/quote'
import type { OrderReviewVO } from '@/types/review'
import type { ReportInput } from '@/types/report'
import { formatTime } from '@/utils/creator'
import { ApiError } from '@/utils/request'
import { prepareOwnReportVerification } from '@/utils/report'

const props = defineProps<{ orderId: string; orderStatus?: OrderVO['status'] }>()
const auth = useAuthStore()
const review = ref<OrderReviewVO>()
const rating = ref(5)
const content = ref('')
const images = ref<ImageVO[]>([])
const loading = ref(false)
const loadFailed = ref(false)
const uploading = ref(false)
const submitting = ref(false)
const unknown = ref(false)
const error = ref('')
const notice = ref('')
const reporting = ref(false)
const canReport = computed(() => !!review.value?.canReport && !auth.session?.roles.includes('ADMIN'))
const orderAllowsReview = computed(() => !props.orderStatus || props.orderStatus === 'COMPLETED')
const showForm = computed(() => orderAllowsReview.value && review.value?.canCreate)
const locked = computed(() => loading.value || loadFailed.value || uploading.value || submitting.value || unknown.value)
const textLength = computed(() => content.value.trim().length)
const unavailable = computed(() => {
  if (props.orderStatus === 'AFTER_SALE') return '售后处理中，暂不可提交评价。'
  if (props.orderStatus === 'REFUNDED') return '订单已退款。'
  if (review.value?.canView) return '本订单当前不在评价窗口内。'
  return '买家尚未评价。'
})
let scopeRevision = 0
let readRevision = 0
let timer: ReturnType<typeof setTimeout> | undefined

function clearDraft() {
  rating.value = 5
  content.value = ''
  images.value = []
}

/** 评价结果未知时只查询本订单的已有记录；核验后才允许重新提交。 */
async function load() {
  if (!auth.session || submitting.value) return
  const scope = scopeRevision
  const read = ++readRevision
  const isCurrent = () => scope === scopeRevision && read === readRevision
  const checkingUnknown = unknown.value
  loading.value = true
  clearTimeout(timer)
  try {
    const result = await getOrderReview(props.orderId)
    if (!isCurrent()) return
    review.value = result
    loadFailed.value = false
    if (checkingUnknown) {
      unknown.value = false
      error.value = ''
      if (!result.id && result.canCreate) notice.value = '未查到已提交的评价，可以继续编辑并提交。'
    }
    if (result.id) clearDraft()
    const remaining = result.reviewDeadlineAt ? Date.parse(result.reviewDeadlineAt) - Date.now() : 0
    if (result.canCreate && remaining > 0) timer = setTimeout(() => void load(), remaining + 100)
  } catch {
    if (isCurrent()) loadFailed.value = true
  } finally {
    if (isCurrent()) loading.value = false
  }
}

/** 每张评价图片由当前买家上传，切换订单和会话后丢弃迟到结果。 */
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length || !showForm.value || locked.value) return
  if (files.length + images.value.length > 3) {
    error.value = '评价最多添加 3 张图片。'
    return
  }
  const scope = scopeRevision
  uploading.value = true
  error.value = ''
  try {
    for (const file of files) {
      const result = await uploadReviewImage(file)
      if (scope !== scopeRevision) return
      images.value.push(result)
    }
  } catch (failure) {
    if (scope === scopeRevision) error.value = failure instanceof Error ? failure.message : '图片上传失败'
  } finally {
    if (scope === scopeRevision) uploading.value = false
  }
}

/** 提交失败保留文字、评分与已上传图片，网络中断时先只读核验。 */
async function submit() {
  if (locked.value || !showForm.value || textLength.value < 10 || textLength.value > 500) return
  const scope = scopeRevision
  const statusBeforeSubmit = props.orderStatus
  submitting.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await createOrderReview(props.orderId, { rating: rating.value, content: content.value.trim(), imageIds: images.value.map(image => image.id) })
    if (scope !== scopeRevision) return
    review.value = result
    clearDraft()
    notice.value = '评价已提交。'
  } catch (failure) {
    if (scope !== scopeRevision) return
    if (failure instanceof ApiError && (failure.status === 0 || failure.status >= 500 || failure.status === 409)) unknown.value = true
    else error.value = failure instanceof Error ? failure.message : '评价提交失败'
  } finally {
    if (scope === scopeRevision) {
      submitting.value = false
      if (unknown.value || props.orderStatus !== statusBeforeSubmit) void load()
    }
  }
}

/** 举报仍使用评价的独立处置入口，由服务端核验当前用户资格。 */
async function report(input: ReportInput) {
  if (locked.value || !review.value?.id || !canReport.value) return
  const scope = scopeRevision
  await reportReview(review.value.id, input)
  if (scope === scopeRevision) finishReport()
}
function finishReport() {
  reporting.value = false
  notice.value = '举报已提交。'
}
function prepareVerification(input: ReportInput) {
  const scope = scopeRevision
  return prepareOwnReportVerification('REVIEW', review.value!.id!, input, () => {
    if (scope === scopeRevision) finishReport()
  })
}

watch([() => props.orderId, () => auth.session?.userId, () => auth.session?.activeRole, () => auth.session?.roles.join(',')], () => {
  scopeRevision++
  clearTimeout(timer)
  review.value = undefined
  loading.value = false
  loadFailed.value = false
  uploading.value = false
  submitting.value = false
  unknown.value = false
  reporting.value = false
  error.value = ''
  notice.value = ''
  clearDraft()
  void load()
}, { immediate: true, flush: 'sync' })
watch(() => props.orderStatus, () => void load())
onBeforeUnmount(() => {
  scopeRevision++
  clearTimeout(timer)
})
</script>

<template>
  <section
    class="editor-section order-review-panel"
    aria-label="订单评价"
  >
    <header class="order-review-heading">
      <h2>订单评价</h2>
      <p
        v-if="showForm && review?.reviewDeadlineAt"
        class="field-help"
      >
        可评价至 <time :datetime="review.reviewDeadlineAt">{{ formatTime(review.reviewDeadlineAt) }}</time>
      </p>
    </header>

    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="notice"
      class="field-help"
      role="status"
    >
      {{ notice }}
    </p>
    <p
      v-if="unknown"
      class="form-alert"
      role="status"
    >
      评价提交结果尚未确认。
      <button
        v-if="!loading"
        class="inline-button"
        type="button"
        @click="load"
      >
        核验评价结果
      </button>
    </p>
    <p
      v-else-if="loadFailed"
      class="form-alert"
      role="alert"
    >
      评价状态读取失败。<button
        class="inline-button"
        type="button"
        @click="load"
      >
        重新读取评价
      </button>
    </p>

    <form
      v-if="showForm"
      class="order-review-form"
      @submit.prevent="submit"
    >
      <fieldset
        :disabled="locked"
        class="order-review-fields"
      >
        <legend>总体评分</legend>
        <div class="order-review-stars">
          <label
            v-for="star in 5"
            :key="star"
            :class="{ 'is-selected': rating === star }"
          >
            <input
              v-model="rating"
              type="radio"
              name="order-review-rating"
              :value="star"
              :aria-label="`${star} 星`"
            >
            <span aria-hidden="true">{{ star <= rating ? '★' : '☆' }}</span>
          </label>
        </div>
        <label class="order-review-content">
          交易体验
          <textarea
            v-model="content"
            minlength="10"
            maxlength="500"
            required
            placeholder="写下成品与约定的符合程度和交易体验"
          />
        </label>
        <small class="field-help order-review-count">{{ textLength }} / 500 字，至少 10 字</small>
        <label class="order-review-content">
          评价图片 <small class="field-help">{{ images.length }} / 3 张</small>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            :disabled="images.length >= 3"
            @change="upload"
          >
        </label>
        <div
          v-if="images.length"
          class="review-image-row"
        >
          <figure
            v-for="(image, index) in images"
            :key="image.id"
          >
            <img
              :src="image.url"
              :alt="`待提交的评价图片 ${index + 1}`"
              referrerpolicy="no-referrer"
            >
            <button
              type="button"
              class="inline-button"
              @click="images.splice(index, 1)"
            >
              移除第 {{ index + 1 }} 张
            </button>
          </figure>
        </div>
      </fieldset>
      <div class="order-review-actions">
        <span class="field-help">提交后评价将公开，无法自行修改。</span>
        <button
          class="button-primary"
          :disabled="locked || textLength < 10"
        >
          {{ submitting ? '提交中…' : '提交评价' }}
        </button>
      </div>
    </form>

    <article
      v-else-if="review?.id && review.canView"
      class="order-review-result"
    >
      <header>
        <div><strong>{{ review.buyerNickname }}</strong><span>{{ review.rating }} 星</span></div>
        <time
          v-if="review.createdAt"
          :datetime="review.createdAt"
        >{{ formatTime(review.createdAt) }}</time>
      </header>
      <p>{{ review.content }}</p>
      <div
        v-if="review.images.length"
        class="review-image-row"
      >
        <PrivateImage
          v-for="(image, index) in review.images"
          :key="image.id"
          :image-id="image.id"
          scope="review"
          :label="`评价图片 ${index + 1}`"
        />
      </div>
      <button
        v-if="canReport"
        class="inline-button"
        type="button"
        @click="reporting = !reporting"
      >
        举报评价
      </button>
    </article>
    <p
      v-else-if="loading"
      class="field-help"
      role="status"
    >
      正在读取评价…
    </p>
    <p
      v-else-if="review && !loadFailed"
      class="field-help"
    >
      {{ unavailable }}
    </p>

    <ReportDialog
      v-if="reporting && canReport"
      :submit-report="report"
      :prepare-verification="prepareVerification"
    />
  </section>
</template>

<style scoped>
.order-review-heading, .order-review-actions, .order-review-result header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.order-review-heading .field-help, .order-review-result p { margin: 0; }
.order-review-form, .order-review-fields { display: grid; gap: 12px; }
.order-review-fields { min-width: 0; margin: 0; padding: 0; border: 0; }
.order-review-fields legend { padding: 0; font-weight: 600; }
.order-review-stars { display: flex; flex-wrap: wrap; gap: 6px; }
.order-review-stars label {
  position: relative;
  display: grid;
  min-width: 40px;
  min-height: 40px;
  place-items: center;
  border: 1px solid var(--craft-border);
  border-radius: 8px;
  color: #8c571d;
  font-size: 23px;
  line-height: 1;
}
.order-review-stars label.is-selected { border-color: #a76525; background: #f9ebd7; }
.order-review-stars input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.order-review-stars label:focus-within { outline: 2px solid var(--craft-ink); outline-offset: 2px; }
.order-review-content { display: grid; gap: 6px; font-weight: 600; }
.order-review-content textarea {
  width: 100%;
  min-height: 106px;
  padding: 10px 12px;
  border: 1px solid var(--craft-border);
  border-radius: 8px;
  background: var(--craft-surface);
  color: var(--craft-ink);
  font: 400 14px/1.6 var(--craft-font);
  resize: vertical;
}
.order-review-content input { max-width: 100%; color: var(--craft-muted); font: 400 13px var(--craft-font); }
.order-review-content input::file-selector-button {
  margin-right: 8px;
  padding: 7px 10px;
  border: 1px solid var(--craft-border);
  border-radius: 7px;
  background: var(--craft-bg);
  color: var(--craft-ink);
  font: 600 13px var(--craft-font);
}
.order-review-count { margin-top: -9px; justify-self: end; }
.order-review-result { display: grid; gap: 10px; }
.order-review-result header div { display: flex; align-items: center; gap: 8px; }
.order-review-result header span { padding: 2px 8px; border-radius: 6px; background: #f9ebd7; color: #713911; font-size: 12px; }
.order-review-result time { color: var(--craft-muted); font-size: 12px; }
.order-review-result p { white-space: pre-wrap; overflow-wrap: anywhere; }
.review-image-row { display: flex; flex-wrap: wrap; gap: 10px; }
.review-image-row figure { display: grid; gap: 4px; margin: 0; }
.review-image-row :deep(.work-image), .review-image-row img { width: 84px; height: 84px; object-fit: cover; border-radius: 8px; }
.review-image-row :deep(img) { width: 100%; height: 100%; object-fit: cover; }
</style>
