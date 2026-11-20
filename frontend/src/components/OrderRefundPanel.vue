<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PrivateImagePicker from './PrivateImagePicker.vue'
import QuoteImages from './QuoteImages.vue'
import WorkPagination from './WorkPagination.vue'
import { addRefundEvidence, createRefund, getRefund, getRefundEvidence, getRefunds, withdrawRefund } from '@/api/refund'
import type { OrderVO } from '@/types/quote'
import type { RefundApplicationVO, RefundEvidenceVO } from '@/types/refund'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { ApiError } from '@/utils/request'
import { clearRefundState, readRefundAttempt, readRefundDraft, refundReasons, refundStatuses, sameRefundCreation, sameRefundEvidence, saveRefundState } from '@/utils/refund'
import type { RefundAttempt, RefundDraft } from '@/utils/refund'
import { formatTime } from '@/utils/creator'
import { orderStatus } from '@/utils/quote'

const props = defineProps<{ order: OrderVO; busy: boolean; blocked: boolean }>()
const emit = defineEmits<{ lock: [state: { busy: boolean; blocked: boolean }]; 'write-start': []; refresh: []; invalid: [] }>()
const auth = useAuthStore(); const notifications = useNotificationsStore()
const rows = ref<RefundApplicationVO[]>([]); const selected = ref<RefundApplicationVO>(); const evidence = ref<RefundEvidenceVO[]>([])
const page = ref(1); const total = ref(0); const cursor = ref<string | null>(null); const hasMore = ref(false)
const loading = ref(false); const writing = ref(false); const uploading = ref(false); const error = ref(''); const notice = ref('')
const attempt = ref<RefundAttempt>(); const checked = ref(false); const recoveryConflict = ref(false)
const draft = ref<RefundDraft>(); let revision = 0; let deferred = false; let restoringDraft = false
const disabled = computed(() => props.busy || props.blocked || writing.value || uploading.value || !!attempt.value)
/** 资格变化后保留草稿供查看，但终态及失效申请不再允许编辑、上传或提交。 */
const draftUnavailable = computed(() => !!draft.value && (draft.value.mode === 'create' ? !props.order.canRequestRefund : selected.value?.id !== draft.value.applicationId || !selected.value?.canSupplement))
const draftDisabled = computed(() => disabled.value || draftUnavailable.value)
const context = () => ({ userId: auth.session?.userId, orderId: props.order.id })
const sameContext = (c: ReturnType<typeof context>) => c.userId === auth.session?.userId && c.orderId === props.order.id
watch([writing, uploading, attempt], () => emit('lock', { busy: writing.value || uploading.value, blocked: !!attempt.value }), { immediate: true, flush: 'sync' })
function clearLocal() {
  const c = context(); if (c.userId) { clearRefundState(c.userId, c.orderId, 'attempt'); clearRefundState(c.userId, c.orderId, 'draft') }
  attempt.value = undefined; draft.value = undefined; rows.value = []; selected.value = undefined; evidence.value = []; error.value = ''; checked.value = false
}
function storeDraft() { const c = context(); if (!restoringDraft && c.userId && draft.value) { try { saveRefundState(c.userId, c.orderId, 'draft', draft.value) } catch { /* 提交前还会强制保存；失败时绝不发送写请求。 */ } } }
watch(draft, storeDraft, { deep: true, flush: 'sync' })
function begin(mode: RefundDraft['mode']) {
  if (disabled.value || (mode === 'create' ? !props.order.canRequestRefund : !selected.value?.canSupplement)) return
  if (draft.value && (draft.value.content || draft.value.imageIds.length) && !window.confirm('切换售后操作会清空未提交输入，确认继续？')) return
  draft.value = { mode, applicationId: mode === 'evidence' ? selected.value!.id : '', reasonCode: 'MISMATCH', content: '', imageIds: [] }; error.value = ''; notice.value = ''
}
function closeDraft() { if (disabled.value) return; const c = context(); draft.value = undefined; if (c.userId) clearRefundState(c.userId, c.orderId, 'draft') }
/** 查询只刷新业务事实，始终保留编辑草稿；未知结果额外按原键精确核验。 */
async function load() {
  const c = context(); if (!c.userId) return
  if (writing.value || uploading.value) { deferred = true; return }
  const current = ++revision; loading.value = true; checked.value = false; recoveryConflict.value = false
  try {
    const list = await getRefunds(c.orderId, { page: page.value })
    if (current !== revision || !sameContext(c)) return
    rows.value = list.items; total.value = list.total
    const wanted = selected.value?.id || (attempt.value && 'applicationId' in attempt.value ? attempt.value.applicationId : '') || props.order.currentRefund?.id || list.items[0]?.id
    const application = wanted ? await getRefund(wanted) : undefined
    if (current !== revision || !sameContext(c)) return
    selected.value = application
    if (application) {
      const result = await getRefundEvidence(application.id)
      if (current !== revision || !sameContext(c)) return
      evidence.value = result.items; cursor.value = result.nextCursor; hasMore.value = result.hasMore
    } else { evidence.value = []; cursor.value = null; hasMore.value = false }
    if (attempt.value) {
      const pending = attempt.value; let applied = false
      if (pending.kind === 'create') {
        const matches = await getRefunds(c.orderId, { requestKey: pending.input.requestKey })
        if (current !== revision || !sameContext(c)) return
        applied = matches.items.some(item => sameRefundCreation(item, pending.input))
        recoveryConflict.value = !!matches.items.length && !applied
      } else if (pending.kind === 'evidence') {
        const matches = await getRefundEvidence(pending.applicationId, { requestKey: pending.input.requestKey })
        if (current !== revision || !sameContext(c)) return
        applied = matches.items.some(item => item.refundApplicationId === pending.applicationId && item.submitterId === c.userId && sameRefundEvidence(item, pending.input))
        recoveryConflict.value = !!matches.items.length && !applied
      } else applied = application?.id === pending.applicationId && application.status === 'WITHDRAWN'
      if (applied) { clearRefundState(c.userId, c.orderId, 'attempt'); clearRefundState(c.userId, c.orderId, 'draft'); attempt.value = undefined; draft.value = undefined; error.value = ''; notice.value = '已精确核验原操作提交成功。'; emit('refresh') }
      else { checked.value = true; error.value = recoveryConflict.value ? '原请求键对应的内容不一致，已阻止重试。请保留记录并核对当前申请。' : '售后操作结果尚未确认，原始输入已保留。已按原请求核验，可重试同一次操作。' }
    }
  } catch (failure) {
    if (current !== revision || !sameContext(c)) return
    if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) { clearLocal(); emit('invalid') }
    error.value = failure instanceof Error ? failure.message : '售后记录读取失败'
  } finally { if (current === revision) loading.value = false }
}
async function select(application: RefundApplicationVO) {
  if (writing.value || uploading.value || attempt.value) return
  if (draft.value?.mode === 'evidence' && draft.value.applicationId !== application.id && !window.confirm('切换申请将关闭当前补证草稿，确认继续？')) return
  if (draft.value?.mode === 'evidence') closeDraft()
  selected.value = application; await load()
}
async function moreEvidence() {
  if (!selected.value || loading.value || writing.value || uploading.value || !hasMore.value || !cursor.value) return
  const c = context(); const applicationId = selected.value.id; const current = revision; loading.value = true
  try { const result = await getRefundEvidence(applicationId, { afterId: cursor.value }); if (current === revision && sameContext(c) && selected.value?.id === applicationId) { evidence.value = [...evidence.value, ...result.items.filter(item => !evidence.value.some(old => old.id === item.id))]; cursor.value = result.nextCursor; hasMore.value = result.hasMore } }
  catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '证据读取失败' }
  finally { if (current === revision) loading.value = false }
}
function submit() {
  if (disabled.value || !draft.value) return
  const d = draft.value; const content = d.content.trim(); error.value = ''
  if (d.mode === 'create') {
    if (!props.order.canRequestRefund || !refundReasons[d.reasonCode] || content.length < 20 || content.length > 500 || d.imageIds.length > 3) { error.value = '申请说明需20—500字，凭证最多3张，请核对当前申请资格。'; return }
    if (!window.confirm(`确认向管理员申请订单 ${props.order.orderNo} 全额退款 ¥ ${props.order.paidAmount}？处理中暂停履约，管理员依据证据裁定。`)) return
    void write({ kind: 'create', input: { requestKey: crypto.randomUUID(), reasonCode: d.reasonCode, description: content, imageIds: [...d.imageIds] } })
  } else {
    if (!selected.value?.canSupplement || selected.value.id !== d.applicationId || (!content && !d.imageIds.length) || content.length > 500 || d.imageIds.length > 3) { error.value = '补证需文字或图片至少一项，最多500字及3张图片，请核对当前申请。'; return }
    void write({ kind: 'evidence', applicationId: d.applicationId, input: { requestKey: crypto.randomUUID(), content, imageIds: [...d.imageIds] } })
  }
}
function withdrawal() { if (!disabled.value && selected.value?.canWithdraw && window.confirm('确认撤回当前退款申请？订单恢复原履约状态，原完成时间及申请期限不会重开。')) void write({ kind: 'withdraw', applicationId: selected.value.id }) }
/** 写前保存并废弃旧GET；未知结果只允许原参数重试，不允许另起申请、补证或履约。 */
async function write(candidate?: RefundAttempt) {
  const c = context(); if (!c.userId || writing.value || uploading.value || props.busy || props.blocked) return
  if (attempt.value) { if (candidate || !checked.value || recoveryConflict.value) return } else if (!candidate) return
  const input = attempt.value || candidate!
  try { saveRefundState(c.userId, c.orderId, 'attempt', input) }
  catch { error.value = '浏览器存储暂时不可用，本次售后操作未提交。请允许存储后重试，已填内容保留。'; return }
  attempt.value = input; const current = ++revision; loading.value = false; writing.value = true; checked.value = false; error.value = ''; notice.value = ''; emit('write-start')
  try {
    const result = input.kind === 'create' ? await createRefund(c.orderId, input.input) : input.kind === 'evidence' ? await addRefundEvidence(input.applicationId, input.input) : await withdrawRefund(input.applicationId)
    if (current !== revision || !sameContext(c)) return
    selected.value = result; clearRefundState(c.userId, c.orderId, 'attempt'); clearRefundState(c.userId, c.orderId, 'draft'); attempt.value = undefined; draft.value = undefined; notice.value = input.kind === 'create' ? '退款申请已进入管理员队列。' : input.kind === 'evidence' ? '补充证据已保存并通知对方。' : '退款申请已撤回，订单恢复原状态。'
  } catch (failure) {
    if (current !== revision || !sameContext(c)) return
    const unknown = !(failure instanceof ApiError) || !failure.status || failure.status >= 500
    if (!unknown) { clearRefundState(c.userId, c.orderId, 'attempt'); attempt.value = undefined; if ([401, 403, 404].includes(failure.status)) { clearLocal(); emit('invalid') } }
    error.value = unknown ? '售后操作结果尚未确认，原始输入已保留，请刷新售后核验后重试同一次操作。' : `${failure.message}。输入已保留，请核对最新记录后重新确认。`
  } finally { if (sameContext(c)) { writing.value = false; deferred = false; emit('refresh'); void load() } }
}
function uploadState(value: boolean) { uploading.value = value; if (!value && deferred) { deferred = false; void load() } }
function refresh() { void load() }
function visible() { if (document.visibilityState === 'visible') refresh() }
watch([() => props.order.id, () => auth.session?.userId], () => {
  revision++; rows.value = []; selected.value = undefined; evidence.value = []; error.value = ''; notice.value = ''; writing.value = false; uploading.value = false; page.value = 1
  const c = context(); restoringDraft = true
  draft.value = c.userId ? readRefundDraft(c.userId, c.orderId) : undefined; attempt.value = c.userId ? readRefundAttempt(c.userId, c.orderId) : undefined
  if (attempt.value?.kind === 'create') draft.value = { mode: 'create', applicationId: '', reasonCode: attempt.value.input.reasonCode, content: attempt.value.input.description, imageIds: [...attempt.value.input.imageIds] }
  if (attempt.value?.kind === 'evidence') draft.value = { mode: 'evidence', applicationId: attempt.value.applicationId, reasonCode: 'MISMATCH', content: attempt.value.input.content, imageIds: [...attempt.value.input.imageIds] }
  restoringDraft = false; void load()
}, { immediate: true })
watch(() => props.order.currentRefund?.version, refresh)
watch(() => notifications.connected, (value, old) => { if (value && !old) refresh() })
onMounted(() => { window.addEventListener('order-updated', refresh); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible) })
onBeforeUnmount(() => { revision++; window.removeEventListener('order-updated', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) })
</script>

<template>
  <section
    class="editor-section refund-panel"
    aria-label="订单售后"
  >
    <header class="fulfillment-heading">
      <h2>售后与退款</h2><button
        type="button"
        class="inline-button"
        :disabled="loading || writing || uploading"
        @click="load"
      >
        刷新售后
      </button>
    </header>
    <p class="field-help">
      普通退款由管理员依据双方证据裁定，全额退还原实付金额。售后处理中暂停开工、打卡、发货和收货，原订单会话继续保留。
    </p>
    <p
      v-if="order.originalCompletedAt"
      class="refund-window"
    >
      最初完成 {{ formatTime(order.originalCompletedAt) }}<br>普通售后申请截止 {{ order.refundWindowEndsAt ? formatTime(order.refundWindowEndsAt) : '请刷新订单核对' }}（截止时刻起不可新申请）
    </p>
    <p
      v-else
      class="field-help"
    >
      已付款履约期间或最初完成后七天内可申请；已受理申请跨过期限仍可补证、撤回及裁定。
    </p>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }} <button
        v-if="attempt"
        type="button"
        class="inline-button"
        :disabled="writing || !checked || recoveryConflict || blocked"
        @click="write()"
      >
        重试原售后操作
      </button>
    </p>
    <p
      v-if="notice"
      class="form-success"
      role="status"
    >
      {{ notice }}
    </p>
    <button
      v-if="order.canRequestRefund && !draft"
      class="button-secondary"
      :disabled="disabled"
      @click="begin('create')"
    >
      申请普通退款
    </button>
    <nav
      v-if="rows.length"
      class="refund-history-list"
      aria-label="退款申请历史"
    >
      <button
        v-for="item in rows"
        :key="item.id"
        type="button"
        :class="{ selected: selected?.id === item.id }"
        :disabled="writing || uploading || !!attempt"
        @click="select(item)"
      >
        <strong>{{ refundStatuses[item.status] || item.status }}</strong><span>{{ item.applicationType === 'NORMAL' ? refundReasons[item.reasonCode] : '未开工系统无责退款' }}</span><time>{{ formatTime(item.createdAt) }}</time>
      </button>
    </nav>
    <WorkPagination
      v-if="total > 20"
      :page="page"
      :total="total"
      :loading="loading || writing || uploading || !!attempt"
      @change="page = $event; load()"
    />
    <article
      v-if="selected"
      class="refund-application"
      :aria-label="`退款申请 ${selected.id}`"
    >
      <header class="fulfillment-heading">
        <h3>申请 {{ selected.id }}</h3><span class="work-status">{{ refundStatuses[selected.status] || selected.status }}</span>
      </header>
      <dl class="work-specifications">
        <div><dt>原订单状态</dt><dd>{{ orderStatus[selected.originalOrderStatus] || selected.originalOrderStatus }}</dd></div><div><dt>申请原因</dt><dd>{{ refundReasons[selected.reasonCode] || selected.reasonCode }}</dd></div><div><dt>全额退款金额</dt><dd>¥ {{ selected.refundAmount }}</dd></div>
      </dl>
      <ol class="order-timeline refund-evidence">
        <li>
          <strong>买家初次申请 · {{ formatTime(selected.createdAt) }}</strong><p class="request-description">
            {{ selected.description }}
          </p><QuoteImages
            :image-ids="selected.imageIds"
            scope="refund"
            label="初始退款凭证"
          />
        </li><li
          v-for="item in evidence"
          :key="item.id"
        >
          <strong>{{ item.submitterId === order.buyerId ? '买家' : '创作者' }}追加证据</strong><time>{{ formatTime(item.createdAt) }}</time><p
            v-if="item.content"
            class="request-description"
          >
            {{ item.content }}
          </p><QuoteImages
            :image-ids="item.imageIds"
            scope="refund"
            label="补充退款凭证"
          />
        </li><li v-if="selected.finishedAt">
          <strong>{{ refundStatuses[selected.status] }}</strong><time>{{ formatTime(selected.finishedAt) }}</time><p
            v-if="selected.decisionReason"
            class="request-description"
          >
            {{ selected.decisionReason }}
          </p><p v-if="selected.returnConfirmedAt">
            原成品退回已核实 · {{ formatTime(selected.returnConfirmedAt) }}<span v-if="selected.returnTrackingNo"> · {{ selected.returnTrackingNo }}</span>
          </p><p v-if="selected.noReturnBasis">
            无需退货依据：{{ selected.noReturnBasis }}
          </p>
        </li>
      </ol>
      <button
        v-if="hasMore"
        type="button"
        class="inline-button"
        :disabled="loading || writing || uploading"
        @click="moreEvidence"
      >
        继续读取证据
      </button>
      <div class="fulfillment-actions">
        <button
          v-if="selected.canSupplement && !draft"
          type="button"
          class="button-secondary"
          :disabled="disabled"
          @click="begin('evidence')"
        >
          追加售后证据
        </button><button
          v-if="selected.canWithdraw"
          type="button"
          class="inline-button"
          :disabled="disabled"
          @click="withdrawal"
        >
          撤回退款申请
        </button><RouterLink :to="`/messages/conversations/${selected.conversationId}`">进入原订单会话 ↗</RouterLink>
      </div>
      <p
        v-if="selected.status !== 'WAIT_ADMIN'"
        class="field-help"
      >
        本申请及证据已只读。后续沟通与补证使用原订单会话，不重开原申请期限。
      </p>
    </article>
    <form
      v-if="draft"
      class="fulfillment-form"
      :aria-label="draft.mode === 'create' ? '申请普通退款' : '追加售后证据'"
      @submit.prevent="submit"
    >
      <h3>{{ draft.mode === 'create' ? '申请普通全额退款' : `追加申请 ${draft.applicationId} 的证据` }}</h3>
      <label
        v-if="draft.mode === 'create'"
        class="work-field"
      >退款原因<select
        v-model="draft.reasonCode"
        aria-label="退款原因"
        :disabled="draftDisabled"
      ><option
        v-for="(label, value) in refundReasons"
        :key="value"
        :value="value"
      >{{ label }}</option></select></label>
      <label class="work-field">{{ draft.mode === 'create' ? '退款说明' : '补充证据说明' }}<textarea
        v-model="draft.content"
        :aria-label="draft.mode === 'create' ? '退款说明' : '补充证据说明'"
        rows="4"
        maxlength="500"
        :disabled="draftDisabled"
      /></label><p class="field-help">
        {{ draft.content.length }}/500 · {{ draft.mode === 'create' ? '说明至少20字，凭证可选' : '文字或图片至少一项，原证据不会覆盖' }}
      </p>
      <p
        v-if="draftUnavailable && !attempt"
        class="field-help"
      >
        当前操作资格已变化，草稿已保留。可关闭表单，前往原订单会话继续沟通。
      </p>
      <PrivateImagePicker
        v-model="draft.imageIds"
        :order-id="order.id"
        scope="refund"
        label="售后凭证"
        :max="3"
        :disabled="draftDisabled"
        @uploading="uploadState"
      />
      <div class="fulfillment-actions">
        <button
          class="button-primary"
          :disabled="draftDisabled"
        >
          {{ writing ? '正在提交…' : draft.mode === 'create' ? '确认申请全额退款' : '提交补充证据' }}
        </button><button
          type="button"
          class="inline-button"
          :disabled="disabled"
          @click="closeDraft"
        >
          暂不提交
        </button>
      </div>
    </form>
    <p
      v-if="loading && !rows.length"
      class="field-help"
      role="status"
    >
      正在读取售后记录…
    </p>
  </section>
</template>
