<script setup lang="ts">
import { useActivationRead } from '@/utils/pageActivation'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import OrderCollection from '@/components/OrderCollection.vue'
import { getOrderListQuery } from '@/utils/orderList'
import { hasOrderReturn, isOrderDetailSection, orderDetailLabels, type OrderDetailSection } from '@/utils/orderDetail'
import AppIcon from '@/components/AppIcon.vue'
import { buyerRequestListReturn } from '@/utils/customRequest'
import QuoteImages from '@/components/QuoteImages.vue'
import PrivateImage from '@/components/PrivateImage.vue'
import OrderFulfillmentPanel from '@/components/OrderFulfillmentPanel.vue'
import OrderRefundPanel from '@/components/OrderRefundPanel.vue'
import OrderReviewPanel from '@/components/OrderReviewPanel.vue'
import { cancelOrder, checkInProgress, confirmReceipt, correctTracking, getOrder, payOrder, requestNoStartRefund, requestPublicationConsent, respondPublicationConsent, shipOrder, skipProgress, startProduction, supplementProgress } from '@/api/quote'
import type { OrderPaymentDTO, OrderVO } from '@/types/quote'
import { orderReason, orderStatus, settlementStatus } from '@/utils/quote'
import { formatTime } from '@/utils/creator'
import { useAuthStore } from '@/stores/auth'
import { useConfirmation } from '@/composables/useConfirmation'
import { useNotificationsStore } from '@/stores/notifications'
import { ApiError } from '@/utils/request'
import { clearPaymentAttempt, readPaymentAttempt, savePaymentAttempt } from '@/utils/orderPayment'
import { clearFulfillmentAttempt, fulfillmentActionName, fulfillmentApplied, readFulfillmentAttempt, saveFulfillmentAttempt } from '@/utils/orderFulfillment'
import type { FulfillmentAttempt } from '@/utils/orderFulfillment'
import { clearRefundState, readRefundAttempt } from '@/utils/refund'
import '@/assets/styles/custom-request.css'
import '@/assets/styles/quote.css'
import '@/assets/styles/refund.css'
import '@/assets/styles/craftflow-order-detail.css'
const route = useRoute(); const router = useRouter(); const auth = useAuthStore(); const notifications = useNotificationsStore()
const confirm = useConfirmation()
const order = ref<OrderVO>(); const loading = ref(false); const cancelling = ref(false); const error = ref('')
const paymentState = ref<'idle' | 'submitting' | 'unknown'>('idle'); const paymentError = ref(''); const confirmationOpen = ref(false); const agreed = ref(false); const retryChecked = ref(false)
const fulfillmentState = ref<'idle' | 'submitting' | 'unknown'>('idle'); const fulfillmentAttempt = ref<FulfillmentAttempt>(); const fulfillmentError = ref(''); const fulfillmentRetryChecked = ref(false); const fulfillmentReset = ref(0); const fulfillmentUploading = ref(false)
const refundBusy = ref(false); const refundBlocked = ref(false)
const publicationBusy = ref(false)
const publicationNeedsCheck = ref(false)
const publicationError = ref('')
const publicationLabels = { NONE: '尚未申请', PENDING: '等待买家回复', APPROVED: '已同意公开', REJECTED: '已拒绝公开' }
const publicationStatus = computed(() => order.value?.publicationConsentStatus ?? 'NONE')
const showPublication = computed(() => order.value?.orderType === 'CUSTOM'
  && (order.value.canRequestPublicationConsent || publicationStatus.value !== 'NONE' || publicationNeedsCheck.value))
const collectionRefresh = ref(0)
const orderHeading = ref<HTMLElement>()
const paymentHeading = ref<HTMLElement>()
const paymentTrigger = ref<HTMLButtonElement>()
const orderSide = computed(() => order.value ? (order.value.owned ? 'BUYER' : 'CREATOR') : undefined)
const listQuery = computed(() => getOrderListQuery(route.query, orderSide.value))
const orderRoute = computed(() => route.name === 'order-detail' || route.name === 'order-detail-section')
const section = computed(() => route.name === 'order-detail-section' && isOrderDetailSection(route.params.section) ? route.params.section : undefined)
const sectionLabel = (value: OrderDetailSection) => value === 'agreement' && order.value?.orderType === 'STOCK'
  ? '现货作品快照'
  : orderDetailLabels[value]
const sections = computed<OrderDetailSection[]>(() => {
  const detail = order.value
  if (!detail) return []
  const available: Record<OrderDetailSection, boolean> = {
    address: !!detail.addressSnapshot,
    agreement: true,
    payment: !!detail.payment,
    review: !!detail.originalCompletedAt,
    refund: detail.orderType === 'CUSTOM' || !!detail.paidAt,
    settlement: !detail.owned && !!detail.settlement,
    request: detail.orderType === 'CUSTOM',
    publication: showPublication.value,
    history: true,
  }
  return (Object.keys(available) as OrderDetailSection[]).filter(name => available[name])
})
const sectionAvailable = computed(() => !!section.value && sections.value.includes(section.value))

/** 资料链接记录当前概览的历史条目，直达时按同一订单回跳。 */
function sectionTarget(value: OrderDetailSection) {
  return { name: 'order-detail-section', params: { id: id(), section: value }, query: route.query, state: { orderReturnTo: route.fullPath } }
}
function returnToOrder() {
  const orderId = id()
  if (!orderId) return
  if (hasOrderReturn(router, route, orderId)) router.back()
  else void router.push({ name: 'order-detail', params: { id: orderId }, query: route.query })
}
const requestReturnTo = computed(() => order.value?.owned ? buyerRequestListReturn(route.query.returnTo) : undefined)
const baseBusy = computed(() => cancelling.value || publicationBusy.value || paymentState.value === 'submitting' || fulfillmentState.value === 'submitting' || fulfillmentUploading.value)
const baseBlocked = computed(() => fulfillmentState.value === 'unknown' || paymentState.value === 'unknown')
const busy = computed(() => baseBusy.value || refundBusy.value)
const fulfillmentBlocked = computed(() => baseBlocked.value || refundBlocked.value)
let revision = 0; let deferredRefresh = false; let attempt: OrderPaymentDTO | undefined
/** 订单上下文仅在本详情路由有效，离页与其他资源的同名参数不能触发订单查询。 */
const id = () => orderRoute.value && typeof route.params.id === 'string' && /^[1-9]\d*$/.test(route.params.id) ? route.params.id : undefined
const unknownMessage = '付款结果尚未确认，请刷新订单核验；核验后可重试确认同一笔支付，请勿取消订单。'
const fulfillmentUnknownMessage = computed(() => `${fulfillmentAttempt.value ? fulfillmentActionName[fulfillmentAttempt.value.kind] : '操作'}结果尚未确认。原始输入已保留，请刷新订单核验后重试同一次操作。`)
function currentContext() { return { userId: auth.session?.userId, orderId: id() } }
function sameContext(context: ReturnType<typeof currentContext>) { return !!context.userId && !!context.orderId && context.userId === auth.session?.userId && context.orderId === id() }
function clearAttempt(context = currentContext()) {
  if (context.userId && context.orderId) clearPaymentAttempt(context.userId, context.orderId)
  attempt = undefined; paymentState.value = 'idle'; retryChecked.value = false; confirmationOpen.value = false; agreed.value = false
}
function clearFulfillment(context = currentContext(), completed = false) {
  if (context.userId && context.orderId) clearFulfillmentAttempt(context.userId, context.orderId)
  fulfillmentAttempt.value = undefined; fulfillmentState.value = 'idle'; fulfillmentRetryChecked.value = false
  if (completed) fulfillmentReset.value++
}
/** 查询始终以当前身份与订单为界，临时故障保留详情；权限失效立即清空。 */
async function load() {
  const context = currentContext(); if (!context.userId || !context.orderId) return
  if (busy.value) { deferredRefresh = true; return }
  const current = ++revision; loading.value = true; error.value = ''; retryChecked.value = false; fulfillmentRetryChecked.value = false
  try {
    const result = await getOrder(context.orderId)
    if (current !== revision || !sameContext(context)) return
    if (order.value?.paymentPreview?.shipDate !== result.paymentPreview?.shipDate || order.value?.paymentPreview?.termsVersion !== result.paymentPreview?.termsVersion) agreed.value = false
    order.value = result
    if (publicationNeedsCheck.value) {
      publicationNeedsCheck.value = false
      publicationError.value = ''
    }
    if (!result.canPay) confirmationOpen.value = false
    if (paymentState.value === 'unknown') {
      // 截止时刻的取消可能只是查询投影，不能据此抹掉尚在提交的原付款确认。
      if (result.payment || result.paidAt) { clearAttempt(context); paymentError.value = '' }
      else { retryChecked.value = true; paymentError.value = unknownMessage }
    }
    if (fulfillmentState.value === 'unknown' && fulfillmentAttempt.value) {
      if (fulfillmentApplied(result, fulfillmentAttempt.value)) { clearFulfillment(context, true); fulfillmentError.value = '' }
      else { fulfillmentRetryChecked.value = true; fulfillmentError.value = fulfillmentUnknownMessage.value }
    }
  } catch (failure) {
    if (current !== revision || !sameContext(context)) return
    if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) { order.value = undefined; clearAttempt(context); clearFulfillment(context); if (context.userId && context.orderId) { clearRefundState(context.userId, context.orderId, 'attempt'); clearRefundState(context.userId, context.orderId, 'draft') }; paymentError.value = ''; fulfillmentError.value = ''; refundBusy.value = false; refundBlocked.value = false }
    error.value = failure instanceof Error ? failure.message : '订单读取失败'
  }
  finally { if (current === revision) loading.value = false }
}
/** 取消仅操作当前订单；响应未知可刷新或重试，不在页面提前改变状态。 */
async function cancel() {
  const prompt = order.value?.orderType === 'STOCK' ? '确认取消未付款现货订单？取消后该成品将重新开放购买。' : '确认取消未付款订单？需求将关闭，中标与落选报价不会恢复，重新选择需发布新需求。'
  const context = currentContext()
  if (!context.orderId || !sameContext(context) || !order.value?.canCancel || busy.value || fulfillmentBlocked.value) return
  if (!(await confirm({ title: '取消订单？', message: `${order.value.orderNo}。${prompt}`, confirmLabel: '确认取消订单' }))) return
  if (!sameContext(context) || !order.value?.canCancel || busy.value || fulfillmentBlocked.value) return
  // 取消开始即作废在途旧查询，避免旧待付款快照覆盖已提交的取消结果。
  const current = ++revision; loading.value = false; cancelling.value = true; error.value = ''
  try { const result = await cancelOrder(context.orderId); if (current === revision && sameContext(context)) { order.value = result; confirmationOpen.value = false } }
  catch (failure) { if (current === revision && sameContext(context)) error.value = `${failure instanceof Error ? failure.message : '取消请求失败'}。请刷新订单核对结果，再决定是否重试。` }
  finally { if (sameContext(context)) { cancelling.value = false; finishDeferredRefresh() } }
}
/** 授权只通过订单详情按钮提交，聊天内容不参与授权状态判断。 */
async function publicationAction(decision?: 'APPROVED' | 'REJECTED') {
  if (busy.value || fulfillmentBlocked.value || publicationNeedsCheck.value
    || !(decision ? order.value?.canRespondPublicationConsent : order.value?.canRequestPublicationConsent)) return
  const prompt = decision === 'APPROVED'
    ? '确认同意创作者展示本次定制成品？授权不包含你的收货资料和聊天记录。'
    : decision === 'REJECTED'
      ? '确认不同意公开本次定制成品案例？'
      : '向买家申请公开本次定制成品案例？买家需要在订单页面明确回复。'
  const context = currentContext()
  if (!context.orderId || !sameContext(context)) return
  const title = decision ? '确认公开授权决定？' : '申请公开案例？'
  if (!(await confirm({ title, message: `${order.value?.orderNo}。${prompt}`, confirmLabel: decision === 'APPROVED' ? '确认同意' : decision === 'REJECTED' ? '确认不同意' : '确认申请' }))) return
  if (!sameContext(context) || busy.value || fulfillmentBlocked.value || publicationNeedsCheck.value
    || !(decision ? order.value?.canRespondPublicationConsent : order.value?.canRequestPublicationConsent)) return
  const current = ++revision
  loading.value = false
  publicationBusy.value = true
  publicationError.value = ''
  try {
    const result = decision
      ? await respondPublicationConsent(context.orderId, decision)
      : await requestPublicationConsent(context.orderId)
    if (current === revision && sameContext(context)) order.value = result
  } catch (failure) {
    if (current !== revision || !sameContext(context)) return
    // 应答丢失时先读订单，既有回复以服务端结果为准。
    publicationNeedsCheck.value = true
    try {
      const result = await getOrder(context.orderId)
      if (current !== revision || !sameContext(context)) return
      order.value = result
      publicationNeedsCheck.value = false
      if (result.publicationConsentStatus === (decision ? 'PENDING' : 'NONE')) {
        publicationError.value = failure instanceof Error ? failure.message : '未能提交公开授权，请重试。'
      }
    } catch {
      if (current === revision && sameContext(context)) publicationError.value = '公开授权结果尚未确认，请先刷新授权状态。'
    }
  } finally {
    if (sameContext(context)) {
      publicationBusy.value = false
      finishDeferredRefresh()
    }
  }
}
/** 付款区展开与收起时把键盘焦点放到相应的操作位置。 */
async function openPayment() {
  if (busy.value || fulfillmentBlocked.value || !order.value?.canPay || paymentState.value !== 'idle') return
  confirmationOpen.value = true
  agreed.value = false
  paymentError.value = ''
  await nextTick()
  paymentHeading.value?.focus()
}
async function closePayment() {
  confirmationOpen.value = false
  await nextTick()
  paymentTrigger.value?.focus()
}
/** 首次确认与未知结果重试冻结同一输入；提交前作废所有旧GET，杜绝旧快照回写。 */
async function pay() {
  if (busy.value || fulfillmentState.value !== 'idle' || refundBlocked.value || !order.value) return
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
/** 所有履约写入共享页面查询代数；未知结果冻结原参数，持久化失败绝不发送HTTP。 */
async function fulfill(candidate?: FulfillmentAttempt) {
  if (busy.value || paymentState.value !== 'idle' || refundBlocked.value || !order.value) return
  const context = currentContext(); if (!context.userId || !context.orderId || order.value.id !== context.orderId) return
  if (fulfillmentState.value === 'unknown') { if (candidate || !fulfillmentAttempt.value || !fulfillmentRetryChecked.value) return }
  else { if (!candidate) return; fulfillmentAttempt.value = candidate }
  const input = fulfillmentAttempt.value; if (!input) return
  fulfillmentError.value = ''
  try { saveFulfillmentAttempt(context.userId, context.orderId, input) }
  catch {
    fulfillmentError.value = `浏览器存储暂时不可用，本次${fulfillmentActionName[input.kind]}未提交。请允许本网站使用浏览器存储后重试。`
    if (fulfillmentState.value !== 'unknown') fulfillmentAttempt.value = undefined
    return
  }
  const current = ++revision; loading.value = false; error.value = ''; fulfillmentState.value = 'submitting'; fulfillmentRetryChecked.value = false
  try {
    let result: OrderVO
    switch (input.kind) {
      case 'start': result = await startProduction(context.orderId); break
      case 'check-in': result = await checkInProgress(context.orderId, input.nodeId, input.input); break
      case 'skip': result = await skipProgress(context.orderId, input.nodeId, input.input); break
      case 'supplement': result = await supplementProgress(context.orderId, input.nodeId, input.input); break
      case 'shipment': result = await shipOrder(context.orderId, input.input); break
      case 'tracking': result = await correctTracking(context.orderId, input.input); break
      case 'receipt': result = await confirmReceipt(context.orderId); break
      case 'refund': result = await requestNoStartRefund(context.orderId, input.input); break
    }
    if (current !== revision || !sameContext(context)) return
    order.value = result; clearFulfillment(context, true); fulfillmentError.value = ''
  } catch (failure) {
    if (current !== revision || !sameContext(context)) return
    const unknown = !(failure instanceof ApiError) || !failure.status || failure.status >= 500
    if (unknown) { fulfillmentState.value = 'unknown'; fulfillmentError.value = fulfillmentUnknownMessage.value }
    else {
      clearFulfillment(context)
      if ([401, 403, 404].includes(failure.status)) order.value = undefined
      fulfillmentError.value = `${failure.message}。输入已保留，请刷新订单核对最新状态后再提交。`
    }
    deferredRefresh = true
  } finally {
    if (sameContext(context)) { if (fulfillmentState.value === 'submitting') fulfillmentState.value = 'idle'; finishDeferredRefresh() }
  }
}
function fulfillmentUpload(value: boolean) { fulfillmentUploading.value = value; if (!value) finishDeferredRefresh() }
/** 普通售后与履约共用查询代数，较早订单快照不能覆盖新售后状态。 */
function refundWriteStart() { revision++; loading.value = false }
function refundLock(value: { busy: boolean; blocked: boolean }) { refundBusy.value = value.busy; refundBlocked.value = value.blocked; if (!value.busy) finishDeferredRefresh() }
function finishDeferredRefresh() { if (deferredRefresh && !busy.value) { deferredRefresh = false; void load() } }
function refresh() { void load() }
onBeforeRouteLeave(() => !auth.session || !busy.value); onBeforeRouteUpdate(() => !auth.session || !busy.value)
watch([orderRoute, () => route.params.id, () => auth.session?.userId], () => {
  revision++; order.value = undefined; loading.value = false; cancelling.value = false; publicationBusy.value = false; deferredRefresh = false; confirmationOpen.value = false; agreed.value = false; error.value = ''; paymentError.value = ''; retryChecked.value = false; fulfillmentUploading.value = false; fulfillmentError.value = ''; fulfillmentRetryChecked.value = false; refundBusy.value = false; refundBlocked.value = false
  publicationNeedsCheck.value = false
  publicationError.value = ''
  // 普通离页只重置本页内存，保留原订单的未知付款标记，返回后仍须核验再重试。
  const context = currentContext()
  if (orderRoute.value && !context.orderId) error.value = '订单编号无效。'
  refundBlocked.value = !!(context.userId && context.orderId && readRefundAttempt(context.userId, context.orderId))
  attempt = context.userId && context.orderId ? readPaymentAttempt(context.userId, context.orderId) : undefined
  paymentState.value = attempt ? 'unknown' : 'idle'; if (attempt) paymentError.value = unknownMessage
  fulfillmentAttempt.value = context.userId && context.orderId ? readFulfillmentAttempt(context.userId, context.orderId) : undefined
  fulfillmentState.value = fulfillmentAttempt.value ? 'unknown' : 'idle'; if (fulfillmentAttempt.value) fulfillmentError.value = fulfillmentUnknownMessage.value
  void load()
}, { immediate: true })
/** 本页状态变更后同步左栏，离线时也不保留旧订单标签。 */
watch(() => order.value?.status, (status, previous) => {
  if (status && previous && status !== previous) collectionRefresh.value++
})
watch(() => notifications.connected, (connected, previous) => { if (connected && !previous) refresh() })
/** 聚焦标题时保持视口位置，历史位置和锚点统一交由路由处理。 */
watch([section, () => order.value?.id], () => {
  if (order.value && !route.hash) void nextTick(() => orderHeading.value?.focus({ preventScroll: true }))
})
onMounted(() => { window.addEventListener('order-updated', refresh) })
onBeforeUnmount(() => { revision++; window.removeEventListener('order-updated', refresh) })
useActivationRead(() => JSON.stringify(currentContext()), load)
</script>
<template>
  <WorkLayout>
    <div
      class="craftflow-order-workspace"
      :class="{ 'craftflow-order-detail-workspace': orderRoute, 'craftflow-order-section-page': section }"
    >
      <OrderCollection
        v-show="!section"
        :selected-id="id()"
        :selected-status="order?.status"
        :default-side="orderSide"
        :resolving-side="orderRoute && !order && !error"
        :refresh-version="collectionRefresh"
      />
      <div
        v-if="!orderRoute"
        class="craftflow-order-empty-selection"
      >
        选择一笔订单查看详情
      </div>
      <div
        v-else
        class="craftflow-order-main"
        :data-order-scroll-route="order || error ? route.fullPath : undefined"
      >
        <nav class="order-back">
          <button
            v-if="section"
            class="inline-button"
            type="button"
            @click="returnToOrder"
          >
            <span aria-hidden="true">←</span> 返回订单
          </button>
          <RouterLink
            v-else
            :to="{ name: 'orders', query: listQuery }"
          ><span aria-hidden="true">←</span> 返回订单列表</RouterLink>
        </nav>
        <p
          v-if="error"
          class="form-alert"
          role="alert"
        >
          {{ error }}
          <button
            v-if="id()"
            class="inline-button"
            :disabled="busy || loading"
            @click="refresh"
          >
            刷新订单
          </button>
        </p>
        <p
          v-if="paymentError"
          class="form-alert"
          role="alert"
        >
          {{ paymentError }}
          <button
            v-if="paymentState === 'unknown'"
            class="inline-button"
            :disabled="busy || !retryChecked"
            @click="pay"
          >
            重试确认支付结果
          </button>
          <button
            class="inline-button"
            :disabled="busy || loading"
            @click="refresh"
          >
            刷新订单
          </button>
        </p>
        <p
          v-if="fulfillmentError"
          class="form-alert"
          role="alert"
        >
          {{ fulfillmentError }}
          <button
            v-if="fulfillmentState === 'unknown'"
            class="inline-button"
            :disabled="busy || !fulfillmentRetryChecked"
            @click="fulfill()"
          >
            重试确认操作结果
          </button>
          <button
            class="inline-button"
            :disabled="busy || loading"
            @click="refresh"
          >
            刷新订单
          </button>
        </p>
        <p
          v-if="fulfillmentState === 'submitting'"
          role="status"
        >
          正在提交{{ fulfillmentAttempt ? fulfillmentActionName[fulfillmentAttempt.kind] : '履约操作' }}，请勿重复提交…
        </p>
        <p
          v-if="loading && !order"
          class="order-detail-empty"
          role="status"
        >
          正在读取订单…
        </p>

        <template v-if="order">
          <section
            v-if="!section"
            class="order-overview request-summary"
          >
            <header class="work-section-heading order-overview-heading">
              <div>
                <h1
                  ref="orderHeading"
                  tabindex="-1"
                >
                  {{ order.title }}
                </h1>
                <p class="order-number">
                  订单号 <span>{{ order.orderNo }}</span>
                </p>
              </div>
              <div class="order-overview-actions">
                <button
                  v-if="order.canPay && paymentState === 'idle' && !confirmationOpen"
                  ref="paymentTrigger"
                  class="button-primary"
                  :disabled="busy || fulfillmentBlocked"
                  @click="openPayment"
                >
                  模拟支付
                </button>
                <button
                  v-if="order.canCancel"
                  class="button-secondary"
                  :disabled="busy || fulfillmentBlocked"
                  @click="cancel"
                >
                  {{ cancelling ? '正在取消…' : '取消订单' }}
                </button>
                <RouterLink
                  v-if="order.conversationId"
                  :to="{ path: '/messages/conversations/' + order.conversationId, state: { orderReturnTo: route.fullPath } }"
                  class="button-secondary"
                >进入订单沟通</RouterLink>
              </div>
            </header>
            <p
              v-if="paymentState === 'submitting'"
              role="status"
            >
              正在确认支付，请勿重复提交…
            </p>
            <dl class="order-facts">
              <div>
                <dt>商品成交金额</dt><dd class="order-total">
                  ¥ {{ order.totalAmount }}
                </dd>
              </div>
              <div><dt>买家实付金额</dt><dd>{{ order.paidAmount == null ? '尚未付款' : '¥ ' + order.paidAmount }}</dd></div>
              <div v-if="order.status === 'PENDING_PAY'">
                <dt>付款截止</dt><dd>{{ formatTime(order.payDeadlineAt) }}</dd>
              </div>
              <div v-else-if="order.orderType === 'STOCK' && order.shipDeadlineAt">
                <dt>发货截止</dt><dd><time :datetime="order.shipDeadlineAt">{{ formatTime(order.shipDeadlineAt, 'medium') }}</time></dd>
              </div>
              <div v-else-if="order.orderType === 'CUSTOM' && order.shipDate">
                <dt>约定发货日</dt><dd><time :datetime="order.shipDate">{{ order.shipDate }}</time></dd>
              </div>
              <div>
                <dt>创建时间</dt><dd>{{ formatTime(order.createdAt) }}</dd>
              </div>
            </dl>
            <p
              v-if="order.status === 'PAID'"
              class="field-help"
            >
              付款已完成，等待创作者确认开工。
            </p>
            <p
              v-if="order.cancelReason"
              class="review-reason"
            >
              {{ orderReason(order.cancelReason) }}
            </p>
          </section>

          <nav
            v-if="!section"
            class="order-document-links editor-section"
            aria-label="订单资料"
          >
            <h2>订单资料</h2>
            <div class="order-document-grid">
              <RouterLink
                v-for="item in sections"
                :key="item"
                :to="sectionTarget(item)"
              >{{ sectionLabel(item) }}<AppIcon name="arrow" /></RouterLink>
            </div>
          </nav>
          <section
            v-if="section"
            class="order-overview request-summary order-document-heading"
          >
            <header class="work-section-heading order-overview-heading">
              <div>
                <h1
                  ref="orderHeading"
                  tabindex="-1"
                >
                  {{ sectionLabel(section) }}
                </h1>
                <p class="order-number">
                  {{ order.title }} · {{ order.orderNo }}
                </p>
              </div>
            </header>
          </section>
          <p
            v-if="section && !sectionAvailable"
            class="order-detail-empty"
            role="status"
          >
            当前订单没有这项资料。
          </p>

          <section
            v-if="!section && confirmationOpen && order.paymentPreview && paymentState === 'idle'"
            class="award-panel payment-confirmation"
            aria-label="确认模拟支付"
          >
            <h2
              ref="paymentHeading"
              tabindex="-1"
            >
              确认模拟支付
            </h2>
            <p class="quote-amount">
              实付 ¥ {{ order.totalAmount }}
            </p>
            <address
              v-if="order.addressSnapshot"
              class="award-address"
            >
              <strong>{{ order.addressSnapshot.recipientName }} · {{ order.addressSnapshot.phone }}</strong><br>
              {{ order.addressSnapshot.province }} {{ order.addressSnapshot.city }} {{ order.addressSnapshot.district }} {{ order.addressSnapshot.detailAddress }}
            </address>
            <dl class="order-facts">
              <template v-if="order.orderType === 'CUSTOM'">
                <div><dt>约定工期</dt><dd>{{ order.durationDays }} 个自然日</dd></div>
                <div><dt>定标预计发货日</dt><dd>{{ order.agreementSnapshot.confirmedEstimatedShipDate }}</dd></div>
                <div><dt>支付约定发货日</dt><dd>{{ order.paymentPreview.shipDate }}</dd></div>
              </template>
              <div v-else>
                <dt>预计发货截止</dt><dd>{{ formatTime(order.paymentPreview.shipDeadlineAt) }}</dd>
              </div>
            </dl>
            <p
              v-if="order.orderType === 'CUSTOM' && order.paymentPreview.shipDate > order.agreementSnapshot.expectedShipDate"
              class="shipping-warning"
            >
              本次约定发货日晚于需求期望 {{ order.agreementSnapshot.expectedShipDate }}，请核对后再确认。
            </p>
            <p class="request-description payment-terms">
              {{ order.paymentPreview.termsText }}
            </p>
            <label class="award-confirmation">
              <input
                v-model="agreed"
                type="checkbox"
                :disabled="busy"
              >
              我已阅读并同意{{ order.orderType === 'STOCK' ? '现货' : '定制' }}支付条款
            </label>
            <div class="payment-actions">
              <button
                class="button-primary"
                :disabled="busy || !agreed"
                @click="pay"
              >
                确认模拟支付
              </button>
              <button
                class="inline-button"
                :disabled="busy"
                @click="closePayment"
              >
                暂不支付
              </button>
            </div>
          </section>

          <OrderFulfillmentPanel
            v-if="!section"
            :key="order.id"
            :order="order"
            :busy="busy"
            :blocked="fulfillmentBlocked"
            :pending="fulfillmentAttempt"
            :reset="fulfillmentReset"
            @submit="fulfill"
            @uploading="fulfillmentUpload"
          />

          <section
            v-if="section === 'address' && order.addressSnapshot"
            class="editor-section"
          >
            <address class="award-address">
              <strong>{{ order.addressSnapshot.recipientName }} · {{ order.addressSnapshot.phone }}</strong><br>
              {{ order.addressSnapshot.province }} {{ order.addressSnapshot.city }} {{ order.addressSnapshot.district }} {{ order.addressSnapshot.detailAddress }}
            </address>
            <p
              v-if="order.status === 'PENDING_PAY'"
              class="field-help"
            >
              {{ order.orderType === 'STOCK' ? '地址有误可取消订单后重新购买。' : '地址有误可取消订单并重新发布需求。' }}
            </p>
          </section>

          <section
            v-if="section === 'agreement' && order.orderType === 'STOCK'"
            class="editor-section"
          >
            <dl class="order-facts">
              <div><dt>材质</dt><dd>{{ order.agreementSnapshot.request.materialPreference }}</dd></div>
              <div><dt>尺寸规格</dt><dd>{{ order.agreementSnapshot.request.specification }}</dd></div>
            </dl>
            <p class="request-description">
              {{ order.agreementSnapshot.request.description }}
            </p>
            <template v-if="order.agreementSnapshot.proposal">
              <h3>工艺说明</h3>
              <p class="request-description">
                {{ order.agreementSnapshot.proposal }}
              </p>
            </template>
            <template v-if="order.agreementSnapshot.mainImageIds?.length">
              <h3>成交主图</h3>
              <QuoteImages
                :image-ids="order.agreementSnapshot.mainImageIds"
                :order-id="order.id"
                scope="stock"
                label="成交主图"
              />
            </template>
            <template v-if="order.agreementSnapshot.specificationImageIds?.length">
              <h3>成交规格图</h3>
              <QuoteImages
                :image-ids="order.agreementSnapshot.specificationImageIds"
                :order-id="order.id"
                scope="stock"
                label="成交规格图"
              />
            </template>
          </section>
          <section
            v-else-if="section === 'agreement'"
            class="editor-section"
          >
            <dl class="order-facts">
              <div><dt>约定工期</dt><dd>{{ order.durationDays }} 个自然日</dd></div>
              <div><dt>期望发货</dt><dd>{{ order.agreementSnapshot.expectedShipDate }}</dd></div>
              <div><dt>定标预计发货日</dt><dd>{{ order.agreementSnapshot.confirmedEstimatedShipDate }}</dd></div>
            </dl>
            <p class="field-help">
              工期含开工等待，从实际支付次日零时起算。
            </p>
            <h3>材料与工艺方案</h3>
            <p class="request-description">
              {{ order.agreementSnapshot.proposal }}
            </p>
            <p
              v-if="order.agreementSnapshot.additionalAgreement"
              class="request-description"
            >
              补充约定：{{ order.agreementSnapshot.additionalAgreement }}
            </p>
            <QuoteImages :image-ids="order.agreementSnapshot.imageIds" />
          </section>

          <section
            v-if="section === 'payment' && order.payment"
            class="editor-section"
          >
            <dl class="order-facts">
              <div><dt>支付流水号</dt><dd>{{ order.payment.flowNo }}</dd></div>
              <div><dt>实付金额</dt><dd>¥ {{ order.payment.amount }}</dd></div>
              <div><dt>支付结果</dt><dd>{{ order.payment.result === 'SUCCESS' ? '模拟支付成功' : order.payment.result }}</dd></div>
              <div><dt>支付时间</dt><dd>{{ formatTime(order.payment.occurredAt) }}</dd></div>
              <div v-if="order.termsConfirmedAt">
                <dt>条款确认时间</dt><dd>{{ formatTime(order.termsConfirmedAt) }}</dd>
              </div>
            </dl>
            <h3>已确认的支付条款</h3>
            <p class="request-description payment-terms">
              {{ order.payment.termsText }}
            </p>
          </section>

          <OrderReviewPanel
            v-if="section === 'review' && sectionAvailable"
            :key="'review-' + order.id"
            :order-id="order.id"
            :order-status="order.status"
          />
          <OrderRefundPanel
            v-if="section === 'refund' && sectionAvailable"
            :key="'refund-' + order.id"
            :order="order"
            :busy="baseBusy"
            :blocked="baseBlocked"
            @lock="refundLock"
            @write-start="refundWriteStart"
            @refresh="load"
            @invalid="load"
          />
          <section
            v-if="section === 'settlement' && !order.owned && order.settlement"
            class="editor-section"
            aria-label="结算信息"
          >
            <dl class="order-facts work-specifications">
              <div><dt>应结算金额</dt><dd>¥ {{ order.settlement.paidAmount }}</dd></div>
              <div>
                <dt>结算状态</dt><dd>
                  <span
                    class="order-service-badge"
                    :class="`is-${order.settlement.status.toLowerCase()}`"
                  >{{ settlementStatus[order.settlement.status] || order.settlement.status }}</span>
                </dd>
              </div>
              <div><dt>结算时间</dt><dd>{{ order.settlement.settledAt ? formatTime(order.settlement.settledAt) : '—' }}</dd></div>
              <div><dt>收款账户</dt><dd>{{ order.settlement.maskedPayee }}</dd></div>
            </dl>
            <RouterLink
              class="inline-button"
              to="/creator/income"
            >查看收入记录 ↗</RouterLink>
          </section>

          <section
            v-if="section === 'request' && order.orderType === 'CUSTOM'"
            class="editor-section"
          >
            <p class="field-help">
              {{ order.agreementSnapshot.request.categoryPath.join(' / ') }}
            </p>
            <p class="request-description">
              {{ order.agreementSnapshot.request.description }}
            </p>
            <dl class="order-facts">
              <div><dt>用途</dt><dd>{{ order.agreementSnapshot.request.purpose }}</dd></div>
              <div><dt>材质偏好</dt><dd>{{ order.agreementSnapshot.request.materialPreference }}</dd></div>
              <div><dt>尺寸规格</dt><dd>{{ order.agreementSnapshot.request.specification }}</dd></div>
            </dl>
            <div class="request-images">
              <PrivateImage
                v-for="(imageId, index) in order.agreementSnapshot.request.referenceImageIds"
                :key="imageId"
                :image-id="imageId"
                scope="request"
                :label="'订单需求参考图 ' + (index + 1)"
              />
            </div>
            <RouterLink
              v-if="order.requestId"
              :to="{ path: '/requests/' + order.requestId, query: requestReturnTo ? { returnTo: requestReturnTo } : undefined }"
            >查看原需求 ↗</RouterLink>
          </section>

          <section
            v-if="section === 'publication' && showPublication"
            id="publication-consent"
            class="editor-section order-publication"
            aria-label="定制成品公开授权"
            tabindex="-1"
          >
            <header class="order-publication-heading">
              <h2>授权状态</h2>
              <span
                class="order-service-badge"
                :class="`is-${publicationStatus.toLowerCase()}`"
              >
                {{ publicationLabels[publicationStatus] }}
              </span>
            </header>
            <p v-if="publicationStatus === 'NONE'">
              授权仅覆盖本次成品的展示，收货资料和聊天记录仍受保护。
            </p>
            <p v-else-if="publicationStatus === 'PENDING'">
              {{ order.canRespondPublicationConsent ? '请明确选择是否同意创作者展示本次成品。' : '买家可在订单详情回复。' }}
            </p>
            <p v-else-if="publicationStatus === 'APPROVED' && !order.owned">
              整理本次成品的图片和描述，作为新作品提交审核。
            </p>
            <dl
              v-if="order.publicationRequestedAt"
              class="order-facts order-publication-times"
            >
              <div><dt>申请时间</dt><dd>{{ formatTime(order.publicationRequestedAt) }}</dd></div>
              <div v-if="order.publicationRespondedAt">
                <dt>回复时间</dt><dd>{{ formatTime(order.publicationRespondedAt) }}</dd>
              </div>
            </dl>
            <p
              v-if="publicationError"
              class="form-alert"
              role="alert"
            >
              {{ publicationError }}
            </p>
            <div class="order-overview-actions">
              <button
                v-if="publicationNeedsCheck"
                type="button"
                class="button-secondary"
                :disabled="loading || busy"
                @click="load"
              >
                刷新授权状态
              </button>
              <button
                v-else-if="order.canRequestPublicationConsent"
                type="button"
                class="button-secondary"
                :disabled="busy || fulfillmentBlocked"
                @click="publicationAction()"
              >
                申请公开成品案例
              </button>
              <template v-else-if="order.canRespondPublicationConsent">
                <button
                  type="button"
                  class="button-primary"
                  :disabled="busy || fulfillmentBlocked"
                  @click="publicationAction('APPROVED')"
                >
                  同意公开
                </button>
                <button
                  type="button"
                  class="button-secondary"
                  :disabled="busy || fulfillmentBlocked"
                  @click="publicationAction('REJECTED')"
                >
                  不同意公开
                </button>
              </template>
              <RouterLink
                v-if="publicationStatus === 'APPROVED' && !order.owned"
                :to="{ path: '/creator/works/new', query: { sourceOrderId: order.id } }"
                class="button-primary"
              >
                手动发布定制成品案例
              </RouterLink>
            </div>
          </section>

          <section
            v-if="section === 'history'"
            class="editor-section"
          >
            <ol class="order-timeline">
              <li
                v-for="(event, index) in order.history"
                :key="event.createdAt + '-' + index"
              >
                <strong>{{ event.fromStatus ? (orderStatus[event.fromStatus] || event.fromStatus) + ' → ' : '创建订单 · ' }}{{ orderStatus[event.toStatus] || event.toStatus }}</strong>
                <p v-if="event.reason">
                  {{ orderReason(event.reason) }}
                </p>
                <time>{{ formatTime(event.createdAt) }}</time>
              </li>
            </ol>
          </section>
        </template>
      </div>
    </div>
  </WorkLayout>
</template>
