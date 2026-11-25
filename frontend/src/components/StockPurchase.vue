<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getAddresses } from '@/api/account'
import { createStockOrder } from '@/api/work'
import type { AddressVO } from '@/types/account'
import type { WorkVO } from '@/types/work'
import { ApiError } from '@/utils/request'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ work: WorkVO }>()
const router = useRouter(); const auth = useAuthStore()
const addresses = ref<AddressVO[]>([]); const selected = ref(''); const loading = ref(false); const busy = ref(false)
const error = ref(''); const notice = ref(''); const unknown = ref(false)
type Attempt = { requestKey: string; addressId: string }
const attempt = ref<Attempt>()
const storageKey = () => `stock-order:${auth.session?.userId || 'guest'}:${props.work.id}`
// 作品已被本次未知建单占用时仍展示原请求重试入口，避免结果确认依赖当前可售状态。
const canBuy = () => (unknown.value && !!attempt.value) || (props.work.purchasable && props.work.creatorId !== auth.session?.userId && !auth.session?.roles.includes('ADMIN'))
watch(selected, () => { if (attempt.value && attempt.value.addressId !== selected.value && !unknown.value) attempt.value = undefined })
onMounted(async () => {
  try {
    const saved = sessionStorage.getItem(storageKey())
    if (saved) { try { attempt.value = JSON.parse(saved) as Attempt; selected.value = attempt.value.addressId; unknown.value = true } catch { sessionStorage.removeItem(storageKey()) } }
    addresses.value = await getAddresses()
    if (!selected.value) selected.value = addresses.value.find(row => row.isDefault)?.id || addresses.value[0]?.id || ''
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '收货地址读取失败' }
})
async function buy() {
  if (busy.value || !canBuy()) return
  if (!attempt.value && !selected.value) { error.value = '请先添加收货地址'; return }
  attempt.value ||= { requestKey: crypto.randomUUID(), addressId: selected.value }
  try { sessionStorage.setItem(storageKey(), JSON.stringify(attempt.value)) }
  catch { error.value = '浏览器存储不可用，本次未提交订单'; return }
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const order = await createStockOrder(props.work.id, attempt.value)
    sessionStorage.removeItem(storageKey()); attempt.value = undefined; unknown.value = false
    await router.push(`/orders/${order.id}`)
  } catch (failure) {
    if (!(failure instanceof ApiError) || !failure.status || failure.status >= 500) {
      unknown.value = true; notice.value = '建单结果尚未确认。可重试同一请求，或前往我的订单核对。'
    } else {
      sessionStorage.removeItem(storageKey()); attempt.value = undefined; unknown.value = false
      error.value = `${failure.message}。请刷新作品状态后重试。`
    }
  } finally { busy.value = false }
}
</script>

<template>
  <section
    v-if="canBuy()"
    class="stock-purchase"
    aria-label="现货直购"
  >
    <label class="work-field">收货地址<select
      v-model="selected"
      :disabled="busy || unknown"
      aria-label="选择收货地址"
    >
      <option value="">请选择收货地址</option><option
        v-for="address in addresses"
        :key="address.id"
        :value="address.id"
      >
        {{ address.recipientName }} · {{ address.phone }} · {{ address.province }} {{ address.city }} {{ address.district }} {{ address.detailAddress }}{{ address.isDefault ? '（默认）' : '' }}
      </option>
    </select></label>
    <p
      v-if="!addresses.length && !loading"
      class="field-help"
    >
      请先添加收货地址，订单会保存地址快照。
    </p>
    <RouterLink
      v-if="!addresses.length && !loading"
      class="inline-button"
      to="/account/addresses"
    >管理收货地址 ↗</RouterLink>
    <p class="field-help">
      当前为一件现货。下单后将锁定该成品，请在 24 小时内模拟支付。
    </p>
    <p
      v-if="error"
      class="field-error"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="notice"
      class="field-help"
      role="status"
    >
      {{ notice }} <RouterLink
        v-if="unknown"
        to="/orders"
      >前往我的订单核对 ↗</RouterLink>
    </p>
    <button
      class="button-primary"
      :disabled="busy || loading || (!addresses.length && !unknown) || !selected"
      @click="buy"
    >
      {{ busy ? '正在确认订单…' : unknown ? '重试确认建单结果' : `确认购买 · ¥ ${work.stockPrice}` }}
    </button>
  </section>
</template>
