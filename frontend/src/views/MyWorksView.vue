<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CreatorLayout from '@/layouts/CreatorLayout.vue'
import AppIcon from '@/components/AppIcon.vue'
import WorkImage from '@/components/WorkImage.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { useListQuery } from '@/composables/useListQuery'
import { deleteWork, getManagedWorks, getPublicationQuota, offlineWork, recoverStockAvailability, withdrawWork } from '@/api/work'
import type { PublicationQuotaVO, StockRecoveryVO, WorkStatus, WorkVO } from '@/types/work'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/utils/request'
import { priceLabel, validStockPrice, workStatusLabels } from '@/utils/work'
import { formatTime } from '@/utils/creator'
import '@/assets/styles/craftflow-publication.css'
import { useConfirmation } from '@/composables/useConfirmation'

const confirm = useConfirmation()
const auth = useAuthStore()
const rows = ref<WorkVO[]>([])
const quota = ref<PublicationQuotaVO>()
const { page, status, changePage, selectStatus, replaceLastPage } = useListQuery<WorkStatus>(workStatusLabels)
const total = ref(0)
const loading = ref(false)
const busy = ref('')
const error = ref('')
const notice = ref('')
const recoveryDialog = ref<HTMLDialogElement>()
const recovery = ref<{ work: WorkVO; source: StockRecoveryVO; price: string; confirmed: boolean }>()
const recoveryError = ref('')
let revision = 0
async function load() {
  if (!auth.session?.roles.includes('CREATOR')) return
  const next = page.value
  const current = ++revision; loading.value = true; error.value = ''
  try {
    const [result, available] = await Promise.all([getManagedWorks({ status: status.value, page: next }), getPublicationQuota()])
    if (current !== revision) return
    if (replaceLastPage(result, next)) return
    rows.value = result.items
    total.value = result.total
    quota.value = available
  } catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '作品读取失败' }
  finally { if (current === revision) loading.value = false }
}
/** 库存记录独立于销售开关，关闭直购后仍显示已锁定或已售出。 */
function stockLabel(work: WorkVO) {
  if (work.stockStatus === 'RESERVED') return '已锁定'
  if (work.stockStatus === 'SOLD_OUT') return '已售出'
  if (!work.saleEnabled) return '未开启'
  if (work.purchasable) return '可购买'
  return '已开启'
}

/** 打开时锁定原售出订单与所见版本，避免刷新列表时变更确认对象。 */
async function openRecovery(work: WorkVO) {
  if (!work.stockRecovery || busy.value) return
  recovery.value = { work, source: work.stockRecovery, price: work.stockPrice ?? '', confirmed: false }
  recoveryError.value = ''
  notice.value = ''
  await nextTick()
  if (recovery.value) recoveryDialog.value?.showModal()
}

/** 冲突或未知结果后重读库存，再由当前恢复资格决定能否重试。 */
async function submitRecovery() {
  const form = recovery.value
  const userId = auth.session?.userId
  if (!form || !form.confirmed || busy.value || !userId) return
  const price = form.price.trim()
  if (!validStockPrice(price)) {
    recoveryError.value = '现货售价为 0.01—99999 元，最多两位小数'
    return
  }
  const current = () => recovery.value === form && userId === auth.session?.userId
  busy.value = form.work.id
  recoveryError.value = ''
  try {
    await recoverStockAvailability(form.work.id, {
      version: form.work.version,
      originalOrderId: form.source.originalOrderId,
      confirmation: form.source.confirmation,
      stockPrice: price,
    })
    if (!current()) return
    notice.value = '已恢复直购'
    recoveryDialog.value?.close()
    await load()
  } catch (failure) {
    if (!current()) return
    const message = failure instanceof Error ? failure.message : '恢复结果暂未确认'
    if (failure instanceof ApiError && failure.status === 400 && failure.fieldErrors.stockPrice) {
      recoveryError.value = failure.fieldErrors.stockPrice
    } else {
      recoveryDialog.value?.close()
      await load()
      if (userId === auth.session?.userId && !error.value) error.value = message + '，请核对当前库存状态'
    }
  } finally {
    if (userId === auth.session?.userId) busy.value = ''
  }
}

/** 列表动作携带所见版本，失败时提供手动核验入口。 */
async function action(work: WorkVO, type: 'delete' | 'withdraw' | 'offline') {
  if (busy.value) return
  const label = type === 'delete' ? '删除' : type === 'withdraw' ? '撤回' : '下架'
  const explanation = type === 'delete' ? '删除后无法恢复。' : type === 'withdraw' ? '撤回后可继续修改。' : '下架后停止公开展示。'
  if (!(await confirm({ title: label + '作品？', message: work.title + '。' + explanation, confirmLabel: '确认' + label }))) return
  if (busy.value || !rows.value.some(row => row.id === work.id && row.version === work.version)) return
  busy.value = work.id; error.value = ''; notice.value = ''
  try {
    if (type === 'delete') await deleteWork(work.id, work.version)
    else if (type === 'withdraw') await withdrawWork(work.id, work.version)
    else await offlineWork(work.id, work.version)
    await load()
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '操作结果未知，请刷新列表核验' }
  finally { busy.value = '' }
}
onMounted(() => window.addEventListener('work-updated', refresh))
function refresh() { void load() }
watch([page, status], () => { rows.value = []; total.value = 0; refresh() })
watch(() => auth.session?.userId, () => {
  revision++
  rows.value = []
  total.value = 0
  quota.value = undefined
  notice.value = ''
  loading.value = false
  error.value = ''
  busy.value = ''
  recovery.value = undefined
  recoveryDialog.value?.close()
  refresh()
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { revision++; window.removeEventListener('work-updated', refresh) })
</script>
<template>
  <CreatorLayout>
    <section class="cf-publication cf-publication-card">
      <header class="cf-publication-heading">
        <h1>我的作品</h1>
        <RouterLink
          class="button-primary"
          to="/creator/works/new"
        >
          <AppIcon name="plus" /> 发布新作品
        </RouterLink>
      </header>
      <div
        v-if="quota && !quota.canPublish"
        class="cf-publication-warning"
      >
        {{ quota.reason }}
      </div>
      <nav
        class="cf-publication-filters"
        aria-label="作品状态"
      >
        <button
          type="button"
          :aria-pressed="!status"
          @click="selectStatus('')"
        >
          全部作品
        </button>
        <button
          v-for="(label, key) in workStatusLabels"
          :key="key"
          type="button"
          :aria-pressed="status === key"
          @click="selectStatus(key)"
        >
          {{ label }}
        </button>
      </nav>
      <p
        v-if="error"
        class="form-alert"
        role="alert"
      >
        {{ error }}
        <button
          class="inline-button"
          type="button"
          @click="load()"
        >
          刷新核验
        </button>
      </p>
      <p
        v-if="notice"
        class="form-success"
        role="status"
      >
        {{ notice }}
      </p>
      <p
        v-if="loading"
        class="cf-publication-state"
        role="status"
      >
        正在读取作品…
      </p>
      <p
        v-else-if="!rows.length && !error"
        class="cf-publication-state"
      >
        {{ status ? '当前状态下暂无作品' : '你还没有作品' }}
      </p>
      <div
        v-else-if="rows.length"
        class="cf-publication-table-wrap"
        role="region"
        aria-label="我的作品列表"
        tabindex="0"
      >
        <table class="cf-publication-table">
          <thead>
            <tr>
              <th scope="col">
                作品
              </th>
              <th scope="col">
                品类
              </th>
              <th scope="col">
                现货销售
              </th>
              <th scope="col">
                接受定制
              </th>
              <th scope="col">
                审核状态
              </th>
              <th scope="col">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="work in rows"
              :key="work.id"
              class="managed-work-row cf-publication-row"
            >
              <td>
                <div class="cf-publication-work">
                  <WorkImage
                    v-if="work.mainImageIds[0]"
                    :image-id="work.mainImageIds[0]"
                    :initial="work.coverImage"
                    :label="work.title ? `${work.title}封面` : '草稿封面'"
                  />
                  <span
                    v-else
                    class="cf-publication-cover-empty"
                    aria-hidden="true"
                  ><AppIcon name="image" /></span>
                  <div>
                    <strong>{{ work.title || '未命名草稿' }}</strong>
                    <small>更新于 {{ formatTime(work.updatedAt) }}</small>
                  </div>
                </div>
              </td>
              <td>{{ work.categoryPath.join(' / ') || '未选择' }}</td>
              <td>
                <strong v-if="work.saleEnabled && work.stockPrice">¥{{ priceLabel(work.stockPrice) }}</strong>
                <small>{{ stockLabel(work) }}</small>
              </td>
              <td>
                <span
                  v-if="work.customEnabled"
                  class="work-status PENDING"
                >{{ work.customReferenceDays ? `${work.customReferenceDays} 个自然日` : '待填写周期' }}</span>
                <small v-else>未开启</small>
              </td>
              <td>
                <span
                  class="work-status"
                  :class="work.reviewStatus"
                >{{ workStatusLabels[work.reviewStatus] }}</span>
                <small
                  v-if="work.reviewStatus !== 'OFFLINE' && work.reviewReason"
                  class="field-error"
                >{{ work.reviewReason }}</small>
              </td>
              <td>
                <div class="cf-publication-row-actions">
                  <RouterLink
                    class="button-secondary"
                    :to="`/creator/works/${work.id}/edit`"
                  >
                    {{ work.reviewStatus === 'PENDING' ? '查看材料' : '编辑' }}
                  </RouterLink>
                  <RouterLink
                    v-if="work.reviewStatus === 'ONLINE'"
                    :to="`/works/${work.id}`"
                    class="button-secondary"
                  >
                    公开页
                  </RouterLink>
                  <button
                    v-if="work.stockRecovery"
                    class="button-secondary"
                    type="button"
                    aria-haspopup="dialog"
                    :disabled="Boolean(busy)"
                    @click="openRecovery(work)"
                  >
                    恢复直购
                  </button>
                  <button
                    v-if="work.reviewStatus === 'DRAFT'"
                    class="button-secondary"
                    type="button"
                    :disabled="Boolean(busy)"
                    @click="action(work, 'delete')"
                  >
                    删除草稿
                  </button>
                  <button
                    v-if="work.reviewStatus === 'PENDING'"
                    class="button-secondary"
                    type="button"
                    :disabled="Boolean(busy)"
                    @click="action(work, 'withdraw')"
                  >
                    撤回审核
                  </button>
                  <button
                    v-if="work.reviewStatus === 'ONLINE'"
                    class="button-secondary"
                    type="button"
                    :disabled="Boolean(busy)"
                    @click="action(work, 'offline')"
                  >
                    下架
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <WorkPagination
        :page="page"
        :total="total"
        :loading="loading"
        @change="changePage"
      />
      <dialog
        ref="recoveryDialog"
        class="stock-recovery-dialog"
        aria-labelledby="stock-recovery-title"
        @cancel="busy && $event.preventDefault()"
        @close="recovery = undefined"
      >
        <form
          v-if="recovery"
          @submit.prevent="submitRecovery"
        >
          <header>
            <h2 id="stock-recovery-title">
              恢复直购
            </h2>
            <p>{{ recovery.work.title }} · 原售出订单 {{ recovery.source.originalOrderNo }}</p>
          </header>
          <label class="stock-recovery-price">
            现货售价（元）
            <input
              v-model="recovery.price"
              inputmode="decimal"
              autocomplete="off"
              :disabled="Boolean(busy)"
            >
          </label>
          <label class="stock-recovery-confirmation">
            <input
              v-model="recovery.confirmed"
              type="checkbox"
              :disabled="Boolean(busy)"
            >
            {{ recovery.source.confirmation === 'RETURNED' ? '我确认原成品已退回且仍可销售' : '我确认原成品未发出且仍可销售' }}
          </label>
          <p
            v-if="recoveryError"
            class="form-alert"
            role="alert"
          >
            {{ recoveryError }}
          </p>
          <footer>
            <button
              class="button-secondary"
              type="button"
              :disabled="Boolean(busy)"
              @click="recoveryDialog?.close()"
            >
              取消
            </button>
            <button
              class="button-primary"
              type="submit"
              :disabled="Boolean(busy) || !recovery.confirmed"
            >
              {{ busy ? '正在恢复直购…' : '确认恢复直购' }}
            </button>
          </footer>
        </form>
      </dialog>
    </section>
  </CreatorLayout>
</template>

<style scoped>
/* 为同一作品的操作留出整行宽度，窄屏沿用作品表格的横向滚动。 */
.cf-publication-table { min-width: 820px; }
.cf-publication-table th:first-child { width: 23%; }
.cf-publication-table th:nth-child(2) { width: 14%; }
.cf-publication-table th:nth-child(3),
.cf-publication-table th:nth-child(4) { width: 11%; }
.cf-publication-table th:nth-child(5) { width: auto; }
.cf-publication-table th:last-child { width: 244px; }
.cf-publication-row-actions { flex-wrap: nowrap; gap: 5px; }
.cf-publication-row-actions .button-secondary {
  min-height: 30px;
  padding: 4px 8px;
  white-space: nowrap;
  font-size: 12px;
}

.stock-recovery-dialog {
  width: min(480px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  color: var(--craft-ink);
  background: var(--craft-surface);
  border: 1px solid var(--craft-border);
  border-radius: 16px;
  box-shadow: 0 18px 50px #18181b26;
  font: 400 13px/1.6 var(--craft-font);
}
.stock-recovery-dialog::backdrop { background: #18181b60; }
.stock-recovery-dialog form { display: grid; gap: 16px; padding: 22px; }
.stock-recovery-dialog :is(h2, p) { margin: 0; }
.stock-recovery-dialog h2 { font-size: 17px; font-weight: 650; }
.stock-recovery-dialog header p { color: var(--craft-muted); overflow-wrap: anywhere; }
.stock-recovery-price { display: grid; gap: 4px; font-weight: 600; }
.stock-recovery-price input {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  color: var(--craft-ink);
  background: var(--craft-surface);
  border: 1px solid var(--craft-border);
  border-radius: 8px;
  font: inherit;
  font-weight: 400;
}
.stock-recovery-confirmation { display: flex; align-items: baseline; gap: 8px; }
.stock-recovery-confirmation input { margin: 0; accent-color: var(--craft-primary); }
.stock-recovery-dialog footer { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
</style>
