<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAddresses } from '@/api/account'
import { createStockOrder } from '@/api/work'
import { useAuthStore } from '@/stores/auth'
import type { AddressVO } from '@/types/account'
import type { WorkVO } from '@/types/work'
import { ApiError } from '@/utils/request'
import { priceLabel } from '@/utils/work'

const props = defineProps<{ work: WorkVO }>()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const checkout = ref<HTMLDialogElement>()
const recoveryButton = ref<HTMLButtonElement>()
const checkoutOpen = ref(false)
const addresses = ref<AddressVO[]>([])
const selected = ref('')
const loading = ref(false)
const busy = ref(false)
const addressError = ref('')
const error = ref('')
type Attempt = { requestKey: string; addressId: string }
const pending = ref<Attempt>()
const userId = computed(() => auth.session?.userId)
const storageKey = computed(() => userId.value && `stock-order:${userId.value}:${props.work.id}`)
const canBuy = computed(() => !!userId.value && props.work.purchasable &&
  props.work.creatorId !== userId.value && !auth.session?.roles.includes('ADMIN'))
const orderPrice = computed(() => priceLabel(props.work.stockPrice))
let scopeVersion = 0
let addressVersion = 0

/** 写入结果只回填仍显示同一作品的同一账号。 */
function isCurrent(version: number) {
  return version === scopeVersion &&
    route.matched.at(-1)?.path === '/works/:id' &&
    route.params.id === props.work.id
}

watch(storageKey, key => {
  scopeVersion++
  checkout.value?.close()
  checkoutOpen.value = false
  addresses.value = []
  selected.value = ''
  loading.value = false
  busy.value = false
  addressError.value = ''
  error.value = ''
  pending.value = undefined
  if (!key) return
  try {
    const saved = sessionStorage.getItem(key)
    const restored = saved ? JSON.parse(saved) as Partial<Attempt> | null : null
    if (typeof restored?.requestKey === 'string' && restored.requestKey &&
      typeof restored.addressId === 'string' && restored.addressId) {
      pending.value = { requestKey: restored.requestKey, addressId: restored.addressId }
    }
  } catch {
    // 无法恢复时仍允许浏览作品。新建单须先成功保存本次请求。
  }
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { scopeVersion++ })

/** 重新打开时从服务端读取地址，保留仍存在的上次选择。 */
async function loadAddresses() {
  const scope = scopeVersion
  const revision = ++addressVersion
  loading.value = true
  addressError.value = ''
  try {
    const result = await getAddresses()
    if (!isCurrent(scope) || revision !== addressVersion) return
    addresses.value = result
    if (!result.some(address => address.id === selected.value)) {
      selected.value = result.find(address => address.isDefault)?.id ?? result[0]?.id ?? ''
    }
  } catch (failure) {
    if (!isCurrent(scope) || revision !== addressVersion) return
    addressError.value = failure instanceof Error ? failure.message : '收货地址读取失败'
  } finally {
    if (isCurrent(scope) && revision === addressVersion) loading.value = false
  }
}

function openCheckout() {
  if (!canBuy.value || busy.value || !checkout.value || checkout.value.open) return
  error.value = ''
  checkout.value.showModal()
  checkoutOpen.value = true
  void loadAddresses()
}

function closeCheckout() {
  if (checkout.value?.open) return
  checkoutOpen.value = false
  // 未知结果出现后入口变为重试按钮，关闭弹窗时把键盘焦点移到新入口。
  if (pending.value && isCurrent(scopeVersion)) void nextTick(() => recoveryButton.value?.focus())
}

/** 成功或明确拒绝时只清除已响应的请求，清理故障不影响真实交易结果。 */
function clearStoredAttempt(key: string, serialized: string) {
  try {
    if (sessionStorage.getItem(key) === serialized) sessionStorage.removeItem(key)
  } catch {
    // 保留的请求可被服务端按原键复用。
  }
}

async function buy() {
  const scope = scopeVersion
  const key = storageKey.value
  const workId = props.work.id
  if (!key || busy.value || !isCurrent(scope)) return
  if (!pending.value && (!canBuy.value || !checkoutOpen.value || loading.value || addressError.value || !selected.value)) return
  // 库存锁定或地址发生变化时，未知结果仍使用原始请求键和地址核验。
  const input = pending.value ?? { requestKey: crypto.randomUUID(), addressId: selected.value }
  const serialized = JSON.stringify(input)
  error.value = ''
  try {
    sessionStorage.setItem(key, serialized)
  } catch {
    error.value = '浏览器无法保存本次请求，请允许使用会话存储后重试。'
    return
  }

  busy.value = true
  let orderId: string | undefined
  try {
    const order = await createStockOrder(workId, input)
    clearStoredAttempt(key, serialized)
    if (isCurrent(scope)) {
      pending.value = undefined
      orderId = order.id
    }
  } catch (failure) {
    const unknown = !(failure instanceof ApiError) || !failure.status || failure.status >= 500
    if (!unknown) clearStoredAttempt(key, serialized)
    if (isCurrent(scope)) {
      pending.value = unknown ? input : undefined
      if (failure instanceof ApiError && !unknown) {
        error.value = `${failure.message}。请刷新作品状态后重试。`
      }
    }
  } finally {
    if (isCurrent(scope)) busy.value = false
  }
  if (orderId && isCurrent(scope)) await router.push({ name: 'order-detail', params: { id: orderId } })
}
</script>

<template>
  <section
    v-if="canBuy || pending || checkoutOpen || busy || error"
    class="stock-purchase"
    aria-label="现货直购"
  >
    <button
      v-if="canBuy && !pending"
      class="button-primary stock-opener"
      type="button"
      aria-haspopup="dialog"
      :disabled="busy"
      @click="openCheckout"
    >
      立即购买现货
    </button>
    <div
      v-if="!checkoutOpen && (pending || error)"
      class="stock-recovery"
    >
      <p
        v-if="pending"
        role="status"
      >
        建单结果尚未确认。可以用原收货地址重试，或<RouterLink to="/orders">前往我的订单核对</RouterLink>。
      </p>
      <p
        v-if="error"
        class="stock-error"
        role="alert"
      >
        {{ error }}
      </p>
      <button
        v-if="pending"
        ref="recoveryButton"
        class="button-primary"
        type="button"
        :disabled="busy"
        @click="buy"
      >
        {{ busy ? '正在确认订单…' : '重试确认建单结果' }}
      </button>
    </div>

    <dialog
      ref="checkout"
      class="stock-dialog"
      aria-labelledby="stock-dialog-title"
      @cancel="busy && $event.preventDefault()"
      @close="closeCheckout"
    >
      <form @submit.prevent="buy">
        <header class="stock-dialog-title">
          <h2 id="stock-dialog-title">
            确认现货直购订单
          </h2>
          <p>{{ work.title }} <strong>¥ {{ orderPrice }}</strong></p>
        </header>

        <p
          v-if="pending"
          class="stock-note"
          role="status"
        >
          建单结果尚未确认。可以用原收货地址重试，或<RouterLink to="/orders">前往我的订单核对</RouterLink>。
        </p>
        <div
          v-else-if="loading"
          class="stock-address-state"
          role="status"
        >
          正在读取收货地址…
        </div>
        <div
          v-else-if="addressError"
          class="stock-address-state"
        >
          <p
            class="stock-error"
            role="alert"
          >
            {{ addressError }}
          </p>
          <button
            class="button-secondary"
            type="button"
            @click="loadAddresses"
          >
            重试读取地址
          </button>
        </div>
        <fieldset
          v-else-if="addresses.length"
          class="stock-addresses"
          :disabled="busy"
        >
          <legend>选择收货地址</legend>
          <label
            v-for="address in addresses"
            :key="address.id"
            class="stock-address"
            :class="{ selected: selected === address.id }"
          >
            <input
              v-model="selected"
              name="stock-address"
              type="radio"
              :value="address.id"
            >
            <span>
              <span class="stock-recipient">
                <strong>{{ address.recipientName }}</strong>
                <span>{{ address.phone }}</span>
                <small v-if="address.isDefault">默认</small>
              </span>
              <span>{{ address.province }} {{ address.city }} {{ address.district }} {{ address.detailAddress }}</span>
            </span>
          </label>
        </fieldset>
        <div
          v-else
          class="stock-address-state"
        >
          <p>添加收货地址后即可购买。</p>
          <RouterLink to="/account/addresses">管理收货地址</RouterLink>
        </div>

        <p
          v-if="!pending && !canBuy && !busy && !error"
          class="stock-note"
          role="status"
        >
          该件现货当前无法直购。
        </p>
        <p
          v-else-if="!pending"
          class="stock-note"
        >
          下单后锁定该件现货并保存收货地址，请在 24 小时内完成模拟支付。
        </p>
        <p
          v-if="error"
          class="stock-error"
          role="alert"
        >
          {{ error }}
        </p>
        <footer class="stock-actions">
          <button
            class="button-secondary"
            type="button"
            :disabled="busy"
            @click="checkout?.close()"
          >
            取消
          </button>
          <button
            class="button-primary"
            type="submit"
            :disabled="busy || (!pending && (!canBuy || loading || !!addressError || !selected))"
          >
            {{ busy ? '正在确认订单…' : pending ? '重试确认建单结果' : `确认购买 · ¥ ${orderPrice}` }}
          </button>
        </footer>
      </form>
    </dialog>
  </section>
</template>

<style scoped>
.stock-purchase {
  margin: 0 0 10px;
}
.stock-opener {
  width: 100%;
}
.stock-dialog {
  width: min(480px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  overflow-y: auto;
  color: var(--craft-ink);
  background: var(--craft-surface);
  border: 1px solid var(--craft-border);
  border-radius: 16px;
  box-shadow: 0 18px 50px #18181b26;
  font: 400 13px/1.6 var(--craft-font);
}
.stock-dialog::backdrop { background: #18181b60; }
.stock-dialog form {
  display: grid;
  gap: 16px;
  padding: 22px;
}
.stock-dialog :is(h2, p) { margin: 0; }
.stock-dialog-title h2 { font-size: 17px; font-weight: 650; }
.stock-dialog-title p { color: var(--craft-muted); overflow-wrap: anywhere; }
.stock-dialog-title strong { margin-inline-start: 6px; color: #78350f; white-space: nowrap; }
.stock-addresses { min-width: 0; margin: 0; padding: 0; border: 0; }
.stock-addresses legend { margin: 0 0 8px; padding: 0; font-weight: 600; }
.stock-address {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 9px;
  padding: 10px 12px;
  color: var(--craft-muted);
  border: 1px solid var(--craft-border);
  border-radius: 10px;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.stock-address + .stock-address { margin-block-start: 7px; }
.stock-address:hover { border-color: #a1a1aa; }
.stock-address.selected { border-color: var(--craft-ink); background: var(--craft-bg); }
.stock-address input { margin: 0; accent-color: var(--craft-primary); }
.stock-recipient { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; }
.stock-recipient strong { color: var(--craft-ink); }
.stock-recipient small {
  padding: 0 6px;
  color: var(--craft-surface);
  background: var(--craft-primary);
  border-radius: 6px;
  font-size: 11px;
}
.stock-address-state, .stock-recovery {
  display: grid;
  justify-items: start;
  gap: 7px;
}
.stock-recovery { color: var(--craft-muted); font-size: 13px; }
.stock-recovery p { margin: 0; }
.stock-note {
  padding: 10px 12px;
  color: #78350f;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
}
.stock-error { color: #9f1239; }
.stock-purchase a { color: var(--craft-ink); text-decoration: underline; }
.stock-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.stock-purchase :is(a, button, input):focus-visible {
  outline: 2px solid #a15c08;
  outline-offset: 2px;
}
@media (max-width: 480px) {
  .stock-dialog form { padding: 16px; }
}
</style>
