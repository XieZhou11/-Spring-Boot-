<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import QuoteImages from '@/components/QuoteImages.vue'
import PrivateImage from '@/components/PrivateImage.vue'
import { cancelOrder, getOrder } from '@/api/quote'
import type { OrderVO } from '@/types/quote'
import { orderReason, orderStatus } from '@/utils/quote'
import { formatTime } from '@/utils/creator'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/custom-request.css'
import '@/assets/styles/quote.css'
const route = useRoute(); const auth = useAuthStore(); const order = ref<OrderVO>(); const loading = ref(false); const busy = ref(false); const error = ref('')
let revision = 0
async function load() {
  if (busy.value) return
  const current = ++revision; loading.value = true; error.value = ''
  try { const result = await getOrder(String(route.params.id)); if (current === revision) order.value = result }
  catch (failure) { if (current === revision) { order.value = undefined; error.value = failure instanceof Error ? failure.message : '订单读取失败' } }
  finally { if (current === revision) loading.value = false }
}
/** 取消仅操作当前订单；响应未知可刷新或重试，不在页面提前改变状态。 */
async function cancel() {
  if (!order.value?.canCancel || busy.value || !window.confirm('确认取消未付款订单？需求将关闭，中标与落选报价不会恢复，重新选择需发布新需求。')) return
  // 取消开始即作废在途旧查询，避免旧待付款快照覆盖已提交的取消结果。
  const current = ++revision; loading.value = false; busy.value = true; error.value = ''
  try { const result = await cancelOrder(order.value.id); if (current === revision) order.value = result }
  catch (failure) { if (current === revision) error.value = `${failure instanceof Error ? failure.message : '取消请求失败'}。请刷新订单核对结果，再决定是否重试。` }
  finally { busy.value = false }
}
function refresh() { void load() }
onBeforeRouteLeave(() => !auth.session || !busy.value); onBeforeRouteUpdate(() => !auth.session || !busy.value)
watch(() => route.params.id, () => { revision++; order.value = undefined; void load() }, { immediate: true })
onMounted(() => { window.addEventListener('order-updated', refresh); window.addEventListener('focus', refresh) })
onBeforeUnmount(() => { revision++; window.removeEventListener('order-updated', refresh); window.removeEventListener('focus', refresh) })
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
          <section class="editor-section">
            <h2>锁定的合作方案</h2><dl class="work-specifications">
              <div>
                <dt>商品成交金额</dt><dd class="quote-amount">
                  ¥ {{ order.totalAmount }}
                </dd>
              </div><div><dt>约定工期</dt><dd>{{ order.durationDays }} 个自然日</dd></div><div><dt>期望发货</dt><dd>{{ order.agreementSnapshot.expectedShipDate }}</dd></div><div><dt>定标确认预计发货</dt><dd>{{ order.agreementSnapshot.confirmedEstimatedShipDate }}</dd></div>
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
            </template><p
              v-if="order.cancelReason"
              class="review-reason"
            >
              {{ orderReason(order.cancelReason) }}
            </p><RouterLink
              :to="`/messages/conversations/${order.conversationId}`"
              class="button-primary"
            >进入订单沟通</RouterLink><button
              v-if="order.canCancel"
              class="button-secondary"
              :disabled="busy"
              @click="cancel"
            >
              {{ busy ? '正在取消…' : '取消订单' }}
            </button><button
              class="inline-button"
              :disabled="loading || busy"
              @click="load"
            >
              刷新订单
            </button><p class="field-help">
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
