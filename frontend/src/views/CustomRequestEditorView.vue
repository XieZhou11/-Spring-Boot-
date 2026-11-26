<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import PrivateImagePicker from '@/components/PrivateImagePicker.vue'
import { getCategories } from '@/api/creator'
import { getCreator, getWork } from '@/api/work'
import { createRequest, getCandidateCreators, getCustomRequest, getRequestQuota, publishRequest, saveRequest } from '@/api/customRequest'
import type { CategoryVO } from '@/types/creator'
import type { CreatorPublicVO, WorkVO } from '@/types/work'
import type { CustomRequestVO, RequestContent, RequestQuotaVO } from '@/types/customRequest'
import { requestContent, requestListPaths, requestListReturn } from '@/utils/customRequest'
import { ApiError } from '@/utils/request'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/custom-request.css'
import '@/assets/styles/craftflow-demand.css'

const route = useRoute(); const router = useRouter(); const auth = useAuthStore()
const form = reactive(requestContent()); const current = ref<CustomRequestVO>(); const quota = ref<RequestQuotaVO>()
const categories = ref<CategoryVO[]>([]); const selectedCreator = ref<CreatorPublicVO>(); const candidates = ref<CreatorPublicVO[]>([])
const keyword = ref(''); const searching = ref(false); const sourceWork = ref<WorkVO>()
const loading = ref(true); const ready = ref(false); const busy = ref(false); const uploading = ref(false); const unresolved = ref(false)
const error = ref(''); const notice = ref(''); const fields = ref<Record<string, string>>({})
const baseline = ref(''); const dirty = computed(() => ready.value && JSON.stringify(form) !== baseline.value)
const returnTo = computed(() => {
  const source = requestListReturn(route.query.returnTo)
  return router.resolve(source).path === requestListPaths.mine ? source : requestListPaths.mine
})
const returnQuery = computed(() => returnTo.value === requestListPaths.mine ? {} : { returnTo: returnTo.value })
let requestKey = crypto.randomUUID(); let creation: RequestContent | undefined; let initializationRevision = 0; let candidateRevision = 0
/** 来源品类仍是末级时沿用。原一级新增子类后，只能选择该一级下的启用末级。 */
const sourceRoot = computed(() => categories.value.find(root =>
  root.id === sourceWork.value?.categoryId || root.children.some(child => child.id === sourceWork.value?.categoryId),
))
const sourceNeedsChild = computed(() => sourceRoot.value?.id === sourceWork.value?.categoryId && sourceRoot.value?.selectableForWork === false)
const selectable = computed(() => categories.value.flatMap(root => {
  if (form.sourceWorkId && (!sourceWork.value?.customizable || !selectedCreator.value || sourceWork.value.creatorId !== form.invitedCreatorId || root.id !== sourceRoot.value?.id)) return []
  if (form.visibility === 'DIRECTED' && selectedCreator.value && !selectedCreator.value.categories.some(c => c.id === root.id)) return []
  const options = root.children.length ? root.children.filter(c => c.enabled && c.selectableForWork).map(c => ({ id: c.id, name: `${root.name} / ${c.name}` })) : root.enabled && root.selectableForWork ? [{ id: root.id, name: root.name }] : []
  return form.sourceWorkId && !sourceNeedsChild.value ? options.filter(option => option.id === sourceWork.value?.categoryId) : options
}))
const sourceCategoryHint = computed(() => {
  if (!form.sourceWorkId) return ''
  if (!selectable.value.length) return '来源作品当前无法发起同类定制。可调整需求范围或稍后重试。'
  return sourceNeedsChild.value && !form.categoryId ? '请选择原作品主品类下启用的末级品类' : ''
})
/** 按北京时间自然日给出提示，最终日期以实际发布时的服务端校验为准。 */
function dateAfter(days: number) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find(p => p.type === type)!.value
  const value = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00+08:00`)
  value.setUTCDate(value.getUTCDate() + days)
  return new Date(value.getTime() + 8 * 3600000).toISOString().slice(0, 10)
}
/** 下架作品或失去认证的作者仍可留在草稿中，买家可调整范围后继续编辑。 */
function missingDraftReference(failure: unknown) {
  if (!(failure instanceof ApiError) || failure.status !== 404) throw failure
}
function syncSourceCategory() {
  if (!form.sourceWorkId || !selectable.value.length || selectable.value.some(option => option.id === form.categoryId)) return
  form.categoryId = selectable.value.find(option => option.id === sourceWork.value?.categoryId)?.id ?? null
}
/** 发布被明确拒绝后更新来源及品类选项，保留仍有效的输入。 */
async function refreshSourceCategory() {
  const { sourceWorkId, invitedCreatorId } = form
  if (!sourceWorkId || !invitedCreatorId) return
  const revision = initializationRevision
  try {
    const [available, work, creator] = await Promise.all([
      getCategories(),
      getWork(sourceWorkId).catch(missingDraftReference),
      getCreator(invitedCreatorId).catch(missingDraftReference),
    ])
    if (revision !== initializationRevision || form.sourceWorkId !== sourceWorkId || form.invitedCreatorId !== invitedCreatorId) return
    categories.value = available
    sourceWork.value = work || undefined
    selectedCreator.value = creator || undefined
    syncSourceCategory()
  } catch {
    // 保留原发布错误和草稿输入，可再次提交或重新打开草稿。
  }
}
async function initialize() {
  const revision = ++initializationRevision
  const draftId = route.params.id
  const { sourceWorkId, creatorId } = route.query
  loading.value = true; error.value = ''
  try {
    const [available, limits] = await Promise.all([getCategories(), getRequestQuota()])
    if (revision !== initializationRevision) return
    let draft: CustomRequestVO | undefined
    let source: WorkVO | undefined
    let creator: CreatorPublicVO | undefined
    let content = requestContent()
    if (draftId) {
      draft = await getCustomRequest(String(draftId), true)
      if (revision !== initializationRevision) return
      content = requestContent(draft)
      if (draft.canEdit) {
        const invited = content.invitedCreatorId ? getCreator(content.invitedCreatorId) : undefined
        if (content.sourceWorkId) {
          const [workResult, creatorResult] = await Promise.all([
            getWork(content.sourceWorkId).catch(missingDraftReference),
            invited?.catch(missingDraftReference),
          ])
          source = workResult || undefined
          creator = creatorResult || undefined
        } else {
          creator = await invited
        }
      }
    } else if (typeof sourceWorkId === 'string') {
      const work = await getWork(sourceWorkId)
      if (revision !== initializationRevision) return
      if (!work.customizable || work.creatorId === auth.session?.userId) throw new Error('此作品当前不能发起定制')
      creator = await getCreator(work.creatorId)
      source = work
      Object.assign(content, { visibility: 'DIRECTED', sourceWorkId: work.id, invitedCreatorId: work.creatorId, categoryId: work.categoryId })
    } else if (typeof creatorId === 'string') {
      creator = await getCreator(creatorId)
      if (creator.paused || creator.id === auth.session?.userId) throw new Error('此创作者当前不能接受定向邀约')
      content.visibility = 'DIRECTED'
      content.invitedCreatorId = creator.id
    }
    // 一次提交当前路由的读取结果，避免较早的品类或来源覆盖新表单。
    if (revision !== initializationRevision) return
    categories.value = available; quota.value = limits; current.value = draft
    sourceWork.value = source; selectedCreator.value = creator
    Object.assign(form, content)
    syncSourceCategory()
    baseline.value = JSON.stringify(form); ready.value = true
  } catch (failure) {
    if (revision === initializationRevision) error.value = failure instanceof Error ? failure.message : '表单读取失败'
  } finally {
    if (revision === initializationRevision) loading.value = false
  }
}
async function searchCreators() {
  if (!form.categoryId) return
  const revision = ++candidateRevision; searching.value = true; error.value = ''
  try { const result = await getCandidateCreators(form.categoryId, keyword.value); if (revision === candidateRevision) candidates.value = result.items }
  catch (failure) { if (revision === candidateRevision) error.value = failure instanceof Error ? failure.message : '创作者查询失败' }
  finally { if (revision === candidateRevision) searching.value = false }
}
watch(() => form.categoryId, () => { candidates.value = []; candidateRevision++ })
function rangeChanged() { form.invitedCreatorId = null; selectedCreator.value = undefined; form.sourceWorkId = null; sourceWork.value = undefined; candidates.value = [] }
function chooseCreator(id: string) { selectedCreator.value = candidates.value.find(c => c.id === id); form.invitedCreatorId = id || null; form.sourceWorkId = null; sourceWork.value = undefined }
function validate() {
  const result: Record<string, string> = {}
  if (form.title.trim().length < 5 || form.title.trim().length > 30) result.title = '标题需为 5—30 字'
  if (!selectable.value.some(option => option.id === form.categoryId)) result.categoryId = sourceCategoryHint.value || '请选择启用的末级品类'
  for (const key of ['purpose', 'materialPreference', 'specification'] as const) if (!form[key].trim()) result[key] = '请填写；没有偏好可注明无特殊要求'
  if (form.description.trim().length < 20 || form.description.trim().length > 2000) result.description = '描述需为 20—2000 字'
  const money = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/
  for (const key of ['budgetMin', 'budgetMax'] as const) if (!form[key] || !money.test(form[key]!) || Number(form[key]) < 50 || Number(form[key]) > 50000) result[key] = '预算为 50—50000 元，最多两位小数'
  if (!result.budgetMin && !result.budgetMax && Number(form.budgetMax) < Number(form.budgetMin)) result.budgetMax = '预算上限不能低于下限'
  if (!form.expectedShipDate || form.expectedShipDate < dateAfter(7) || form.expectedShipDate > dateAfter(180)) result.expectedShipDate = '请选择发布日后 7—180 天'
  if (form.visibility === 'DIRECTED' && !form.invitedCreatorId) result.invitedCreatorId = '请选择一位创作者'
  fields.value = result
  if (Object.keys(result).length) { error.value = '请检查标记的字段'; requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return false }
  return true
}
/** 创建重试始终使用首次快照与同一请求键；后续编辑通过版本化保存完成。 */
async function ensureCreated() {
  if (!current.value) { creation ||= requestContent(form); current.value = await createRequest(creation, requestKey) }
  return current.value
}
async function persist(publication: boolean) {
  if (busy.value || uploading.value || unresolved.value) return
  error.value = ''; notice.value = ''; fields.value = {}
  if (publication && !validate()) return
  busy.value = true
  try {
    const existing = await ensureCreated()
    current.value = publication ? await publishRequest(existing.id, requestContent(form), existing.version) : await saveRequest(existing.id, requestContent(form), existing.version)
    Object.assign(form, requestContent(current.value)); baseline.value = JSON.stringify(form)
    notice.value = publication ? '需求已发布' : '草稿已保存'
    await router.replace({ path: publication ? `/requests/${current.value.id}` : `/my-requests/${current.value.id}/edit`, query: returnQuery.value })
  } catch (failure) {
    // 明确拒绝且尚未创建时，修正后的内容必须成为新的创建请求。
    if (!current.value && failure instanceof ApiError && [400, 403, 404, 422].includes(failure.status)) { creation = undefined; requestKey = crypto.randomUUID() }
    if (failure instanceof ApiError) fields.value = failure.fieldErrors
    error.value = failure instanceof Error ? failure.message : '请求失败'
    if (publication && current.value && failure instanceof ApiError && failure.status === 400) {
      await refreshSourceCategory()
    }
    if (!(failure instanceof ApiError) || !failure.status || failure.status === 409) {
      unresolved.value = true; error.value += '。输入已保留，请核验最新状态后继续。'
    }
  } finally { busy.value = false }
}
async function reconcile() {
  busy.value = true; error.value = ''
  try {
    const result = current.value ? await getCustomRequest(current.value.id, true) : await ensureCreated()
    current.value = result; unresolved.value = false
    if (!result.canEdit) { baseline.value = JSON.stringify(form); await router.replace({ path: `/requests/${result.id}`, query: returnQuery.value }) }
    else notice.value = '已核验最新版本，输入已保留。请确认后重新保存或发布。'
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '仍无法核验' }
  finally { busy.value = false }
}
function beforeUnload(event: BeforeUnloadEvent) { if (auth.session && (dirty.value || uploading.value || busy.value)) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(to => {
  if (!auth.session) return true
  if (current.value && (to.path === `/requests/${current.value.id}` || to.path === `/my-requests/${current.value.id}/edit`) && !dirty.value) return true
  if (busy.value || uploading.value) return false
  return !dirty.value || window.confirm('还有未保存的修改，确定离开？')
})
onBeforeRouteUpdate(to => {
  if (current.value && to.params.id === current.value.id) return true
  if (busy.value || uploading.value || loading.value) return false
  return !dirty.value || window.confirm('还有未保存的修改，确定切换需求？')
})
// 同一编辑组件切换需求时重新加载；首次保存替换URL则保留当前已核验结果。
watch(() => route.fullPath, () => {
  if (current.value && route.params.id === current.value.id) return
  current.value = undefined; selectedCreator.value = undefined; sourceWork.value = undefined; creation = undefined; requestKey = crypto.randomUUID()
  ready.value = false; unresolved.value = false; fields.value = {}; notice.value = ''; candidates.value = []; candidateRevision++
  Object.assign(form, requestContent()); void initialize()
})
onMounted(() => { void initialize(); window.addEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => { initializationRevision++; candidateRevision++; window.removeEventListener('beforeunload', beforeUnload) })
</script>
<template>
  <WorkLayout>
    <div class="cf-request-editor-page">
      <nav
        class="cf-request-breadcrumb"
        aria-label="需求导航"
      >
        <RouterLink :to="returnTo">我的需求</RouterLink><span aria-hidden="true">/</span><span>{{ current ? '编辑草稿' : '发布定制需求' }}</span>
      </nav>
      <header class="cf-request-editor-heading">
        <div>
          <h1>{{ current ? '编辑需求草稿' : '发布定制需求' }}</h1>
          <p>发布后内容与范围将锁定。</p>
        </div>
        <p v-if="quota">
          开放中 {{ quota.used }} / {{ quota.limit }} 条
        </p>
      </header>
      <p
        v-if="error"
        class="form-alert"
        role="alert"
      >
        {{ error }} <button
          v-if="unresolved"
          class="inline-button"
          :disabled="busy"
          @click="reconcile"
        >
          核验最新状态
        </button><button
          v-else-if="!ready"
          class="inline-button"
          @click="initialize"
        >
          重新读取
        </button>
      </p>
      <p
        v-if="notice"
        class="form-success"
        role="status"
      >
        {{ notice }}
      </p><p
        v-if="loading"
        role="status"
      >
        正在准备需求表单…
      </p>
      <div
        v-else-if="current && !current.canEdit"
        class="creator-empty"
      >
        <p>此需求已发布，内容已锁定。</p><RouterLink :to="{ path: `/requests/${current.id}`, query: returnQuery }">查看需求</RouterLink>
      </div>
      <form
        v-else-if="ready"
        class="request-editor"
        @submit.prevent="persist(true)"
      >
        <fieldset :disabled="busy || unresolved">
          <legend class="sr-only">
            定制需求内容
          </legend>
          <section class="editor-section">
            <h2>定制内容</h2>
            <label class="work-field">需求标题<input
              v-model="form.title"
              aria-label="需求标题"
              maxlength="30"
              :aria-invalid="!!fields.title"
            ><small class="field-error">{{ fields.title }}</small></label>
            <label class="work-field">需求范围<select
              v-model="form.visibility"
              aria-label="需求范围"
              @change="rangeChanged"
            ><option value="PUBLIC">公开 · 让认证创作者发现需求</option><option value="DIRECTED">定向 · 仅邀请一位创作者</option></select></label>
            <label class="work-field">需求品类<select
              v-model="form.categoryId"
              aria-label="需求品类"
              :aria-invalid="!!fields.categoryId"
            ><option :value="null">请选择末级品类</option><option
              v-for="item in selectable"
              :key="item.id"
              :value="item.id"
            >{{ item.name }}</option></select><small
              v-if="fields.categoryId || sourceCategoryHint"
              :class="fields.categoryId ? 'field-error' : 'field-help'"
            >{{ fields.categoryId || sourceCategoryHint }}</small></label>
            <div
              v-if="form.visibility === 'DIRECTED'"
              class="request-invite-picker"
            >
              <p v-if="selectedCreator">
                指定创作者：<strong>{{ selectedCreator.nickname }}</strong><button
                  v-if="!form.sourceWorkId"
                  type="button"
                  class="inline-button"
                  @click="rangeChanged(); form.visibility = 'DIRECTED'"
                >
                  重新选择
                </button>
              </p>
              <template v-else-if="!form.sourceWorkId">
                <label class="work-field">创作者昵称<input
                  v-model="keyword"
                  aria-label="创作者昵称"
                  maxlength="30"
                ></label><button
                  type="button"
                  class="button-secondary"
                  :disabled="!form.categoryId || searching"
                  @click="searchCreators"
                >
                  查找同品类创作者
                </button><label
                  v-if="candidates.length"
                  class="work-field"
                >受邀创作者<select
                  :value="form.invitedCreatorId || ''"
                  aria-label="受邀创作者"
                  :aria-invalid="!!fields.invitedCreatorId"
                  @change="chooseCreator(($event.target as HTMLSelectElement).value)"
                ><option value="">请选择一位创作者</option><option
                  v-for="creator in candidates"
                  :key="creator.id"
                  :value="creator.id"
                >{{ creator.nickname }}</option></select></label><p
                  v-else
                  class="field-help"
                >
                  选择需求品类后，按昵称查找正在接单的创作者。
                </p>
              </template>
              <small class="field-error">{{ fields.invitedCreatorId }}</small><p
                v-if="sourceWork"
                class="field-help"
              >
                参考作品：{{ sourceWork.title }}。仅作定制参考，不占用现货。
              </p>
            </div>
            <label
              v-for="item in [{ key: 'purpose', label: '用途', max: 10000 }, { key: 'materialPreference', label: '材质偏好', max: 10000 }, { key: 'specification', label: '尺寸规格', max: 10000 }] as const"
              :key="item.key"
              class="work-field"
            >{{ item.label }}<input
              v-model="form[item.key]"
              :aria-label="item.label"
              :maxlength="item.max"
              :aria-invalid="!!fields[item.key]"
            ><small class="field-error">{{ fields[item.key] }}</small></label>
          </section>
          <section class="editor-section">
            <h2>预算与时间</h2><div class="work-fields-pair">
              <label
                v-for="item in [{ key: 'budgetMin', label: '预算下限（元）' }, { key: 'budgetMax', label: '预算上限（元）' }] as const"
                :key="item.key"
                class="work-field"
              >{{ item.label }}<input
                v-model="form[item.key]"
                :aria-label="item.label"
                inputmode="decimal"
                placeholder="50—50000"
                :aria-invalid="!!fields[item.key]"
              ><small class="field-error">{{ fields[item.key] }}</small></label>
            </div><label class="work-field">期望发货日期<input
              v-model="form.expectedShipDate"
              type="date"
              aria-label="期望发货日期"
              :min="dateAfter(7)"
              :max="dateAfter(180)"
              :aria-invalid="!!fields.expectedShipDate"
            ><small :class="fields.expectedShipDate ? 'field-error' : 'field-help'">{{ fields.expectedShipDate || '实际发布日后 7—180 天，以北京时间计算。' }}</small></label>
          </section>
          <section class="editor-section">
            <h2>细节与参考</h2><label class="work-field">需求描述<textarea
              v-model="form.description"
              aria-label="需求描述"
              rows="7"
              maxlength="2000"
              :aria-invalid="!!fields.description"
            /><small :class="fields.description ? 'field-error' : 'field-help'">{{ fields.description || `${form.description.length} / 2000 · 至少 20 字` }}</small></label><PrivateImagePicker
              v-model="form.referenceImageIds"
              label="参考图片"
              :max="9"
              :disabled="busy || unresolved"
              @uploading="uploading = $event"
            /><small class="field-error">{{ fields.referenceImageIds }}</small>
          </section>
        </fieldset>
        <div class="request-actions">
          <button
            type="button"
            class="button-secondary"
            :disabled="busy || uploading || unresolved"
            @click="persist(false)"
          >
            保存草稿
          </button><button
            type="submit"
            class="button-primary"
            :disabled="busy || uploading || unresolved"
          >
            {{ busy ? '正在保存…' : '发布需求' }}
          </button><p class="field-help">
            发布后不可编辑；需要调整时，关闭原需求再复制新建。
          </p>
        </div>
      </form>
    </div>
  </WorkLayout>
</template>
