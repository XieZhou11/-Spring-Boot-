<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AccountField from '@/components/AccountField.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getAdminUser, getAdminUsers, setAdminBusinessPause } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import type { AdminUserDetailVO, AdminUserVO } from '@/types/admin'
import type { WorkStatus } from '@/types/work'
import { applicationStatusLabels, formatTime } from '@/utils/creator'
import { requestStatus } from '@/utils/customRequest'
import { orderStatus } from '@/utils/quote'
import { ApiError } from '@/utils/request'
import { workStatusLabels } from '@/utils/work'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const adminId = computed(() => auth.session?.roles.includes('ADMIN') ? auth.session.userId : undefined)
const statuses: Record<string, string> = {
  NONE: applicationStatusLabels.NONE,
  PENDING: applicationStatusLabels.PENDING,
  APPROVED: applicationStatusLabels.APPROVED,
  REJECTED: applicationStatusLabels.REJECTED,
}
const actions: Record<string, string> = {
  ADMIN_BUSINESS_PAUSE: '后台暂停新业务',
  ADMIN_BUSINESS_RESUME: '后台恢复新业务',
  CREATOR_PAUSE: '本人暂停接单',
  CREATOR_RESUME: '本人恢复接单',
}

function readQuery(key: string) {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const filters = computed(() => ({
  email: readQuery('email'),
  nickname: readQuery('nickname'),
  certificationStatus: Object.hasOwn(statuses, readQuery('certificationStatus')) ? readQuery('certificationStatus') : 'ALL',
}))
const page = computed(() => {
  const value = Number(readQuery('page'))
  return Number.isInteger(value) && value > 0 && value <= 1_000_000 ? value : 1
})
const selected = computed(() => readQuery('userId'))
const draft = ref({ ...filters.value })
const rows = ref<AdminUserVO[]>([])
const detail = ref<AdminUserDetailVO>()
const total = ref(0)
const loading = ref(false)
const detailLoading = ref(false)
const error = ref('')
const detailError = ref('')
const notice = ref('')
let listRevision = 0
let detailRevision = 0

const pauseDialog = ref<HTMLDialogElement>()
const pauseTarget = ref<{ id: string; nickname: string; paused: boolean }>()
const reason = ref('')
const recovery = ref('')
const fields = ref<Record<string, string>>({})
const mutationError = ref('')
const submitting = ref(false)
const paused = (value: boolean | number) => value === true || value === 1

function listQuery(next = page.value, source = filters.value) {
  return {
    email: source.email.trim() || undefined,
    nickname: source.nickname.trim() || undefined,
    certificationStatus: source.certificationStatus === 'ALL' ? undefined : source.certificationStatus,
    page: next > 1 ? String(next) : undefined,
  }
}

function userLink(id: string | number) {
  return { name: 'admin-users', query: { ...listQuery(), userId: String(id) } }
}

async function applyFilters(next = 1, source = draft.value) {
  const target = { name: 'admin-users', query: listQuery(next, source) }
  if (router.resolve(target).fullPath === route.fullPath) void loadUsers()
  else await router.push(target)
}

/** 只把当前管理员和筛选条件对应的响应写入列表。 */
async function loadUsers() {
  const userId = adminId.value
  if (!userId) return
  const current = ++listRevision
  loading.value = true
  error.value = ''
  try {
    const result = await getAdminUsers({ ...filters.value, page: page.value })
    if (current !== listRevision || adminId.value !== userId) return
    rows.value = result.items
    total.value = result.total
  } catch (failure) {
    if (current === listRevision && adminId.value === userId) error.value = failure instanceof Error ? failure.message : '用户列表读取失败'
  } finally {
    if (current === listRevision) loading.value = false
  }
}

/** 详情来源于 URL，换账号或换选中对象时先清空原资料。 */
async function loadDetail() {
  const userId = adminId.value
  const id = selected.value
  const current = ++detailRevision
  detail.value = undefined
  detailError.value = ''
  detailLoading.value = false
  if (!userId || !id) return
  if (!/^[1-9]\d{0,18}$/.test(id)) {
    detailError.value = '账号编号无效'
    return
  }
  detailLoading.value = true
  try {
    const result = await getAdminUser(id)
    if (current === detailRevision && adminId.value === userId) detail.value = result
  } catch (failure) {
    if (current === detailRevision && adminId.value === userId) detailError.value = failure instanceof Error ? failure.message : '用户详情读取失败'
  } finally {
    if (current === detailRevision) detailLoading.value = false
  }
}

function openPause() {
  const user = detail.value?.user
  if (!user) return
  pauseTarget.value = { id: String(user.userId), nickname: user.nickname, paused: !paused(user.adminBusinessPaused) }
  reason.value = ''
  recovery.value = ''
  fields.value = {}
  mutationError.value = ''
  pauseDialog.value?.showModal()
}

/** 服务端使用目标布尔状态幂等处置，丢失应答时先读取当前状态。 */
async function savePause() {
  const target = pauseTarget.value
  const userId = adminId.value
  if (!target || !userId || submitting.value) return
  fields.value = {}
  mutationError.value = ''
  if (!reason.value.trim()) fields.value.reason = '请填写操作原因'
  else if (reason.value.trim().length > 1000) fields.value.reason = '操作原因最多 1000 字'
  if (target.paused && !recovery.value.trim()) fields.value.recoveryCondition = '请填写恢复条件'
  else if (target.paused && recovery.value.trim().length > 1000) fields.value.recoveryCondition = '恢复条件最多 1000 字'
  if (Object.keys(fields.value).length) return

  submitting.value = true
  const current = () => adminId.value === userId && selected.value === target.id && pauseTarget.value === target
  function completed() {
    if (!current()) return
    pauseDialog.value?.close()
    notice.value = target?.paused ? '已暂停该账号的新业务' : '已人工恢复该账号的新业务'
    void loadUsers()
    void loadDetail()
  }
  try {
    await setAdminBusinessPause(target.id, target.paused, reason.value.trim(), target.paused ? recovery.value.trim() : undefined)
    completed()
  } catch (failure) {
    if (!current()) return
    if (failure instanceof ApiError && (!failure.status || failure.status >= 500)) {
      try {
        const result = await getAdminUser(target.id)
        if (paused(result.user.adminBusinessPaused) === target.paused) {
          completed()
          return
        }
      } catch {
        // 无法判定结果时保留输入，等待管理员再次确认。
      }
      if (current()) mutationError.value = '暂未确认处置结果，请重试。'
    } else {
      if (failure instanceof ApiError) fields.value = failure.fieldErrors
      mutationError.value = failure instanceof Error ? failure.message : '账号状态更新失败'
    }
  } finally {
    submitting.value = false
  }
}

watch([() => filters.value.email, () => filters.value.nickname, () => filters.value.certificationStatus, page, adminId], () => {
  draft.value = { ...filters.value }
  rows.value = []
  total.value = 0
  error.value = ''
  loading.value = false
  void loadUsers()
}, { immediate: true })
watch([selected, adminId], () => {
  notice.value = ''
  pauseTarget.value = undefined
  pauseDialog.value?.close()
  void loadDetail()
}, { immediate: true })
</script>

<template>
  <AdminLayout title="用户管理">
    <form
      class="user-filters"
      @submit.prevent="applyFilters()"
    >
      <label>邮箱<input
        v-model="draft.email"
        maxlength="254"
        placeholder="邮箱或其中一段"
      ></label>
      <label>昵称<input
        v-model="draft.nickname"
        maxlength="8"
        placeholder="昵称或其中一段"
      ></label>
      <label>认证状态<select v-model="draft.certificationStatus"><option value="ALL">全部</option><option
        v-for="(label, key) in statuses"
        :key="key"
        :value="key"
      >{{ label }}</option></select></label>
      <button
        class="button-secondary"
        :disabled="loading"
      >
        查询用户
      </button>
    </form>
    <div class="user-workspace">
      <section
        class="user-panel"
        aria-labelledby="admin-users-queue"
      >
        <header>
          <h2 id="admin-users-queue">
            账号列表
          </h2><span>{{ total }} 项</span>
        </header>
        <p
          v-if="error"
          class="form-alert"
          role="alert"
        >
          {{ error }}
        </p>
        <p
          v-else-if="loading && !rows.length"
          role="status"
        >
          正在读取账号…
        </p>
        <p v-else-if="!rows.length">
          没有匹配的账号。
        </p>
        <RouterLink
          v-for="row in rows"
          :key="row.userId"
          class="user-row"
          :class="{ 'user-row--selected': selected === String(row.userId) }"
          :aria-current="selected === String(row.userId) ? 'page' : undefined"
          :to="userLink(row.userId)"
        >
          <div><strong>{{ row.nickname }}</strong><span>{{ row.email }}</span></div>
          <small>{{ statuses[row.certificationStatus] || row.certificationStatus }}<span v-if="paused(row.adminBusinessPaused)"> · 后台暂停</span></small>
        </RouterLink>
        <WorkPagination
          label="用户分页"
          :page="page"
          :total="total"
          :loading="loading"
          @change="applyFilters($event, filters)"
        />
      </section>
      <section
        class="user-panel"
        aria-label="账号详情"
      >
        <p
          v-if="detailLoading"
          role="status"
        >
          正在读取账号详情…
        </p>
        <template v-else-if="detailError">
          <p
            class="form-alert"
            role="alert"
          >
            {{ detailError }}
          </p><button
            class="button-secondary"
            @click="loadDetail"
          >
            重新读取
          </button>
        </template>
        <template v-else-if="detail">
          <header>
            <div><h2>{{ detail.user.nickname }}</h2><p>{{ detail.user.email }} · {{ statuses[detail.user.certificationStatus] || detail.user.certificationStatus }}</p></div>
            <button
              class="button-secondary"
              :disabled="submitting"
              @click="openPause"
            >
              {{ paused(detail.user.adminBusinessPaused) ? '人工恢复新业务' : '暂停新业务' }}
            </button>
          </header>
          <p
            v-if="notice"
            class="save-success"
            role="status"
          >
            {{ notice }}
          </p>
          <dl class="user-pause-state">
            <div>
              <dt>后台新业务</dt><dd :class="{ 'is-paused': paused(detail.user.adminBusinessPaused) }">
                {{ paused(detail.user.adminBusinessPaused) ? '已暂停' : '可开展' }}
              </dd>
            </div>
            <div v-if="detail.user.certificationStatus === 'APPROVED'">
              <dt>本人接单</dt><dd :class="{ 'is-paused': paused(detail.user.creatorPaused) }">
                {{ paused(detail.user.creatorPaused) ? '已暂停' : '可接单' }}
              </dd>
            </div>
          </dl>
          <div class="user-related">
            <section>
              <h3>近期作品 <small>{{ detail.workCount }}</small></h3>
              <ul>
                <li
                  v-for="item in detail.works"
                  :key="item.id"
                >
                  <RouterLink
                    class="text-link"
                    :to="{ path: '/admin/works/' + item.id, query: { status: 'ALL' } }"
                  >{{ item.title || '未命名作品' }}</RouterLink><small>{{ workStatusLabels[item.status as WorkStatus] || item.status }}</small>
                </li>
                <li v-if="!detail.works.length">
                  暂无作品
                </li>
              </ul>
            </section>
            <section>
              <h3>近期需求 <small>{{ detail.requestCount }}</small></h3>
              <ul>
                <li
                  v-for="item in detail.requests"
                  :key="item.id"
                >
                  <span>{{ item.title || '未命名需求' }}</span><small>{{ requestStatus[item.status] || item.status }}</small>
                </li>
                <li v-if="!detail.requests.length">
                  暂无需求
                </li>
              </ul>
            </section>
          </div>
          <section class="user-orders">
            <h3>近期订单 <small>{{ detail.orderCount }}</small></h3>
            <ul>
              <li
                v-for="item in detail.orders"
                :key="item.id"
              >
                <RouterLink
                  class="text-link"
                  :to="{ name: 'admin-orders', query: { orderId: String(item.id), from: 'users', userId: selected, ...listQuery() } }"
                >{{ item.orderNo }}</RouterLink>
                <small>{{ item.orderType === 'STOCK' ? '现货' : '定制' }} · {{ orderStatus[item.status] || item.status }} · ¥{{ item.amount }}</small>
              </li>
              <li v-if="!detail.orders.length">
                暂无订单
              </li>
            </ul>
          </section>
          <section>
            <h3>暂停与恢复记录</h3>
            <p v-if="!detail.pauseHistory.length">
              暂无记录
            </p>
            <ol
              v-else
              class="user-history"
            >
              <li
                v-for="(item, index) in detail.pauseHistory"
                :key="index"
              >
                <div><strong>{{ actions[item.action] || item.action }}</strong><time>{{ formatTime(item.createdAt) }}</time></div>
                <p v-if="item.reason">
                  {{ item.reason }}
                </p>
                <p v-if="item.recoveryCondition">
                  恢复条件 · {{ item.recoveryCondition }}
                </p>
                <small>操作人 #{{ item.operatorId }}</small>
              </li>
            </ol>
          </section>
        </template>
        <p
          v-else
          class="user-empty"
        >
          选择账号以查看相关业务。
        </p>
      </section>
    </div>
    <dialog
      ref="pauseDialog"
      class="delete-dialog user-pause-dialog"
      aria-labelledby="user-pause-title"
      @cancel="submitting && $event.preventDefault()"
    >
      <h2 id="user-pause-title">
        {{ pauseTarget?.paused ? '暂停新业务' : '人工恢复新业务' }}
      </h2>
      <p v-if="pauseTarget">
        {{ pauseTarget.nickname }} · #{{ pauseTarget.id }}
      </p>
      <p
        v-if="pauseTarget?.paused"
        class="field-help"
      >
        已有订单付款、履约、会话及售后仍可使用。
      </p>
      <form
        novalidate
        @submit.prevent="savePause"
      >
        <AccountField
          v-model="reason"
          label="操作原因"
          multiline
          :error="fields.reason"
          :disabled="submitting"
        />
        <AccountField
          v-if="pauseTarget?.paused"
          v-model="recovery"
          label="恢复条件"
          multiline
          :error="fields.recoveryCondition"
          :disabled="submitting"
        />
        <p
          v-if="mutationError"
          class="form-alert"
          role="alert"
        >
          {{ mutationError }}
        </p>
        <div class="dialog-actions">
          <button
            class="button-secondary"
            type="button"
            :disabled="submitting"
            @click="pauseDialog?.close()"
          >
            取消
          </button>
          <button
            class="button-primary"
            :disabled="submitting"
          >
            {{ submitting ? '正在提交…' : pauseTarget?.paused ? '确认暂停' : '确认恢复' }}
          </button>
        </div>
      </form>
    </dialog>
  </AdminLayout>
</template>

<style scoped>
.user-filters { display: flex; align-items: end; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.user-filters label { display: grid; gap: 4px; color: var(--craft-muted); font-size: 12px; font-weight: 600; }
.user-filters :is(input, select) { min-height: 36px; padding: 6px 10px; border: 1px solid var(--craft-border); border-radius: 8px; background: var(--craft-surface); color: var(--craft-ink); font: inherit; }
.user-workspace { display: grid; grid-template-columns: minmax(240px, .9fr) minmax(0, 1.65fr); align-items: start; gap: 16px; }
.user-panel { min-width: 0; padding: 16px; border: 1px solid var(--craft-border); border-radius: 14px; background: var(--craft-surface); }
.user-panel header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.user-panel header h2 { margin: 0; font-size: 16px; overflow-wrap: anywhere; }
.user-panel header :is(p, span) { margin: 4px 0 0; color: var(--craft-muted); font-size: 12px; overflow-wrap: anywhere; }
.user-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px; border: 1px solid transparent; border-bottom-color: var(--craft-border); border-radius: 7px; color: var(--craft-ink); font-size: 13px; }
.user-row:hover, .user-row--selected { background: #fffbeb; border-color: #fde68a; }
.user-row > div { display: grid; min-width: 0; gap: 2px; }
.user-row small, .user-row > div span { color: var(--craft-muted); font-size: 11px; overflow-wrap: anywhere; }
.user-row small { flex-shrink: 0; }
.user-pause-state, .user-related { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.user-pause-state { margin: 0 0 16px; }
.user-pause-state div { display: flex; align-items: center; justify-content: space-between; gap: 5px; padding: 8px 10px; border-radius: 7px; background: var(--craft-bg); font-size: 12px; }
.user-pause-state dd { margin: 0; color: #065f46; font-weight: 650; }
.user-pause-state .is-paused { color: #92400e; }
.user-panel h3 { margin: 0 0 5px; font-size: 14px; }
.user-panel h3 small { margin-left: 3px; color: var(--craft-muted); font-size: 11px; font-weight: 500; }
.user-panel :is(ul, ol) { margin: 0; padding: 0; list-style: none; }
.user-panel li { padding: 6px 0; border-bottom: 1px solid var(--craft-border); font-size: 12px; overflow-wrap: anywhere; }
.user-panel li small { color: var(--craft-muted); }
.user-related li, .user-orders li, .user-history li > div { display: flex; justify-content: space-between; gap: 8px; }
.user-orders { margin: 16px 0; }
.user-history time, .user-empty { color: var(--craft-muted); }
.user-history p { margin: 4px 0; }
.user-empty { padding: 26px 0; text-align: center; }
.user-pause-dialog { width: min(480px, calc(100vw - 36px)); }
@media (max-width: 850px) { .user-workspace { grid-template-columns: 1fr; } }
</style>
