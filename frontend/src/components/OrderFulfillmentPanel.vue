<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PrivateImagePicker from './PrivateImagePicker.vue'
import QuoteImages from './QuoteImages.vue'
import type { OrderProgressNodeVO, OrderVO } from '@/types/quote'
import type { FulfillmentAttempt } from '@/utils/orderFulfillment'
import { fulfillmentActionName } from '@/utils/orderFulfillment'
import { progressNodeName, progressNodeStatus } from '@/utils/quote'
import { formatTime } from '@/utils/creator'
import { useConfirmation } from '@/composables/useConfirmation'

const props = defineProps<{ order: OrderVO; busy: boolean; blocked: boolean; pending?: FulfillmentAttempt; reset: number }>()
const emit = defineEmits<{ submit: [attempt: FulfillmentAttempt]; uploading: [value: boolean] }>()
const mode = ref<'check-in' | 'skip' | 'supplement' | 'shipment' | 'tracking' | 'refund'>()
const nodeId = ref(''); const content = ref(''); const imageIds = ref<string[]>([]); const skipReason = ref(''); const trackingNo = ref(''); const expectedTrackingNo = ref(''); const validation = ref(''); const uploading = ref(false)
const editor = ref<HTMLFormElement>()
const disabled = computed(() => props.busy || props.blocked || uploading.value)
const completed = computed(() => props.order.progressNodes?.filter(node => ['CHECKED', 'SKIPPED'].includes(node.status)).length || 0)
const terminal = computed(() => ['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(props.order.status))
const stock = computed(() => props.order.orderType === 'STOCK')
const frozen = computed(() => terminal.value || props.order.status === 'AFTER_SALE')
const currentNode = computed(() => props.order.progressNodes?.find(node => node.id === nodeId.value))
const graphMode = computed(() => mode.value && ['check-in', 'skip', 'supplement', 'shipment'].includes(mode.value))
const serverBaseline = ref(Number.NaN); const elapsed = ref(0)
let monotonicBaseline = performance.now(); let countdownTimer: ReturnType<typeof setInterval> | undefined
/** 服务端时间含偏移时按其偏移解析；无偏移的业务时刻明确按北京时间解析。 */
function beijingTimestamp(value: string | null | undefined) {
  if (!value) return Number.NaN
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(' ', 'T')}+08:00`)
}
/** 倒计时只用于展示，资格始终采用服务端旗标；更正单号不会产生新的发货截止。 */
const receiptCountdown = computed(() => {
  const deadline = beijingTimestamp(props.order.autoConfirmAt)
  if (!Number.isFinite(deadline) || !Number.isFinite(serverBaseline.value)) return '时间读取失败，请刷新订单'
  const seconds = Math.max(0, Math.ceil((deadline - serverBaseline.value - elapsed.value) / 1000))
  if (!seconds) return '已到自动确认时间，等待系统处理'
  const days = Math.floor(seconds / 86400); const hours = Math.floor(seconds % 86400 / 3600); const minutes = Math.floor(seconds % 3600 / 60)
  return `剩余 ${days} 天 ${String(hours).padStart(2, '0')} 小时 ${String(minutes).padStart(2, '0')} 分 ${String(seconds % 60).padStart(2, '0')} 秒`
})
const fiveNodeSummary = computed(() => {
  if (props.order.status === 'REFUNDED') return '五个节点已处理，成品曾发货；订单已退款，履约已终止。'
  if (props.order.status === 'AFTER_SALE') return props.order.originalCompletedAt ? '五个节点已处理，已确认收货，订单售后处理中。' : '五个节点已处理，订单售后处理中，收货流程已暂停。'
  return `五个节点已完成，成品已发货${props.order.originalCompletedAt ? '，已确认收货' : '，等待买家收货'}。`
})
watch(() => props.order.serverTime, value => {
  serverBaseline.value = beijingTimestamp(value); monotonicBaseline = performance.now(); elapsed.value = 0
}, { immediate: true })
onMounted(() => { countdownTimer = setInterval(() => { elapsed.value = Math.max(0, performance.now() - monotonicBaseline) }, 1000) })
onBeforeUnmount(() => clearInterval(countdownTimer))
function resetForm() { mode.value = undefined; nodeId.value = ''; content.value = ''; imageIds.value = []; skipReason.value = ''; trackingNo.value = ''; expectedTrackingNo.value = ''; validation.value = '' }
const confirm = useConfirmation()
async function begin(kind: NonNullable<typeof mode.value>, node?: OrderProgressNodeVO) {
  const orderId = props.order.id
  if (disabled.value) return
  if (mode.value && (content.value || imageIds.value.length || trackingNo.value || skipReason.value)
    && !(await confirm({ title: '切换履约操作？', message: '未提交的输入将清空。', confirmLabel: '确认切换' }))) return
  if (disabled.value || props.order.id !== orderId) return
  resetForm(); mode.value = kind; nodeId.value = node?.id || ''; expectedTrackingNo.value = props.order.trackingNo || ''
  void nextTick(() => { editor.value?.scrollIntoView({ block: 'nearest' }); editor.value?.querySelector<HTMLElement>('textarea, input')?.focus({ preventScroll: true }) })
}
function uploadState(value: boolean) { uploading.value = value; emit('uploading', value) }
/** 首次图文、跳过、补充和发货分别校验，包装发货绝不拆成两次提交。 */
async function submit() {
  if (disabled.value || !mode.value) return
  validation.value = ''; const text = content.value.trim(); const images = [...imageIds.value]
  if (mode.value === 'refund') {
    if (!props.order.canRequestNoStartRefund) { validation.value = '退款资格已变化，请刷新订单核对'; return }
    if (text.length < 20 || text.length > 500 || images.length > 3) { validation.value = '退款说明需20—500字，凭证最多3张'; return }
    const orderId = props.order.id
    const message = `订单 ${props.order.orderNo} 将退还全部实付金额 ¥ ${props.order.paidAmount}、终止履约并取消待结算。`
    if (!(await confirm({ title: '确认无责退款？', message, confirmLabel: '确认退款' }))) return
    if (disabled.value || props.order.id !== orderId || mode.value !== 'refund' || !props.order.canRequestNoStartRefund) return
    emit('submit', { kind: 'refund', input: { description: text, imageIds: images } }); return
  }
  const tracking = trackingNo.value.trim()
  if (mode.value === 'tracking') {
    if (!props.order.canCorrectTracking) { validation.value = '当前订单不可更正运单号，请刷新订单'; return }
    if (!/^[A-Za-z0-9]{8,30}$/.test(tracking) || tracking === expectedTrackingNo.value) { validation.value = '请输入与原单号不同的8—30位字母数字运单号'; return }
    emit('submit', { kind: 'tracking', input: { requestKey: crypto.randomUUID(), expectedTrackingNo: expectedTrackingNo.value, trackingNo: tracking } }); return
  }
  if (mode.value === 'shipment' && stock.value) {
    if (!props.order.canShip || frozen.value || !/^[A-Za-z0-9]{8,30}$/.test(tracking)) { validation.value = '当前不可发货，或运单号不符合8—30位字母数字规则'; return }
    emit('submit', { kind: 'shipment', nodeId: 'STOCK', input: { requestKey: crypto.randomUUID(), content: '', imageIds: [], trackingNo: tracking } }); return
  }
  const node = currentNode.value
  const allowed = node && (mode.value === 'supplement' ? node.canSupplement : mode.value === 'skip' ? node.canSkip : mode.value === 'shipment' ? props.order.canShip && node.nodeCode === 'SHIPPING' : node.canCheckIn && node.nodeCode !== 'SHIPPING')
  if (!allowed || frozen.value) { validation.value = '节点资格已变化，请刷新订单核对'; return }
  if (mode.value === 'skip') {
    if (!skipReason.value.trim() || text.length < 10 || text.length > 500) { validation.value = '请填写跳过原因和10—500字跳过说明'; return }
  } else if (mode.value === 'supplement') {
    if ((!text && !images.length) || text.length > 500 || images.length > 6) { validation.value = '补充需文字或图片至少一项，最多500字及6张图片'; return }
  } else if (text.length < 5 || text.length > 500 || images.length < 1 || images.length > 6) { validation.value = '首次打卡需5—500字说明和1—6张阶段实拍图'; return }
  if (mode.value === 'shipment' && !/^[A-Za-z0-9]{8,30}$/.test(tracking)) { validation.value = '运单号需8—30位字母数字'; return }
  const input = { requestKey: crypto.randomUUID(), content: text, imageIds: images }
  if (mode.value === 'skip') emit('submit', { kind: 'skip', nodeId: node.id, input: { ...input, skipReason: skipReason.value.trim() } })
  else if (mode.value === 'shipment') emit('submit', { kind: 'shipment', nodeId: node.id, input: { ...input, trackingNo: tracking } })
  else emit('submit', { kind: mode.value, nodeId: node.id, input })
}
async function natural(kind: 'start' | 'receipt') {
  const orderId = props.order.id
  const allowed = () => !disabled.value && (kind === 'start' ? props.order.canStart : props.order.canConfirmReceipt)
  if (!allowed()) return
  if (kind === 'receipt' && !(await confirm({ title: '确认收到成品？', message: `订单 ${props.order.orderNo} 将完成，制作节点将只读。`, confirmLabel: '确认收货' }))) return
  if (props.order.id !== orderId || !allowed()) return
  emit('submit', { kind })
}
function deviation(node: OrderProgressNodeVO) {
  if (node.deviationDays === null || node.deviationDays === undefined) return ''
  if (node.deviationDays === 0) return '按参考日完成'
  return node.deviationDays > 0 ? `${node.handledAt ? '延后' : '已超参考日'} ${node.deviationDays} 天` : `提前 ${Math.abs(node.deviationDays)} 天`
}
watch(() => props.reset, resetForm)
/** 刷新后仅恢复原操作输入；结果未知期间所有字段锁定，重试由父级复用原请求。 */
watch(() => props.pending, pending => {
  if (!pending || pending.kind === 'start' || pending.kind === 'receipt') return
  mode.value = pending.kind; nodeId.value = 'nodeId' in pending ? pending.nodeId : ''; validation.value = ''
  if (pending.kind === 'refund') { content.value = pending.input.description; imageIds.value = [...pending.input.imageIds]; return }
  if (pending.kind === 'tracking') { trackingNo.value = pending.input.trackingNo; expectedTrackingNo.value = pending.input.expectedTrackingNo; return }
  content.value = pending.input.content; imageIds.value = [...pending.input.imageIds]
  skipReason.value = pending.kind === 'skip' ? pending.input.skipReason : ''; trackingNo.value = pending.kind === 'shipment' ? pending.input.trackingNo : ''
}, { immediate: true })
</script>
<template>
  <section
    v-if="order.progressNodes?.length || stock && ['PENDING_SHIP', 'SHIPPED', 'COMPLETED', 'AFTER_SALE', 'REFUNDED'].includes(order.status)"
    class="editor-section fulfillment-panel"
    :aria-label="stock ? '现货履约' : '订单制作履约'"
  >
    <header class="fulfillment-heading">
      <div>
        <h2>{{ stock ? '现货履约' : '制作进度' }}</h2><p class="field-help">
          {{ stock ? '现货不经过制作节点，支付后 48 小时内发货。' : '参考计划在支付时确定，时间均为北京时间。' }}
        </p>
      </div>
      <strong
        v-if="!stock"
        class="progress-count"
      >{{ completed }}/5</strong>
    </header>
    <div
      v-if="!stock"
      class="order-progress-meter"
      role="progressbar"
      aria-label="已处理制作节点"
      :aria-valuenow="completed"
      aria-valuemin="0"
      aria-valuemax="5"
    >
      <span
        v-for="node in order.progressNodes"
        :key="node.id"
        :data-node-status="node.status"
        aria-hidden="true"
      />
    </div>
    <p
      v-if="completed === 4 && !frozen"
      class="fulfillment-stage"
    >
      制作完成，待包装发货
    </p>
    <p
      v-else-if="completed === 5"
      class="fulfillment-stage"
    >
      {{ fiveNodeSummary }}
    </p>
    <p
      v-if="order.shippingOverdue"
      class="shipping-warning"
      role="status"
    >
      已超过约定发货截止时间，请在订单会话沟通安排。
    </p>
    <p
      v-if="order.status === 'AFTER_SALE'"
      class="review-reason"
    >
      售后处理中，开工、节点推进、发货与收货暂停；可在原会话补充证据。
    </p>
    <p
      v-else-if="terminal"
      class="field-help"
    >
      订单已{{ order.status === 'REFUNDED' ? '退款' : order.status === 'CANCELLED' ? '取消' : '完成' }}。{{ stock ? '' : '制作节点和初始计划只读。' }}补充证据请进入订单会话。
    </p>
    <div
      v-if="order.canStart || order.canRequestNoStartRefund"
      class="fulfillment-actions"
    >
      <button
        v-if="order.canStart"
        class="button-primary"
        :disabled="disabled"
        @click="natural('start')"
      >
        确认开工
      </button>
      <button
        v-if="order.canRequestNoStartRefund"
        class="button-secondary"
        :disabled="disabled"
        @click="begin('refund')"
      >
        申请未开工全额退款
      </button>
    </div>
    <p
      v-if="order.status === 'PAID' && order.startDeadlineAt"
      class="field-help"
    >
      请于 {{ formatTime(order.startDeadlineAt) }} 前确认开工；支付满48小时仍未开工，买家可申请系统无责全额退款。
    </p>
    <p
      v-if="order.startedAt"
      class="field-help"
    >
      实际开工 {{ formatTime(order.startedAt) }}
    </p>
    <div
      v-if="stock && order.canShip && !frozen"
      class="fulfillment-actions"
    >
      <button
        class="button-primary"
        :disabled="disabled"
        @click="begin('shipment')"
      >
        填写运单并发货
      </button>
    </div>
    <ol
      v-if="!stock"
      class="order-progress fulfillment-progress"
    >
      <li
        v-for="node in order.progressNodes"
        :id="`progress-${node.id}`"
        :key="node.id"
        :data-node-code="node.nodeCode"
        :data-node-status="node.status"
        tabindex="-1"
        :class="{ 'node-handled': ['CHECKED', 'SKIPPED'].includes(node.status), 'node-overdue': node.overdue }"
      >
        <div class="node-heading">
          <strong>{{ progressNodeName[node.nodeCode] || node.nodeCode }}</strong>
          <span class="order-node-status">{{ progressNodeStatus[node.status] || node.status }}</span>
        </div>
        <div class="node-dates">
          <p>参考完成日 {{ node.plannedFinishDate }}</p><span
            v-if="node.overdue"
            class="shipping-warning"
          >已超参考日</span><span v-if="node.handledAt || node.overdue">{{ deviation(node) }}</span>
        </div>
        <time v-if="node.handledAt">{{ node.status === 'SKIPPED' ? '实际跳过' : '实际打卡' }} {{ formatTime(node.handledAt) }}</time>
        <article
          v-for="(record, index) in node.records || []"
          :key="record.id"
          class="progress-record"
        >
          <header><strong>{{ record.recordType === 'SKIP' ? '跳过打样' : record.recordType === 'SUPPLEMENT' ? '追加补充' : index === 0 ? '首次打卡' : '打卡记录' }}</strong><time>{{ formatTime(record.createdAt) }}</time></header>
          <p v-if="record.skipReason">
            跳过原因：{{ record.skipReason }}
          </p><p
            v-if="record.content"
            class="request-description"
          >
            {{ record.content }}
          </p>
          <QuoteImages
            :image-ids="record.imageIds"
            scope="progress"
            :label="`${progressNodeName[node.nodeCode]}阶段图片`"
          />
        </article>
        <div class="node-actions">
          <button
            v-if="node.canCheckIn && node.nodeCode !== 'SHIPPING' && !frozen"
            class="button-secondary"
            :disabled="disabled"
            @click="begin('check-in', node)"
          >
            提交打卡
          </button>
          <button
            v-if="node.canSkip && !frozen"
            class="inline-button"
            :disabled="disabled"
            @click="begin('skip', node)"
          >
            跳过打样
          </button>
          <button
            v-if="node.canSupplement && !frozen"
            class="inline-button"
            :disabled="disabled"
            @click="begin('supplement', node)"
          >
            追加补充
          </button>
          <button
            v-if="node.nodeCode === 'SHIPPING' && order.canShip && !frozen"
            class="button-primary"
            :disabled="disabled"
            @click="begin('shipment', node)"
          >
            包装并发货
          </button>
          <RouterLink
            v-if="order.conversationId"
            :to="{ path: `/messages/conversations/${order.conversationId}`, query: { progressNodeId: node.id } }"
          >讨论此进度 ↗</RouterLink>
        </div>
      </li>
    </ol>
    <form
      v-if="mode"
      ref="editor"
      class="fulfillment-form"
      :aria-label="fulfillmentActionName[mode]"
      @submit.prevent="submit"
    >
      <h3>{{ currentNode ? `${progressNodeName[currentNode.nodeCode]} · ` : '' }}{{ fulfillmentActionName[mode] }}</h3>
      <p
        v-if="mode === 'refund'"
        class="field-help"
      >
        系统核验支付已满48小时且尚未开工后直接退还原实付金额 ¥ {{ order.paidAmount }}，无需卖方或管理员批准。
      </p>
      <p
        v-if="mode === 'shipment'"
        class="field-help"
      >
        阶段图文与运单号一次确认后同时生效，记录发货时间并进入七天自动确认收货。
      </p>
      <p
        v-if="mode === 'tracking'"
        class="field-help"
      >
        原运单号 {{ expectedTrackingNo }}。更正保留历史，不改变发货时间与自动确认收货时间。
      </p>
      <label
        v-if="mode === 'skip'"
        class="work-field"
      >跳过原因<input
        v-model="skipReason"
        aria-label="跳过原因"
        maxlength="500"
        :disabled="disabled"
      ></label>
      <label
        v-if="mode !== 'tracking' && !(stock && mode === 'shipment')"
        class="work-field"
      >{{ mode === 'refund' ? '退款说明' : mode === 'skip' ? '跳过说明' : mode === 'supplement' ? '补充说明' : '阶段说明' }}<textarea
        v-model="content"
        :aria-label="mode === 'refund' ? '退款说明' : mode === 'skip' ? '跳过说明' : mode === 'supplement' ? '补充说明' : '阶段说明'"
        rows="4"
        maxlength="500"
        :disabled="disabled"
      /></label>
      <p
        v-if="mode !== 'tracking' && !(stock && mode === 'shipment')"
        class="field-help"
      >
        {{ content.length }}/500 · {{ mode === 'refund' ? '说明至少20字，凭证可选' : mode === 'skip' ? '说明至少10字' : mode === 'supplement' ? '文字或图片至少一项，可纯文字或纯图片' : '说明至少5字，阶段实拍图至少1张' }}
      </p>
      <PrivateImagePicker
        v-if="mode !== 'tracking' && mode !== 'skip' && !(stock && mode === 'shipment')"
        v-model="imageIds"
        :label="mode === 'refund' ? '退款凭证' : '阶段实拍图'"
        :max="mode === 'refund' ? 3 : 6"
        :order-id="order.id"
        :scope="mode === 'refund' ? 'refund' : 'progress'"
        :disabled="busy || blocked"
        @uploading="uploadState"
      />
      <label
        v-if="mode === 'shipment' || mode === 'tracking'"
        class="work-field"
      >运单号<input
        v-model="trackingNo"
        aria-label="运单号"
        maxlength="30"
        placeholder="8—30位字母数字"
        :disabled="disabled"
      ></label>
      <p
        v-if="validation"
        class="field-error"
        role="alert"
      >
        {{ validation }}
      </p>
      <div class="fulfillment-actions">
        <button
          class="button-primary"
          :disabled="disabled"
        >
          {{ busy ? '正在提交…' : fulfillmentActionName[mode] }}
        </button><button
          type="button"
          class="inline-button"
          :disabled="disabled"
          @click="resetForm"
        >
          暂不提交
        </button>
      </div>
    </form>
    <section
      v-if="order.trackingNo"
      class="shipment-information"
      aria-label="发货与物流信息"
    >
      <h3>发货与物流</h3><dl class="work-specifications">
        <div><dt>运单号</dt><dd>{{ order.trackingNo }}</dd></div><div v-if="order.shippedAt">
          <dt>发货时间</dt><dd>{{ formatTime(order.shippedAt) }}</dd>
        </div><div v-if="order.autoConfirmAt && !order.originalCompletedAt && !frozen">
          <dt>自动确认收货</dt><dd>{{ formatTime(order.autoConfirmAt) }}</dd>
        </div><div v-if="order.originalCompletedAt">
          <dt>最初完成时间</dt><dd>{{ formatTime(order.originalCompletedAt) }}</dd>
        </div>
      </dl>
      <p
        v-if="order.status === 'AFTER_SALE' && !order.originalCompletedAt"
        class="field-help"
        role="status"
      >
        自动确认收货已暂停（售后处理中）
      </p>
      <p
        v-else-if="order.status === 'SHIPPED' && order.autoConfirmAt && !terminal"
        class="fulfillment-stage"
        role="timer"
        aria-label="自动确认收货倒计时"
      >
        自动确认收货：{{ receiptCountdown }}
      </p>
      <div class="fulfillment-actions">
        <button
          v-if="order.canCorrectTracking && !frozen"
          class="button-secondary"
          :disabled="disabled"
          @click="begin('tracking')"
        >
          更正运单号
        </button><button
          v-if="order.canConfirmReceipt && !frozen"
          class="button-primary"
          :disabled="disabled"
          @click="natural('receipt')"
        >
          确认收货
        </button>
      </div>
      <details
        v-if="order.trackingHistory?.length"
        class="tracking-history"
      >
        <summary>运单更正历史（{{ order.trackingHistory.length }}）</summary><article
          v-for="item in order.trackingHistory"
          :key="item.id"
        >
          <p>{{ item.oldTrackingNo }} → {{ item.newTrackingNo }}</p><small>操作人 {{ item.operatorId === order.creatorId ? order.creatorNickname : item.operatorId }} · {{ formatTime(item.createdAt) }}</small>
        </article>
      </details>
    </section>
    <section
      v-if="order.noStartRefund"
      class="refund-result"
      aria-label="系统无责退款记录"
    >
      <h3>未开工全额退款成功</h3><dl class="work-specifications">
        <div>
          <dt>退款金额</dt><dd class="quote-amount">
            ¥ {{ order.noStartRefund.amount }}
          </dd>
        </div><div><dt>退款流水</dt><dd>{{ order.noStartRefund.flowNo }}</dd></div><div><dt>退款时间</dt><dd>{{ formatTime(order.noStartRefund.occurredAt) }}</dd></div>
      </dl><p class="request-description">
        申请说明：{{ order.noStartRefund.description }}
      </p><p>{{ order.noStartRefund.decisionReason }}</p><QuoteImages
        :image-ids="order.noStartRefund.imageIds"
        scope="refund"
        label="退款凭证"
      /><p class="field-help">
        原支付与应结算金额保留，待结算已取消。订单会话继续保留，可补充沟通与证据。
      </p>
    </section>
    <p
      v-if="graphMode && blocked"
      class="field-help"
    >
      原始输入已保留，核验未知结果前暂不能修改。
    </p>
  </section>
</template>
