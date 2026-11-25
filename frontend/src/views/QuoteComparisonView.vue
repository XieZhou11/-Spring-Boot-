<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import QuoteImages from '@/components/QuoteImages.vue'
import QuoteRecord from '@/components/QuoteRecord.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getAddresses } from '@/api/account'
import { awardQuote, getQuoteComparison, getRequestQuotes } from '@/api/quote'
import type { AddressVO } from '@/types/account'
import type { AwardDTO, QuoteComparisonVO, QuoteVO } from '@/types/quote'
import { formatTime } from '@/utils/creator'
import { ApiError } from '@/utils/request'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/custom-request.css'
import '@/assets/styles/quote.css'

const route = useRoute(); const router = useRouter(); const auth = useAuthStore()
const comparison = ref<QuoteComparisonVO>(); const sort = ref('AMOUNT'); const loading = ref(false); const loadError = ref('')
const selected = ref<QuoteVO>(); const addresses = ref<AddressVO[]>([]); const addressId = ref(''); const addressError = ref(''); const addressLoading = ref(false)
const lateAccepted = ref(false); const busy = ref(false); const uncertain = ref(false); const error = ref('')
const history = ref<QuoteVO[]>([]); const historyStatus = ref('EXPIRED'); const historyPage = ref(1); const historyTotal = ref(0); const historyLoading = ref(false); const historyError = ref('')
let revision = 0; let historyRevision = 0; let addressRevision = 0; let attempt: AwardDTO | undefined; let completed = false
/** 需求详情与订单也有 id 参数，读取报价前同时确认页面归属，避免导航中误查其他资源。 */
const id = () => route.name === 'quote-comparison' && typeof route.params.id === 'string' && /^[1-9]\d*$/.test(route.params.id) ? route.params.id : undefined
const chosenAddress = computed(() => addresses.value.find(address => address.id === addressId.value))
const isLate = computed(() => !!selected.value && !!comparison.value && selected.value.estimatedShipDate > comparison.value.expectedShipDate)
const lowestAmount = computed(() => Math.min(...(comparison.value?.items.map(quote => Number(quote.goodsAmount)) || [])))
const shortestDuration = computed(() => Math.min(...(comparison.value?.items.map(quote => quote.durationDays) || [])))
/** 回到详情的报价区，并保留需求列表的筛选来路。 */
const requestDetail = computed(() => ({
  name: 'custom-request-detail',
  params: { id: id() },
  query: typeof route.query.returnTo === 'string' ? { returnTo: route.query.returnTo } : {},
  hash: '#quotes',
}))
async function load() {
  const requestId = id()
  if (!requestId || busy.value || uncertain.value) return
  const current = ++revision; loading.value = true; loadError.value = ''
  try {
    const result = await getQuoteComparison(requestId, sort.value)
    if (current !== revision) return
    comparison.value = result
    if (selected.value) {
      const refreshed = result.items.find(quote => quote.id === selected.value?.id)
      if (refreshed?.estimatedShipDate !== selected.value.estimatedShipDate) lateAccepted.value = false
      selected.value = refreshed
    }
  } catch (failure) { if (current === revision) { comparison.value = undefined; loadError.value = failure instanceof Error ? failure.message : '报价对比读取失败' } }
  finally { if (current === revision) loading.value = false }
}
async function loadHistory(next = historyPage.value) {
  const requestId = id()
  if (!requestId) return
  const current = ++historyRevision; historyPage.value = next; historyLoading.value = true; historyError.value = ''
  try {
    const result = await getRequestQuotes(requestId, { status: historyStatus.value, page: next })
    if (current === historyRevision) { history.value = result.items; historyTotal.value = result.total }
  } catch (failure) { if (current === historyRevision) { history.value = []; historyError.value = failure instanceof Error ? failure.message : '历史报价读取失败' } }
  finally { if (current === historyRevision) historyLoading.value = false }
}
async function loadAddresses() {
  if (!id() || busy.value || uncertain.value) return
  const current = ++addressRevision; addressLoading.value = true; addressError.value = ''
  try {
    const result = await getAddresses()
    if (current !== addressRevision) return
    addresses.value = result
    if (!result.some(address => address.id === addressId.value)) addressId.value = result.find(address => address.isDefault)?.id || result[0]?.id || ''
  } catch (failure) { if (current === addressRevision) { addresses.value = []; addressError.value = failure instanceof Error ? failure.message : '收货地址读取失败' } }
  finally { if (current === addressRevision) addressLoading.value = false }
}
async function select(quote: QuoteVO) {
  if (busy.value || uncertain.value) return
  selected.value = quote; lateAccepted.value = false; error.value = ''; attempt = undefined
  await loadAddresses(); await nextTick(); document.getElementById('award-confirmation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
/** 一次确认冻结报价、地址、日期和请求键；失败后不能把新表单拼入旧请求。 */
async function award() {
  const requestId = id()
  if (!requestId || busy.value || !selected.value) return
  if (!uncertain.value) {
    if (!chosenAddress.value || !comparison.value?.canAward || !selected.value.canAward || (isLate.value && !lateAccepted.value)) return
    attempt = { requestKey: crypto.randomUUID(), quoteId: selected.value.id, addressId: addressId.value, confirmedEstimatedShipDate: selected.value.estimatedShipDate }
  }
  if (!attempt) return
  // 确认开始后，先前尚未返回的刷新不能改变原方案、地址或测算日期。
  revision++; addressRevision++; loading.value = false; addressLoading.value = false
  busy.value = true; error.value = ''
  try {
    const order = await awardQuote(requestId, attempt)
    completed = true; uncertain.value = false; attempt = undefined
    await router.push(`/orders/${order.id}`)
  } catch (failure) {
    uncertain.value = !(failure instanceof ApiError) || !failure.status || failure.status >= 500
    error.value = `${failure instanceof Error ? failure.message : '定标请求失败'}${uncertain.value ? '。定标结果未知，请重试确认定标结果；报价、地址和确认日期已锁定。也可前往我的订单核对。' : '。本次请求已被拒绝，请刷新方案和地址，核对后重新确认。'}`
    if (!uncertain.value) { attempt = undefined; selected.value = undefined; lateAccepted.value = false }
  } finally { busy.value = false }
  if (!uncertain.value && !completed) { void load(); void loadHistory() }
}
function refresh() { void load(); void loadHistory() }
function canLeave() {
  if (completed || !auth.session) return true
  if (busy.value) return false
  return !uncertain.value || window.confirm('定标结果仍未知，离开后请到我的订单核对结果。确定离开？')
}
function beforeUnload(event: BeforeUnloadEvent) { if (auth.session && (busy.value || uncertain.value)) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(canLeave); onBeforeRouteUpdate(canLeave)
watch([() => route.name, () => route.params.id], () => { revision++; historyRevision++; addressRevision++; comparison.value = undefined; selected.value = undefined; uncertain.value = false; attempt = undefined; completed = false; history.value = []; historyPage.value = 1; refresh() }, { immediate: true })
onMounted(() => { window.addEventListener('quote-updated', refresh); window.addEventListener('focus', refresh); window.addEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => { revision++; historyRevision++; addressRevision++; window.removeEventListener('quote-updated', refresh); window.removeEventListener('focus', refresh); window.removeEventListener('beforeunload', beforeUnload) })
</script>
<template>
  <WorkLayout presentation="craftflow">
    <div class="cf-quotes cf-quote-comparison">
      <nav
        class="work-breadcrumb"
        aria-label="面包屑"
      >
        <RouterLink :to="requestDetail">需求详情</RouterLink><span aria-hidden="true">/</span><span aria-current="page">报价对比</span>
      </nav>
      <header class="work-section-heading">
        <div>
          <h1>报价对比</h1><p class="muted">
            {{ comparison?.requestTitle }}
          </p>
        </div><strong
          v-if="comparison"
          class="quote-active-count"
        >有效报价 {{ comparison.activeCount }} / {{ comparison.limit }}</strong>
      </header>
      <p
        v-if="loadError"
        class="form-alert"
        role="alert"
      >
        {{ loadError }} <button
          class="inline-button"
          @click="refresh"
        >
          重新读取
        </button>
      </p>
      <p
        v-if="loading && !comparison"
        role="status"
      >
        正在读取报价方案…
      </p>
      <template v-if="comparison">
        <section
          class="quote-comparison-card"
          aria-label="有效报价"
        >
          <div class="request-filters quote-comparison-toolbar">
            <label>排序方式<select
              v-model="sort"
              aria-label="报价排序"
              :disabled="busy || uncertain"
              @change="load"
            ><option value="AMOUNT">商品金额 · 从低到高</option><option value="DURATION">制作工期 · 从短到长</option><option value="RATING">平均评分 · 从高到低</option></select></label><button
              type="button"
              class="button-secondary"
              :disabled="loading || busy || uncertain"
              @click="refresh"
            >
              刷新方案
            </button><span class="field-help">期望发货 {{ comparison.expectedShipDate }} · 测算日期 {{ comparison.serverDate }} · 发货日期以实际付款时间确定</span>
          </div>
          <p
            v-if="!comparison.canAward"
            class="review-reason"
          >
            {{ comparison.awardDisabledReason }}
          </p>
          <div
            v-if="comparison.items.length"
            class="quote-table-scroll"
            tabindex="0"
            role="region"
            aria-label="横向滚动查看报价方案"
          >
            <table
              class="quote-comparison"
              aria-label="报价方案对比"
              :style="{ '--quote-columns': comparison.items.length }"
            >
              <thead>
                <tr>
                  <th scope="col">
                    对比维度
                  </th>
                  <th
                    v-for="quote in comparison.items"
                    :id="`quote-${quote.id}`"
                    :key="quote.id"
                    scope="col"
                  >
                    <RouterLink :to="`/creators/${quote.creatorId}`">{{ quote.creatorNickname }}</RouterLink>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    商品成交金额
                  </th>
                  <td
                    v-for="quote in comparison.items"
                    :key="quote.id"
                  >
                    <div class="quote-cell-metric">
                      <strong class="quote-amount">¥{{ quote.goodsAmount }}</strong><span
                        v-if="Number(quote.goodsAmount) === lowestAmount"
                        class="quote-badge"
                      >最低价</span>
                    </div>
                    <span class="field-help">即买家实付金额</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    工期与预计发货
                  </th>
                  <td
                    v-for="quote in comparison.items"
                    :key="quote.id"
                  >
                    <div class="quote-cell-metric">
                      <strong>{{ quote.durationDays }} 个自然日</strong><span
                        v-if="quote.durationDays === shortestDuration"
                        class="quote-badge quote-badge-duration"
                      >最短工期</span>
                    </div>
                    <span
                      class="field-help"
                      :class="{ 'shipping-warning': quote.estimatedShipDate > comparison.expectedShipDate }"
                    >预计 {{ quote.estimatedShipDate }} 发货{{ quote.estimatedShipDate > comparison.expectedShipDate ? '（晚于期望）' : '' }}</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    创作者口碑
                  </th>
                  <td
                    v-for="quote in comparison.items"
                    :key="quote.id"
                  >
                    <strong>{{ quote.averageRating === null ? '暂无评价' : `${quote.averageRating} 分` }}</strong>
                    <span class="field-help">{{ quote.reviewCount }} 条评价 · 完成 {{ quote.completedOrderCount }} 单</span>
                    <span
                      v-if="quote.positiveRate !== null"
                      class="field-help"
                    >好评率 {{ quote.positiveRate }}%</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    方案与约定
                  </th>
                  <td
                    v-for="quote in comparison.items"
                    :key="quote.id"
                    class="proposal-cell"
                  >
                    <p class="request-excerpt">
                      {{ quote.proposal }}
                    </p>
                    <details>
                      <summary>展开完整方案</summary>
                      <p class="request-description">
                        {{ quote.proposal }}
                      </p>
                      <p
                        v-if="quote.additionalAgreement"
                        class="request-description"
                      >
                        补充约定：{{ quote.additionalAgreement }}
                      </p>
                    </details>
                  </td>
                </tr>
                <tr v-if="comparison.items.some(quote => quote.imageIds.length)">
                  <th scope="row">
                    方案图片
                  </th>
                  <td
                    v-for="quote in comparison.items"
                    :key="quote.id"
                  >
                    <QuoteImages
                      v-if="quote.imageIds.length"
                      :image-ids="quote.imageIds"
                    />
                    <span
                      v-else
                      class="field-help"
                    >未提供图片</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    有效期与定标
                  </th>
                  <td
                    v-for="quote in comparison.items"
                    :key="quote.id"
                  >
                    <p>有效至 <time :datetime="quote.expiresAt">{{ formatTime(quote.expiresAt) }}</time></p>
                    <button
                      type="button"
                      class="button-primary"
                      :disabled="!comparison.canAward || !quote.canAward || busy || uncertain"
                      @click="select(quote)"
                    >
                      选择此方案
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-else
            class="creator-empty"
          >
            <h2>暂无有效报价</h2><p>撤回、到期及定标后的方案保留在报价历史中。</p>
          </div>
        </section>
        <section
          v-if="selected"
          id="award-confirmation"
          class="award-panel"
          aria-label="定标确认"
        >
          <h2>确认合作方案</h2><p>{{ selected.creatorNickname }} · <strong>¥ {{ selected.goodsAmount }}</strong> · {{ selected.durationDays }} 个自然日</p>
          <p class="request-description">
            {{ selected.proposal }}
          </p><p
            v-if="selected.additionalAgreement"
            class="request-description"
          >
            {{ selected.additionalAgreement }}
          </p>
          <p>预计发货 {{ selected.estimatedShipDate }}；付款后确定最终日期，此日期不代表送达日期。</p>
          <label
            v-if="isLate"
            class="award-confirmation shipping-warning"
          ><input
            v-model="lateAccepted"
            type="checkbox"
            :disabled="busy || uncertain"
          >我接受晚于期望的预计发货日期（期望 {{ comparison.expectedShipDate }}，预计 {{ selected.estimatedShipDate }}）</label>
          <p
            v-if="addressError"
            class="form-alert"
            role="alert"
          >
            {{ addressError }}
          </p>
          <label class="work-field">选择收货地址<select
            v-model="addressId"
            aria-label="选择收货地址"
            :disabled="busy || uncertain || addressLoading"
          ><option value="">请选择收货地址</option><option
            v-for="address in addresses"
            :key="address.id"
            :value="address.id"
          >{{ address.recipientName }} · {{ address.province }}{{ address.city }}{{ address.district }}{{ address.detailAddress }}{{ address.isDefault ? '（默认）' : '' }}</option></select></label>
          <address
            v-if="chosenAddress"
            class="award-address"
          >
            <strong>{{ chosenAddress.recipientName }} · {{ chosenAddress.phone }}</strong><br>{{ chosenAddress.province }} {{ chosenAddress.city }} {{ chosenAddress.district }} {{ chosenAddress.detailAddress }}
          </address>
          <p
            v-else-if="!addressLoading"
            class="field-help"
          >
            没有可用地址，请先添加收货地址。
          </p>
          <div class="request-actions">
            <RouterLink
              to="/account/addresses"
              target="_blank"
              rel="noopener"
            >管理收货地址 ↗</RouterLink><button
              class="inline-button"
              :disabled="busy || uncertain || addressLoading"
              @click="loadAddresses"
            >
              刷新地址
            </button>
          </div>
          <p class="field-help">
            确认后生成唯一待付款订单，其余有效报价将落选；方案与地址将锁定，请在 24 小时内付款。未付款取消需重新发布需求，原报价不恢复。
          </p>
          <p
            v-if="error"
            class="form-alert"
            role="alert"
          >
            {{ error }} <RouterLink to="/orders">核对我的订单 ↗</RouterLink>
          </p>
          <div class="request-actions">
            <button
              v-if="!uncertain"
              class="button-secondary"
              :disabled="busy"
              @click="selected = undefined"
            >
              返回比较
            </button><button
              class="button-primary"
              :disabled="busy || (!uncertain && (!chosenAddress || addressLoading || !comparison.canAward || !selected.canAward || (isLate && !lateAccepted)))"
              @click="award"
            >
              {{ busy ? '正在确认…' : uncertain ? '重试确认定标结果' : '确认定标并生成订单' }}
            </button>
          </div>
        </section>
        <p
          v-else-if="error"
          class="form-alert"
          role="alert"
        >
          {{ error }}
        </p>
        <section class="quote-history">
          <div class="request-filters">
            <h2>报价历史</h2><label>报价状态<select
              v-model="historyStatus"
              aria-label="历史报价状态"
              @change="loadHistory(1)"
            ><option value="EXPIRED">已失效</option><option value="AWARDED">已中标</option><option value="LOST">未中标</option></select></label><button
              class="inline-button"
              :disabled="historyLoading"
              @click="loadHistory()"
            >
              刷新历史
            </button>
          </div><p
            v-if="historyError"
            class="form-alert"
            role="alert"
          >
            {{ historyError }}
          </p><p
            v-if="!history.length && !historyError"
            class="muted"
          >
            {{ historyLoading ? '正在读取历史…' : '此状态下暂无报价。' }}
          </p><QuoteRecord
            v-for="quote in history"
            :key="quote.id"
            :quote="quote"
          /><WorkPagination
            :page="historyPage"
            :total="historyTotal"
            :loading="historyLoading"
            @change="loadHistory"
          />
        </section>
      </template>
    </div>
  </WorkLayout>
</template>
