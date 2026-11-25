<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import WorkImagePicker from '@/components/WorkImagePicker.vue'
import WorkHistory from '@/components/WorkHistory.vue'
import WorkMaterials from '@/components/WorkMaterials.vue'
import { getCategories } from '@/api/creator'
import { createWork, getApprovedPublicationOrders, getManagedWork, getPublicationQuota, saveWork, submitWork, updateTrading, withdrawWork } from '@/api/work'
import { emptyWork, workContent, workStatusLabels } from '@/utils/work'
import type { CategoryVO } from '@/types/creator'
import type { PublicationOrderOptionVO, PublicationQuotaVO, WorkVO } from '@/types/work'
import { ApiError } from '@/utils/request'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/craftflow-publication.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const form = reactive(emptyWork())
const work = ref<WorkVO>()
const categories = ref<CategoryVO[]>([])
const quota = ref<PublicationQuotaVO>()
const publicationOrders = ref<PublicationOrderOptionVO[]>([])
const error = ref('')
const notice = ref('')
const fieldErrors = ref<Record<string, string>>({})
const editorForm = ref<HTMLFormElement>()
const errorFeedback = ref<HTMLElement>()
const successFeedback = ref<HTMLElement>()
const mainImageError = ref<HTMLElement>()
const loading = ref(true)
const ready = ref(false)
const busy = ref(false)
const mainUploading = ref(false)
const specificationUploading = ref(false)
const uploading = computed(() => mainUploading.value || specificationUploading.value)
const unresolved = ref(false)
const requestKey = crypto.randomUUID()
const baseline = ref(JSON.stringify(form))
const dirty = computed(() => JSON.stringify(form) !== baseline.value)
const selectable = computed(() => categories.value.flatMap(parent => parent.children.length ? parent.children.filter(c => c.enabled && c.selectableForWork).map(c => ({ id: c.id, name: `${parent.name} / ${c.name}` })) : parent.selectableForWork ? [{ id: parent.id, name: parent.name }] : []))
const pending = computed(() => work.value?.reviewStatus === 'PENDING')
let disposed = false

/** 四段表单操作后将反馈带入视口，字段校验时优先定位可修正的位置。 */
watch([error, notice, fieldErrors], ([failure, result]) => {
  if (!failure && !result) return
  const invalidField = failure && !unresolved.value
    ? editorForm.value?.querySelector<HTMLElement>('[aria-invalid="true"]') || mainImageError.value
    : undefined
  const target = invalidField || (failure ? errorFeedback.value : successFeedback.value)
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({ block: 'center' })
}, { flush: 'post' })

/** 服务端读取只在初始化或明确刷新时覆盖表单；失败和冲突保留输入。 */
async function initialize() {
  loading.value = true; error.value = ''
  try {
    const [available, limits, current, orders] = await Promise.all([getCategories(), getPublicationQuota(), route.params.id ? getManagedWork(String(route.params.id)) : Promise.resolve(undefined), getApprovedPublicationOrders()])
    if (disposed) return
    categories.value = available; quota.value = limits; publicationOrders.value = orders
    if (current) { work.value = current; Object.assign(form, workContent(current)) }
    baseline.value = JSON.stringify(form)
    ready.value = true
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '表单读取失败' }
  finally { loading.value = false }
}
function validate() {
  const errors: Record<string, string> = {}
  if (form.title.trim().length < 2 || form.title.trim().length > 30) errors.title = '标题需为 2—30 个字符'
  if (!form.categoryId) errors.categoryId = '请选择最具体的启用品类'
  if (!form.mainImageIds.length) errors.mainImageIds = '请至少上传一张主图'
  if (!form.material.trim() || form.material.length > 20) errors.material = '请填写 20 字以内的材质'
  if (!form.specification.trim()) errors.specification = '请填写尺寸规格'
  if (form.description.trim().length < 20 || form.description.length > 2000) errors.description = '作品描述需为 20—2000 字'
  if (form.processDescription.length > 1000) errors.processDescription = '制作过程不超过 1000 字'
  if (form.saleEnabled && (!form.stockPrice || !/^(?:[1-9]\d{0,4}|0)(?:\.\d{1,2})?$/.test(form.stockPrice) || /^0(?:\.0{1,2})?$/.test(form.stockPrice) || Number(form.stockPrice) > 99999)) errors.stockPrice = '现货售价为 0.01—99999 元，最多两位小数'
  if (form.customEnabled && (!Number.isInteger(form.customReferenceDays) || form.customReferenceDays! < 3 || form.customReferenceDays! > 180)) errors.customReferenceDays = '参考周期为 3—180 个自然日'
  fieldErrors.value = errors
  if (Object.keys(errors).length) {
    error.value = '请检查标记的字段'
    return false
  }
  return true
}
/** 关联订单后立即关闭现货销售；已保存来源由服务端禁止解除或替换。 */
function sourceOrderChanged() { if (form.sourceOrderId) { form.saleEnabled = false; form.stockPrice = null } }
/** 创建响应丢失时复用请求键重查；提交未知时先查状态，禁止盲目二次提交。 */
async function ensureCreated() {
  if (!work.value) work.value = await createWork(workContent(form), requestKey)
  return work.value
}
async function persist(submit: boolean) {
  if (busy.value || uploading.value || !ready.value || loading.value || unresolved.value) return
  error.value = ''; notice.value = ''; fieldErrors.value = {}
  if (submit && !validate()) return
  if (submit && work.value?.reviewStatus === 'ONLINE' && !window.confirm('展示内容修改将重新审核，提交后立即停止公开展示。确定提交？')) return
  busy.value = true
  let attemptedSubmission = false
  try {
    const current = await ensureCreated()
    attemptedSubmission = submit
    work.value = submit ? await submitWork(current.id, workContent(form), current.version) : await saveWork(current.id, workContent(form), current.version)
    Object.assign(form, workContent(work.value)); baseline.value = JSON.stringify(form)
    if (!route.params.id) await router.replace(`/creator/works/${work.value.id}/edit`)
    notice.value = submit ? work.value.reviewStatus === 'ONLINE' ? '交易设置已即时更新' : '作品已提交，等待管理员审核' : '草稿已保存'
    quota.value = await getPublicationQuota()
  } catch (failure) {
    if (failure instanceof ApiError && failure.status) {
      fieldErrors.value = failure.fieldErrors || {}
      error.value = failure.status === 409 ? `${failure.message}。输入已保留，请先核验最新状态。` : failure.message
      if (failure.status === 409) unresolved.value = true
    } else {
      // 只能以服务器状态确认结果；无法查询时冻结写操作并保留表单。
      try {
        const current = work.value ? await getManagedWork(work.value.id) : await createWork(workContent(form), requestKey)
        work.value = current
        if (attemptedSubmission && ['PENDING', 'ONLINE'].includes(current.reviewStatus) && JSON.stringify(workContent(current)) === JSON.stringify(workContent(form))) {
          baseline.value = JSON.stringify(form)
          if (!route.params.id) await router.replace(`/creator/works/${current.id}/edit`)
          notice.value = '已核验：服务器已接收本次提交'
        } else error.value = '已核验服务器状态，输入仍保留，可继续保存或提交。'
      } catch { unresolved.value = true; error.value = '网络中断，操作结果尚未确认。输入已保留，请恢复网络后核验。' }
    }
  } finally { busy.value = false }
}
async function reconcile() {
  busy.value = true; error.value = ''; notice.value = ''
  try { work.value = work.value ? await getManagedWork(work.value.id) : await createWork(workContent(form), requestKey); unresolved.value = false; notice.value = '已核验最新状态。输入已保留，请确认后再操作。' }
  catch (failure) { error.value = failure instanceof Error ? failure.message : '仍无法核验，请稍后重试' }
  finally { busy.value = false }
}
async function trading() {
  if (!work.value || busy.value || uploading.value || unresolved.value) return
  const errors = fieldErrors.value
  if (!validate()) { fieldErrors.value = Object.fromEntries(Object.entries(fieldErrors.value).filter(([key]) => ['stockPrice', 'customReferenceDays'].includes(key))); if (Object.keys(fieldErrors.value).length) return }
  fieldErrors.value = errors; error.value = ''; notice.value = ''; busy.value = true
  try {
    work.value = await updateTrading(work.value.id, { version: work.value.version, saleEnabled: form.saleEnabled, customEnabled: form.customEnabled, stockPrice: form.saleEnabled ? form.stockPrice : null, customReferenceDays: form.customEnabled ? form.customReferenceDays : null })
    // 展示内容的未保存修改仍保持脏状态，交易设置成功不能吞掉它们。
    const saved = JSON.parse(baseline.value)
    Object.assign(saved, { saleEnabled: work.value.saleEnabled, customEnabled: work.value.customEnabled, stockPrice: work.value.stockPrice, customReferenceDays: work.value.customReferenceDays })
    baseline.value = JSON.stringify(saved); notice.value = '交易设置已即时更新，作品保持上架'
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '更新结果未知，请核验'; unresolved.value = true }
  finally { busy.value = false }
}
async function withdraw() {
  if (!work.value || busy.value || !window.confirm('确定撤回本轮审核并返回草稿？')) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const preserveInput = dirty.value
    work.value = await withdrawWork(work.value.id, work.value.version)
    if (!preserveInput) Object.assign(form, workContent(work.value))
    baseline.value = JSON.stringify(workContent(work.value)); notice.value = preserveInput ? '已撤回，之前未保存的输入仍保留' : '已撤回，可继续编辑'
  }
  catch (failure) { error.value = failure instanceof Error ? failure.message : '结果未知，请核验'; unresolved.value = true }
  finally { busy.value = false }
}
function beforeUnload(event: BeforeUnloadEvent) { if (auth.session && (dirty.value || busy.value || uploading.value)) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(to => {
  // 退出成功或会话失效后必须离开受保护页面，未保存提示不能阻挡登录跳转。
  if (!auth.session) return true
  if (!route.params.id && work.value && to.path === `/creator/works/${work.value.id}/edit`) return true
  if (busy.value || uploading.value) return false
  if (dirty.value) return window.confirm('还有未保存的修改，确定离开？')
})
onMounted(() => { void initialize(); window.addEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => { disposed = true; window.removeEventListener('beforeunload', beforeUnload) })
</script>

<template>
  <WorkLayout presentation="craftflow">
    <section class="cf-publication cf-publication--editor">
      <nav
        class="cf-publication-breadcrumb"
        aria-label="当前位置"
      >
        <RouterLink to="/creator/works">
          我的作品
        </RouterLink>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ work ? '编辑作品' : '发布作品' }}</span>
      </nav>
      <header class="cf-publication-heading">
        <h1>{{ pending ? '待审核作品' : work ? '编辑作品' : '发布新作品' }}</h1>
        <span
          v-if="work"
          class="work-status"
          :class="work.reviewStatus"
        >{{ workStatusLabels[work.reviewStatus] }}</span>
      </header>
      <p
        v-if="error"
        ref="errorFeedback"
        class="form-alert"
        role="alert"
        tabindex="-1"
      >
        {{ error }}
        <button
          v-if="unresolved"
          type="button"
          class="inline-button"
          :disabled="busy"
          @click="reconcile"
        >
          核验最新状态
        </button>
        <button
          v-else-if="!ready"
          type="button"
          class="inline-button"
          @click="initialize"
        >
          重新读取
        </button>
      </p>
      <p
        v-if="notice"
        ref="successFeedback"
        class="form-success"
        role="status"
        tabindex="-1"
      >
        {{ notice }}
      </p>
      <p
        v-if="work?.reviewReason"
        class="cf-publication-warning"
      >
        审核意见：{{ work.reviewReason }}
      </p>
      <p
        v-if="loading"
        class="cf-publication-state"
      >
        正在读取作品资料…
      </p>
      <template v-else-if="pending && work">
        <div class="cf-publication-warning cf-publication-pending">
          <p>当前材料正在审核，撤回后才能修改。</p>
          <button
            class="button-secondary"
            type="button"
            :disabled="busy || uploading || unresolved"
            @click="withdraw"
          >
            撤回审核
          </button>
        </div>
        <div class="cf-publication-card cf-publication-materials">
          <WorkMaterials :work="work" />
        </div>
      </template>
      <form
        v-else-if="ready"
        ref="editorForm"
        class="cf-publication-form"
        @submit.prevent="persist(true)"
      >
        <p class="cf-publication-warning">
          请发布本人原创作品，勿重复发布相同内容；违规或重复作品可能被审核驳回或下架。
        </p>
        <section
          class="cf-publication-card cf-publication-section"
          aria-labelledby="work-basics"
        >
          <h2 id="work-basics">
            基本信息
          </h2>
          <fieldset
            aria-labelledby="work-basics"
            :disabled="busy || uploading || unresolved"
          >
            <div class="cf-publication-fields">
              <label class="work-field">
                作品标题
                <input
                  v-model="form.title"
                  aria-label="作品标题"
                  maxlength="30"
                  :aria-invalid="Boolean(fieldErrors.title)"
                >
                <small
                  v-if="fieldErrors.title"
                  class="field-error"
                >{{ fieldErrors.title }}</small>
              </label>
              <label class="work-field">
                所属品类
                <select
                  v-model="form.categoryId"
                  aria-label="所属品类"
                  :aria-invalid="Boolean(fieldErrors.categoryId)"
                >
                  <option :value="null">请选择最具体的品类</option>
                  <option
                    v-if="form.categoryId && !selectable.some(c => c.id === form.categoryId)"
                    :value="form.categoryId"
                    disabled
                  >原品类已停用或不再为末级，请重新选择</option>
                  <option
                    v-for="category in selectable"
                    :key="category.id"
                    :value="category.id"
                  >{{ category.name }}</option>
                </select>
                <small
                  v-if="fieldErrors.categoryId"
                  class="field-error"
                >{{ fieldErrors.categoryId }}</small>
              </label>
            </div>
            <label class="work-field">
              关联已授权的定制成品（选填）
              <select
                v-model="form.sourceOrderId"
                aria-label="关联已授权的定制成品"
                :disabled="Boolean(work?.sourceOrderId)"
                @change="sourceOrderChanged"
              >
                <option :value="null">普通作品，不关联定制订单</option>
                <option
                  v-for="item in publicationOrders"
                  :key="item.orderId"
                  :value="item.orderId"
                >订单 {{ item.orderId }} · {{ item.title }} · 完成于 {{ item.completedAt.slice(0, 10) }}</option>
              </select>
              <small class="field-help">
                {{ work?.sourceOrderId ? `来源订单 ${work.sourceOrderId} 已固定，不能更换或解除关联。` : '仅列出买家已同意公开的定制订单。' }}
              </small>
            </label>
          </fieldset>
        </section>
        <section
          class="cf-publication-card cf-publication-section"
          aria-labelledby="work-craft"
        >
          <h2 id="work-craft">
            工艺参数
          </h2>
          <fieldset
            aria-labelledby="work-craft"
            :disabled="busy || uploading || unresolved"
          >
            <div class="cf-publication-fields">
              <label class="work-field">
                材质
                <input
                  v-model="form.material"
                  aria-label="材质"
                  maxlength="20"
                  :aria-invalid="Boolean(fieldErrors.material)"
                >
                <small
                  v-if="fieldErrors.material"
                  class="field-error"
                >{{ fieldErrors.material }}</small>
              </label>
              <label class="work-field">
                尺寸规格
                <input
                  v-model="form.specification"
                  aria-label="尺寸规格"
                  maxlength="200"
                  :aria-invalid="Boolean(fieldErrors.specification)"
                >
                <small
                  v-if="fieldErrors.specification"
                  class="field-error"
                >{{ fieldErrors.specification }}</small>
              </label>
            </div>
            <WorkImagePicker
              v-model="form.specificationImageIds"
              label="尺寸图"
              :max="9"
              :disabled="busy || uploading || unresolved"
              @uploading="specificationUploading = $event"
            />
          </fieldset>
        </section>
        <section
          class="cf-publication-card cf-publication-section"
          aria-labelledby="work-trading"
        >
          <header class="cf-publication-section-heading">
            <div>
              <h2 id="work-trading">
                交易信息
              </h2>
              <p>两个开关可独立设置，均关闭时作品仅供展示。</p>
            </div>
            <button
              v-if="work?.reviewStatus === 'ONLINE'"
              type="button"
              class="button-secondary"
              :disabled="busy || uploading || unresolved"
              @click="trading"
            >
              即时更新交易设置
            </button>
          </header>
          <fieldset
            class="cf-publication-fields"
            aria-labelledby="work-trading"
            :disabled="busy || uploading || unresolved"
          >
            <div class="cf-publication-trade">
              <label class="trade-toggle">
                <span><strong>出售现货</strong><small>出售当前这一件成品</small></span>
                <input
                  v-model="form.saleEnabled"
                  type="checkbox"
                  role="switch"
                  aria-label="出售现货"
                  :disabled="Boolean(form.sourceOrderId)"
                >
              </label>
              <p
                v-if="form.sourceOrderId"
                class="field-help"
              >
                定制成品案例不得出售现货。
              </p>
              <label
                v-if="form.saleEnabled"
                class="work-field"
              >
                成品售价（元）
                <input
                  v-model="form.stockPrice"
                  aria-label="成品售价（元）"
                  inputmode="decimal"
                  placeholder="0.01—99999"
                  :aria-invalid="Boolean(fieldErrors.stockPrice)"
                >
                <small
                  v-if="fieldErrors.stockPrice"
                  class="field-error"
                >{{ fieldErrors.stockPrice }}</small>
              </label>
            </div>
            <div class="cf-publication-trade">
              <label class="trade-toggle">
                <span><strong>接受定制</strong><small>以作品为参考，另外制作</small></span>
                <input
                  v-model="form.customEnabled"
                  type="checkbox"
                  role="switch"
                  aria-label="接受定制"
                >
              </label>
              <label
                v-if="form.customEnabled"
                class="work-field"
              >
                同类定制参考周期（天）
                <input
                  v-model.number="form.customReferenceDays"
                  aria-label="同类定制参考周期（天）"
                  type="number"
                  min="3"
                  max="180"
                  :aria-invalid="Boolean(fieldErrors.customReferenceDays)"
                >
                <small :class="fieldErrors.customReferenceDays ? 'field-error' : 'field-help'">{{ fieldErrors.customReferenceDays || '3—180 个自然日，实际价格和工期以独立报价为准。' }}</small>
              </label>
            </div>
          </fieldset>
        </section>
        <section
          class="cf-publication-card cf-publication-section"
          aria-labelledby="work-story"
        >
          <h2 id="work-story">
            图文详情
          </h2>
          <fieldset
            aria-labelledby="work-story"
            :disabled="busy || uploading || unresolved"
          >
            <WorkImagePicker
              v-model="form.mainImageIds"
              label="作品主图"
              cover
              :max="9"
              :disabled="busy || uploading || unresolved"
              @uploading="mainUploading = $event"
            />
            <p
              v-if="fieldErrors.mainImageIds"
              ref="mainImageError"
              class="field-error"
              tabindex="-1"
            >
              {{ fieldErrors.mainImageIds }}
            </p>
            <label class="work-field">
              作品描述
              <textarea
                v-model="form.description"
                aria-label="作品描述"
                rows="5"
                maxlength="2000"
                :aria-invalid="Boolean(fieldErrors.description)"
              />
              <small :class="fieldErrors.description ? 'field-error' : 'field-help'">{{ fieldErrors.description || `${form.description.length} / 2000 · 至少 20 字` }}</small>
            </label>
            <label class="work-field">
              制作过程说明
              <textarea
                v-model="form.processDescription"
                aria-label="制作过程说明"
                rows="3"
                maxlength="1000"
                :aria-invalid="Boolean(fieldErrors.processDescription)"
              />
              <small :class="fieldErrors.processDescription ? 'field-error' : 'field-help'">{{ fieldErrors.processDescription || '可选，最多 1000 字。' }}</small>
            </label>
          </fieldset>
        </section>
        <footer class="cf-publication-card cf-publication-footer">
          <div class="cf-publication-guidance">
            <p>标题和描述请勿包含联系方式、外链或其他平台店铺名。</p>
            <p v-if="work?.reviewStatus === 'ONLINE'">
              展示内容提交重审后将暂时停止公开展示。
            </p>
            <p v-if="quota">
              今日首次提交 {{ quota.used }} / {{ quota.limit }} 件，保存草稿和同一作品重提不计入额度。
            </p>
            <p
              v-if="quota && !quota.canPublish"
              class="field-error"
            >
              {{ quota.reason }}
            </p>
          </div>
          <div class="cf-publication-buttons">
            <button
              v-if="work?.reviewStatus !== 'ONLINE'"
              class="button-secondary"
              type="button"
              :disabled="busy || uploading || unresolved"
              @click="persist(false)"
            >
              {{ busy ? '处理中…' : '保存草稿' }}
            </button>
            <button
              class="button-primary"
              type="submit"
              :disabled="busy || uploading || unresolved"
            >
              {{ busy ? '处理中…' : work?.reviewStatus === 'ONLINE' ? '提交修改并重新审核' : '提交审核' }}
            </button>
          </div>
        </footer>
      </form>
      <WorkHistory
        v-if="work"
        :work-id="work.id"
        :revision="work.version"
      />
    </section>
  </WorkLayout>
</template>
