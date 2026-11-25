<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import PrivateImagePicker from './PrivateImagePicker.vue'
import QuoteRecord from './QuoteRecord.vue'
import WorkPagination from './WorkPagination.vue'
import { createQuote, getQuoteQuota, getRequestQuotes } from '@/api/quote'
import { useAuthStore } from '@/stores/auth'
import type { CustomRequestVO } from '@/types/customRequest'
import type { QuoteDTO, QuoteQuotaVO, QuoteVO } from '@/types/quote'
import { ApiError } from '@/utils/request'
import '@/assets/styles/quote.css'
const props = defineProps<{ request: CustomRequestVO; returnTo?: string }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuthStore(); const creator = computed(() => !props.request.owned && auth.session?.roles.includes('CREATOR'))
const rows = ref<QuoteVO[]>([]); const total = ref(0); const page = ref(1); const quota = ref<QuoteQuotaVO>()
const form = reactive({ goodsAmount: '', durationDays: 7, proposal: '', additionalAgreement: '', imageIds: [] as string[] })
const busy = ref(false); const loading = ref(false); const uploading = ref(false); const uncertain = ref(false)
const loadError = ref(''); const error = ref(''); const fields = ref<Record<string, string>>({}); const notice = ref('')
let attempt: QuoteDTO | undefined; let revision = 0
const dirty = computed(() => !!(form.goodsAmount || form.proposal || form.additionalAgreement || form.imageIds.length || uncertain.value))
async function load(next = page.value) {
  if (!creator.value) return
  const current = ++revision; page.value = next; loading.value = true; loadError.value = ''
  try {
    const [quotes, limits] = await Promise.all([getRequestQuotes(props.request.id, { page: next }), getQuoteQuota()])
    if (current !== revision) return
    rows.value = quotes.items; total.value = quotes.total; quota.value = limits
  } catch (failure) { if (current === revision) loadError.value = failure instanceof Error ? failure.message : '报价读取失败' }
  finally { if (current === revision) loading.value = false }
}
function changed() { emit('changed'); void load() }
/** 只有明确业务拒绝才解冻输入；断网和服务异常保持首次请求原文。 */
async function submit() {
  if (busy.value || uploading.value || (!props.request.canQuote && !uncertain.value)) return
  error.value = ''; fields.value = {}; notice.value = ''
  if (!uncertain.value) {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(form.goodsAmount) || Number(form.goodsAmount) < 50 || Number(form.goodsAmount) > 50000) fields.value.goodsAmount = '金额需为 50—50000 元，最多两位小数'
    if (!Number.isInteger(form.durationDays) || form.durationDays < 3 || form.durationDays > 180) fields.value.durationDays = '工期需为 3—180 个自然日'
    if (Array.from(form.proposal.trim()).length < 30 || Array.from(form.proposal.trim()).length > 1000) fields.value.proposal = '方案说明需为 30—1000 字'
    if (Object.keys(fields.value).length) { error.value = '请检查报价字段'; return }
    attempt = { ...form, proposal: form.proposal.trim(), additionalAgreement: form.additionalAgreement.trim(), imageIds: [...form.imageIds], requestKey: crypto.randomUUID() }
  }
  if (!attempt) return
  busy.value = true
  try {
    await createQuote(props.request.id, attempt)
    uncertain.value = false; attempt = undefined; Object.assign(form, { goodsAmount: '', durationDays: 7, proposal: '', additionalAgreement: '', imageIds: [] })
    notice.value = '报价已提交，买家可查看方案。'; changed()
  } catch (failure) {
    uncertain.value = !(failure instanceof ApiError) || !failure.status || failure.status >= 500
    if (failure instanceof ApiError) fields.value = failure.fieldErrors
    if (!uncertain.value) { attempt = undefined; changed() }
    error.value = `${failure instanceof Error ? failure.message : '提交失败'}${uncertain.value ? '。报价结果未知，请重试确认；原方案已锁定，不会重复提交。' : '。已保留填写内容。'}`
  } finally { busy.value = false }
}
function canLeave() {
  if (!auth.session) return true
  if (busy.value || uploading.value) return false
  return !dirty.value || window.confirm('还有未提交或结果未知的报价。请先核对结果；确定离开？')
}
function beforeUnload(event: BeforeUnloadEvent) { if (auth.session && (dirty.value || busy.value || uploading.value)) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(canLeave); onBeforeRouteUpdate(canLeave)
watch(() => props.request.id, () => { revision++; rows.value = []; page.value = 1; void load() }, { immediate: true })
onMounted(() => { window.addEventListener('beforeunload', beforeUnload); window.addEventListener('quote-updated', changed) })
onBeforeUnmount(() => { revision++; window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('quote-updated', changed) })
</script>
<template>
  <section
    v-if="request.status !== 'DRAFT'"
    class="request-quote-panel cf-quotes"
  >
    <header class="work-section-heading">
      <div>
        <h2>{{ request.owned ? '收到的报价' : '我的报价方案' }}</h2>
      </div><RouterLink
        v-if="request.owned"
        class="button-primary"
        :to="{ name: 'quote-comparison', params: { id: request.id }, query: returnTo ? { returnTo } : {} }"
      >查看报价对比</RouterLink><span
        v-else-if="quota"
        class="muted"
      >今日已提交 {{ quota.used }} / {{ quota.limit }} 次</span>
    </header>
    <template v-if="!request.owned">
      <p
        v-if="!request.canQuote && !uncertain"
        class="review-reason"
        role="status"
      >
        {{ request.quoteDisabledReason || '当前不可提交报价。' }}
      </p>
      <p
        v-if="loadError"
        class="form-alert"
        role="alert"
      >
        {{ loadError }} <button
          type="button"
          class="inline-button"
          @click="load()"
        >
          刷新报价
        </button>
      </p>
      <p
        v-if="notice"
        class="form-success"
        role="status"
      >
        {{ notice }}
      </p>
      <form
        v-if="creator && (request.canQuote || uncertain || dirty)"
        class="editor-section quote-form"
        @submit.prevent="submit"
      >
        <h3>提交制作方案</h3><p class="field-help">
          报价固定 7 天有效；需修改时先撤回重报，每次重报计入当天次数。
        </p>
        <p
          v-if="error"
          class="form-alert"
          role="alert"
        >
          {{ error }}
        </p>
        <fieldset :disabled="busy || uncertain || !request.canQuote">
          <legend class="sr-only">
            报价内容
          </legend><div class="work-fields-pair">
            <label class="work-field">报价金额（元）<input
              v-model="form.goodsAmount"
              aria-label="报价金额（元）"
              inputmode="decimal"
              placeholder="50—50000"
              :aria-invalid="!!fields.goodsAmount"
            ><small class="field-error">{{ fields.goodsAmount }}</small></label>
            <label class="work-field">工期（自然日）<input
              v-model.number="form.durationDays"
              aria-label="工期（自然日）"
              type="number"
              min="3"
              max="180"
              step="1"
              :aria-invalid="!!fields.durationDays"
            ><small class="field-error">{{ fields.durationDays }}</small></label>
          </div>
          <label class="work-field">方案说明<textarea
            v-model="form.proposal"
            aria-label="方案说明"
            rows="5"
            maxlength="1000"
            :aria-invalid="!!fields.proposal"
            placeholder="说明材料、工艺路线与制作细节"
          /><small :class="fields.proposal ? 'field-error' : 'field-help'">{{ fields.proposal || `${Array.from(form.proposal).length} / 1000 · 至少 30 字` }}</small></label>
          <label class="work-field">材料与修改约定<textarea
            v-model="form.additionalAgreement"
            aria-label="材料与修改约定"
            rows="3"
            maxlength="10000"
            :aria-invalid="!!fields.additionalAgreement"
          /><small class="field-error">{{ fields.additionalAgreement }}</small></label>
          <PrivateImagePicker
            v-model="form.imageIds"
            scope="quote"
            label="方案图片"
            :max="5"
            :disabled="busy || uncertain || !request.canQuote"
            @uploading="uploading = $event"
          /><small class="field-error">{{ fields.imageIds }}</small>
        </fieldset>
        <div class="request-actions">
          <span class="field-help">工期包含开工等待，自实际支付次日零时起算。</span><button
            class="button-primary"
            :disabled="busy || uploading || (!request.canQuote && !uncertain)"
          >
            {{ busy ? '正在提交…' : uncertain ? '重试确认报价结果' : '提交报价' }}
          </button>
        </div>
      </form>
      <div
        v-if="creator"
        class="quote-history"
      >
        <div class="queue-toolbar">
          <h3>报价记录</h3><button
            type="button"
            class="inline-button"
            :disabled="loading"
            @click="changed"
          >
            刷新报价
          </button>
        </div><p
          v-if="!rows.length && !loadError"
          class="muted"
        >
          {{ loading ? '正在读取报价…' : '你还没有提交过报价。' }}
        </p><QuoteRecord
          v-for="quote in rows"
          :key="quote.id"
          :quote="quote"
          @changed="changed"
        /><WorkPagination
          :page="page"
          :total="total"
          :loading="loading"
          @change="load"
        />
      </div>
    </template>
  </section>
</template>
