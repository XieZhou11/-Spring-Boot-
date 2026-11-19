<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import QuoteImages from '@/components/QuoteImages.vue'
import PrivateImage from '@/components/PrivateImage.vue'
import { cancelOrder, getOrder, payOrder } from '@/api/quote'
import type { OrderPaymentDTO, OrderVO } from '@/types/quote'
import { orderReason, orderStatus, progressNodeName, progressNodeStatus, settlementStatus } from '@/utils/quote'
import { formatTime } from '@/utils/creator'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { ApiError } from '@/utils/request'
import { clearPaymentAttempt, readPaymentAttempt, savePaymentAttempt } from '@/utils/orderPayment'
import '@/assets/styles/custom-request.css'
import '@/assets/styles/quote.css'
const route = useRoute(); const auth = useAuthStore(); const notifications = useNotificationsStore()
const order = ref<OrderVO>(); const loading = ref(false); const cancelling = ref(false); const error = ref('')
const paymentState = ref<'idle' | 'submitting' | 'unknown'>('idle'); const paymentError = ref(''); const confirmationOpen = ref(false); const agreed = ref(false); const retryChecked = ref(false)
const busy = computed(() => cancelling.value || paymentState.value === 'submitting')
let revision = 0; let deferredRefresh = false; let attempt: OrderPaymentDTO | undefined
/** 订单上下文仅在本详情路由有效，离页与其他资源的同名参数不能触发订单查询。 */
const id = () => route.name === 'order-detail' && typeof route.params.id === 'string' && /^[1-9]\d*$/.test(route.params.id) ? route.params.id : undefined
const unknownMessage = '付款结果尚未确认，请刷新订单核验；核验后可重试确认同一笔支付，请勿取消订单。'
function currentContext() { return { userId: auth.session?.userId, orderId: id() } }
function sameContext(context: ReturnType<typeof currentContext>) { return !!context.userId && !!context.orderId && context.userId === auth.session?.userId && context.orderId === id() }
function clearAttempt(context = currentContext()) {
  if (context.userId && context.orderId) clearPaymentAttempt(context.userId, context.orderId)
  attempt = undefined; paymentState.value = 'idle'; retryChecked.value = false; confirmationOpen.value = false; agreed.value = false
}
/** 查询始终以当前身份与订单为界，临时故障保留详情；权限失效立即清空。 */
async function load() {
  const context = currentContext(); if (!context.userId || !context.orderId) return
  if (busy.value) { deferredRefresh = true; return }
  const current = ++revision; loading.value = true; error.value = ''; retryChecked.value = false
  try {
    const result = await getOrder(context.orderId)
    if (current !== revision || !sameContext(context)) return
    if (order.value?.paymentPreview?.shipDate !== result.paymentPreview?.shipDate || order.value?.paymentPreview?.termsVersion !== result.paymentPreview?.termsVersion) agreed.value = false
    order.value = result
    if (paymentState.value === 'unknown') {
      // 截止时刻的取消可能只是查询投影，不能据此抹掉尚在提交的原付款确认。
      if (result.payment || result.paidAt) { clearAttempt(context); paymentError.value = '' }
      else { retryChecked.value = true; paymentError.value = unknownMessage }
    }
  } catch (failure) {
    if (current !== revision || !sameContext(context)) return
    if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) { order.value = undefined; clearAttempt(context); paymentError.value = '' }
    error.value = failure instanceof Error ? failure.message : '订单读取失败'
  }
  finally { if (current === revision) loading.value = false }
}
/** 取消仅操作当前订单；响应未知可刷新或重试，不在页面提前改变状态。 */
async function cancel() {
  if (!order.value?.canCancel || busy.value || paymentState.value === 'unknown' || !window.confirm('确认取消未付款订单？需求将关闭，中标与落选报价不会恢复，重新选择需发布新需求。')) return
  // 取消开始即作废在途旧查询，避免旧待付款快照覆盖已提交的取消结果。
  const context = currentContext(); if (!context.userId || !context.orderId) return
  const current = ++revision; loading.value = false; cancelling.value = true; error.value = ''
  try { const result = await cancelOrder(context.orderId); if (current === revision && sameContext(context)) { order.value = result; confirmationOpen.value = false } }
  catch (failure) { if (current === revision && sameContext(context)) error.value = `${failure instanceof Error ? failure.message : '取消请求失败'}。请刷新订单核对结果，再决定是否重试。` }
  finally { if (sameContext(context)) { cancelling.value = false; finishDeferredRefresh() } }
}
function openPayment() { if (!busy.value && order.value?.canPay && paymentState.value === 'idle') { confirmationOpen.value = true; agreed.value = false; paymentError.value = '' } }
/** 首次确认与未知结果重试冻结同一输入；提交前作废所有旧GET，杜绝旧快照回写。 */
async function pay() {
  if (busy.value || !order.value) return
  const context = currentContext(); if (!context.userId || !context.orderId || order.value.id !== context.orderId || !order.value.owned) return
  if (paymentState.value === 'unknown') { if (!attempt || !retryChecked.value) return }
  else {
    const preview = order.value.paymentPreview
    if (!order.value.canPay || !preview || !agreed.value || !confirmationOpen.value) return
    attempt = { termsConfirmed: true, termsVersion: preview.termsVersion, confirmedShipDate: preview.shipDate }
  }
  if (!attempt) return
  const input = { ...attempt }; const current = ++revision
  loading.value = false; error.value = ''; paymentError.value = ''
  // 在发送前持久化未知标记，即使刷新发生在响应到达前仍可先核验原交易。
  try { savePaymentAttempt(context.userId, context.orderId, input) }
  catch {
    // 这时尚未发送HTTP，保留原确认表单并恢复操作，不能进入永久提交中或误称结果未知。
    const unchanged = paymentState.value === 'unknown' ? '本次重试未提交，原付款结果尚未确认。' : '本次未提交付款。'
    paymentError.value = `浏览器存储暂时不可用，无法保存付款确认。${unchanged}请允许本网站使用浏览器存储后重试。`
    return
  }
  paymentState.value = 'submitting'; retryChecked.value = false
  try {
    const result = await payOrder(context.orderId, input)
    if (current !== revision || !sameContext(context)) return
    order.value = result; clearAttempt(context); paymentError.value = ''
  } catch (failure) {
    if (current !== revision || !sameContext(context)) return
    const unknown = !(failure instanceof ApiError) || !failure.status || failure.status >= 500
    if (unknown) { paymentState.value = 'unknown'; paymentError.value = unknownMessage; deferredRefresh = true }
    else {
      clearAttempt(context)
      if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) order.value = undefined
      paymentError.value = `${failure instanceof Error ? failure.message : '支付请求已被拒绝'}。请核对最新订单和条款后重新确认。`
      deferredRefresh = true
    }
  } finally {
    if (sameContext(context)) { if (paymentState.value === 'submitting') paymentState.value = 'idle'; finishDeferredRefresh() }
  }
}
function finishDeferredRefresh() { if (deferredRefresh && !busy.value) { deferredRefresh = false; void load() } }
function refresh() { void load() }
function visible() { if (document.visibilityState === 'visible') refresh() }
onBeforeRouteLeave(() => !auth.session || !busy.value); onBeforeRouteUpdate(() => !auth.session || !busy.value)
watch([() => route.name, () => route.params.id, () => auth.session?.userId], () => {
  revision++; order.value = undefined; loading.value = false; cancelling.value = false; deferredRefresh = false; confirmationOpen.value = false; agreed.value = false; error.value = ''; paymentError.value = ''; retryChecked.value = false
  // 普通离页只重置本页内存，保留原订单的未知付款标记，返回后仍须核验再重试。
  const context = currentContext(); attempt = context.userId && context.orderId ? readPaymentAttempt(context.userId, context.orderId) : undefined
  paymentState.value = attempt ? 'unknown' : 'idle'; if (attempt) paymentError.value = unknownMessage
  void load()
}, { immediate: true })
watch(() => notifications.connected, (connected, previous) => { if (connected && !previous) refresh() })
onMounted(() => { window.addEventListener('order-updated', refresh); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible) })
onBeforeUnmount(() => { revision++; window.removeEventListener('order-updated', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) })
</script>
<template>
  <WorkLayout>
    <nav class="work-breadcrumb">
      <RouterLink :to="order && !order.owned ? '/orders?side=CREATOR' : '/orders'">我的订单</RouterLink><span>/</span><span>订单详情</span>
    </nav>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }} <button
        class="inline-button"
        :disabled="busy"
        @click="load"
      >
        刷新订单
      </button>
    </p><p
      v-if="paymentError"
      class="form-alert"
      role="alert"
    >
      {{ paymentError }} <button
        v-if="paymentState === 'unknown'"
        class="inline-button"
        :disabled="busy || !retryChecked"
        @click="pay"
      >
        重试确认支付结果
      </button>
    </p><p
      v-if="loading && !order"
      role="status"
    >
      正在读取订单…
    </p>
    <template v-if="order">
      <header class="work-section-heading">
        <div>
          <p class="eyebrow">
            订单号 {{ order.orderNo }}
          </p><h1>{{ order.title }}</h1><p class="muted">
            {{ order.buyerNickname }} × {{ order.creatorNickname }} · 定制订单
          </p>
        </div><span class="work-status">{{ orderStatus[order.status] || order.status }}</span>
      </header>
      <div class="order-detail-grid">
        <div>
          <section
            v-if="confirmationOpen && order.paymentPreview && paymentState === 'idle'"
            class="award-panel payment-confirmation"
            aria-label="确认模拟支付"
          >
            <h2>确认模拟支付</h2><p class="quote-amount">
              实付 ¥ {{ order.totalAmount }}
            </p>
            <address
              v-if="order.addressSnapshot"
              class="award-address"
            >
              <strong>{{ order.addressSnapshot.recipientName }} · {{ order.addressSnapshot.phone }}</strong><br>{{ order.addressSnapshot.province }} {{ order.addressSnapshot.city }} {{ order.addressSnapshot.district }} {{ order.addressSnapshot.detailAddress }}
            </address>
            <dl class="work-specifications">
              <div><dt>约定工期</dt><dd>{{ order.durationDays }} 个自然日</dd></div><div><dt>定标预计发货日</dt><dd>{{ order.agreementSnapshot.confirmedEstimatedShipDate }}</dd></div><div><dt>支付约定发货日</dt><dd>{{ order.paymentPreview.shipDate }}</dd></div>
            </dl><p class="field-help">
              包含开工等待，从支付次日零时起算；以上日期为发货日，不是送达日。
            </p>
            <p
              v-if="order.paymentPreview.shipDate > order.agreementSnapshot.expectedShipDate"
              class="shipping-warning"
            >
              本次约定发货日晚于需求期望 {{ order.agreementSnapshot.expectedShipDate }}，请核对后再确认。
            </p><p class="request-description payment-terms">
              {{ order.paymentPreview.termsText }}
            </p>
            <label class="award-confirmation"><input
              v-model="agreed"
              type="checkbox"
              :disabled="busy"
            >我已阅读并同意定制支付条款</label>
            <div class="payment-actions">
              <button
                class="button-primary"
                :disabled="busy || !agreed"
                @click="pay"
              >
                确认模拟支付
              </button><button
                class="inline-button"
                :disabled="busy"
                @click="confirmationOpen = false"
              >
                暂不支付
              </button>
            </div>
          </section>
          <section class="editor-section">
            <h2>锁定的合作方案</h2><dl class="work-specifications">
              <div>
                <dt>商品成交金额</dt><dd class="quote-amount">
                  ¥ {{ order.totalAmount }}
                </dd>
              </div><div><dt>买家实付金额</dt><dd>{{ order.paidAmount === null || order.paidAmount === undefined ? '尚未付款' : `¥ ${order.paidAmount}` }}</dd></div><div><dt>约定工期</dt><dd>{{ order.durationDays }} 个自然日</dd></div><div><dt>期望发货</dt><dd>{{ order.agreementSnapshot.expectedShipDate }}</dd></div><div><dt>定标预计发货日</dt><dd>{{ order.agreementSnapshot.confirmedEstimatedShipDate }}</dd></div>
            </dl><p class="field-help">
              工期含开工等待，自实际支付次日零时起算；最终发货日期由实际支付时间确定，不代表送达日期。
            </p><h3>材料与工艺方案</h3><p class="request-description">
              {{ order.agreementSnapshot.proposal }}
            </p><p
              v-if="order.agreementSnapshot.additionalAgreement"
              class="request-description"
            >
              补充约定：{{ order.agreementSnapshot.additionalAgreement }}
            </p><QuoteImages :image-ids="order.agreementSnapshot.imageIds" />
          </section>
          <section
            v-if="order.payment"
            class="editor-section"
          >
            <h2>支付记录</h2><dl class="work-specifications">
              <div><dt>支付流水号</dt><dd>{{ order.payment.flowNo }}</dd></div><div><dt>实付金额</dt><dd>¥ {{ order.payment.amount }}</dd></div><div><dt>支付结果</dt><dd>{{ order.payment.result === 'SUCCESS' ? '模拟支付成功' : order.payment.result }}</dd></div><div><dt>支付时间</dt><dd>{{ formatTime(order.payment.occurredAt) }}</dd></div><div><dt>条款确认时间</dt><dd>{{ order.termsConfirmedAt ? formatTime(order.termsConfirmedAt) : '—' }}</dd></div>
            </dl><h3>已确认的支付条款</h3><p class="request-description payment-terms">
              {{ order.payment.termsText }}
            </p>
          </section>
          <section
            v-if="order.progressNodes?.length"
            class="editor-section"
          >
            <h2>制作参考计划</h2><p class="field-help">
              支付时固定的初始参考计划，等待创作者确认开工。
            </p>
            <ol class="order-progress">
              <li
                v-for="node in order.progressNodes"
                :key="node.id"
              >
                <div><strong>{{ progressNodeName[node.nodeCode] || node.nodeCode }}</strong><span>{{ progressNodeStatus[node.status] || node.status }}</span></div><p>参考完成日 {{ node.plannedFinishDate }}</p><time v-if="node.handledAt">实际处理 {{ formatTime(node.handledAt) }}</time>
              </li>
            </ol>
          </section>
          <section
            v-if="!order.owned && order.settlement"
            class="editor-section"
          >
            <h2>结算信息</h2><dl class="work-specifications">
              <div><dt>应结算金额</dt><dd>¥ {{ order.settlement.paidAmount }}</dd></div><div><dt>结算状态</dt><dd>{{ settlementStatus[order.settlement.status] || order.settlement.status }}</dd></div><div><dt>收款账户</dt><dd>{{ order.settlement.maskedPayee }}</dd></div>
            </dl>
          </section>
          <section class="editor-section">
            <h2>需求快照</h2><p class="field-help">
              {{ order.agreementSnapshot.request.categoryPath.join(' / ') }}
            </p><p class="request-description">
              {{ order.agreementSnapshot.request.description }}
            </p><dl class="work-specifications">
              <div><dt>用途</dt><dd>{{ order.agreementSnapshot.request.purpose }}</dd></div><div><dt>材质偏好</dt><dd>{{ order.agreementSnapshot.request.materialPreference }}</dd></div><div><dt>尺寸规格</dt><dd>{{ order.agreementSnapshot.request.specification }}</dd></div>
            </dl><div class="request-images">
              <PrivateImage
                v-for="(imageId, index) in order.agreementSnapshot.request.referenceImageIds"
                :key="imageId"
                :image-id="imageId"
                scope="request"
                :label="`订单需求参考图 ${index + 1}`"
              />
            </div><RouterLink :to="`/requests/${order.requestId}`">查看原需求 ↗</RouterLink>
          </section>
          <section
            v-if="order.owned && order.addressSnapshot"
            class="editor-section"
          >
            <h2>收货地址快照</h2><address class="award-address">
              <strong>{{ order.addressSnapshot.recipientName }} · {{ order.addressSnapshot.phone }}</strong><br>{{ order.addressSnapshot.province }} {{ order.addressSnapshot.city }} {{ order.addressSnapshot.district }} {{ order.addressSnapshot.detailAddress }}
            </address><p class="field-help">
              建单时已固定；修改个人地址不会改变此订单。未付款地址有误可取消订单，并重新发布需求取得报价。
            </p>
          </section>
        </div>
        <aside>
          <section class="editor-section request-summary">
            <h2>订单安排</h2><p>创建于 {{ formatTime(order.createdAt) }}</p><template v-if="order.status === 'PENDING_PAY'">
              <p>付款截止<br><strong>{{ formatTime(order.payDeadlineAt) }}</strong></p><p class="field-help">
                创建后 24 小时未付款，订单将取消，关联需求关闭。
              </p>
            </template><p v-if="order.shipDate">
              约定发货日<br><strong>{{ order.shipDate }}</strong>
            </p><p
              v-if="order.cancelReason"
              class="review-reason"
            >
              {{ orderReason(order.cancelReason) }}
            </p><RouterLink
              :to="`/messages/conversations/${order.conversationId}`"
              class="button-primary"
            >进入订单沟通</RouterLink><button
              v-if="order.canPay && paymentState === 'idle' && !confirmationOpen"
              class="button-primary"
              :disabled="busy"
              @click="openPayment"
            >
              模拟支付
            </button><p
              v-if="paymentState === 'submitting'"
              role="status"
            >
              正在确认支付，请勿重复提交…
            </p><button
              v-if="order.canCancel"
              class="button-secondary"
              :disabled="busy || paymentState === 'unknown'"
              @click="cancel"
            >
              {{ cancelling ? '正在取消…' : '取消订单' }}
            </button><button
              class="inline-button"
              :disabled="loading || busy"
              @click="load"
            >
              刷新订单
            </button><p
              v-if="order.status === 'PAID'"
              class="field-help"
            >
              付款已完成，等待创作者确认开工；可在订单会话继续核对制作安排。
            </p><p
              v-else-if="order.status === 'CANCELLED'"
              class="field-help"
            >
              订单取消后仍可在原会话核对方案和补充沟通。
            </p>
          </section>
          <section class="editor-section">
            <h2>订单历史</h2><ol class="order-timeline">
              <li
                v-for="(event, index) in order.history"
                :key="`${event.createdAt}-${index}`"
              >
                <strong>{{ event.fromStatus ? `${orderStatus[event.fromStatus] || event.fromStatus} → ` : '创建订单 · ' }}{{ orderStatus[event.toStatus] || event.toStatus }}</strong><p v-if="event.reason">
                  {{ orderReason(event.reason) }}
                </p><time>{{ formatTime(event.createdAt) }}</time>
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </template>
  </WorkLayout>
</template>
