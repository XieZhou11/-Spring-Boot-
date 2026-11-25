<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AccountLayout from '@/layouts/AccountLayout.vue'
import AccountField from '@/components/AccountField.vue'
import AddressRegion from '@/components/AddressRegion.vue'
import ApplicationImagePicker from '@/components/ApplicationImagePicker.vue'
import ApplicationMaterials from '@/components/ApplicationMaterials.vue'
import { getApplication, getApplications, getCategories, getCertification, submitApplication, withdrawApplication } from '@/api/creator'
import { useAuthForm } from '@/composables/useAuthForm'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/utils/request'
import { applicationStatusLabels, formatTime } from '@/utils/creator'
import type { ApplicationSummaryVO, ApplicationVO, CategoryVO, CertificationVO, CreatorApplicationDTO } from '@/types/creator'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const certification = ref<CertificationVO | null>(null)
const categories = ref<CategoryVO[]>([])
const history = ref<ApplicationSummaryVO[]>([])
const total = ref(0)
const page = ref(1)
const selected = ref<ApplicationVO | null>(null)
const loading = ref(true)
const loadError = ref('')
const editing = ref(false)
const years = ref('0')
const uploads = ref(0)
const notice = ref('')
const uncertain = ref(false)
const withdrawalDialog = ref<HTMLDialogElement>()
const withdrawing = ref(false)
const { errors, message, submitting, validate, showError } = useAuthForm()
const form = reactive<CreatorApplicationDTO>(emptyForm())
let disposed = false
let loadRevision = 0
let baselineApplicationId: string | null = null
const mayApply = computed(() => certification.value && !auth.session?.roles.includes('ADMIN') && !['PENDING', 'APPROVED'].includes(certification.value.certificationStatus))
const isCurrentPending = computed(() => selected.value?.status === 'PENDING' && selected.value.id === certification.value?.currentApplicationId)
const primaryCategories = computed(() => categories.value.filter(c => c.enabled && !c.parentId))
const certificationStatus = computed(() => certification.value?.certificationStatus ?? 'NONE')

function emptyForm(): CreatorApplicationDTO {
  return { requestKey: crypto.randomUUID(), realName: '', contactPhone: '', province: '', city: '', district: '', categoryIds: [], experienceYears: 0, introduction: '', originalWorks: Array.from({ length: 3 }, () => ({ finishedImageIds: [], processImageIds: [] })), alipayAccount: '', payeeName: '', supportingDescription: '' }
}

/** 编辑材料后视为新提交；未知响应重试且未编辑时保留原请求键。 */
watch(() => JSON.stringify({ ...form, requestKey: undefined, years: years.value }), () => {
  if (!editing.value) return
  form.requestKey = crypto.randomUUID()
  uncertain.value = false
})

async function load() {
  const current = ++loadRevision
  loading.value = true
  loadError.value = ''
  try {
    const [state, tree, list] = await Promise.all([getCertification(), getCategories(), getApplications(page.value)])
    if (disposed || current !== loadRevision) return
    certification.value = state
    categories.value = tree
    history.value = list.items
    total.value = list.total
    const requested = typeof route.query.applicationId === 'string' ? route.query.applicationId : null
    const id = requested || state.approvedApplicationId || state.currentApplicationId || list.items[0]?.id
    const detail = id ? await getApplication(id) : null
    if (!disposed && current === loadRevision) selected.value = detail
  } catch (failure) {
    if (!disposed && current === loadRevision) loadError.value = failure instanceof Error ? failure.message : '认证资料读取失败'
  } finally {
    if (current === loadRevision) loading.value = false
  }
}

async function refreshState() {
  if (editing.value || submitting.value || withdrawing.value) return
  await load()
  await auth.restoreSession(true).catch(() => { /* 导航会重新核验。 */ })
}

async function viewHistory(id: string) {
  await router.replace({ query: { applicationId: id } })
}

/** 重提复制材料到内存形成新申请，历史材料不被覆盖。 */
function startApplication() {
  const source = selected.value
  editing.value = false
  Object.assign(form, emptyForm())
  if (source && ['REJECTED', 'WITHDRAWN'].includes(source.status)) {
    for (const key of ['realName', 'contactPhone', 'province', 'city', 'district', 'introduction', 'alipayAccount', 'payeeName', 'supportingDescription'] as const) form[key] = source[key] || ''
    form.experienceYears = source.experienceYears
    form.categoryIds = source.categoryIds.filter(id => primaryCategories.value.some(c => c.id === id))
    form.originalWorks = source.originalWorks.map(w => ({ finishedImageIds: [...w.finishedImageIds], processImageIds: [...w.processImageIds] }))
  }
  years.value = String(form.experienceYears)
  baselineApplicationId = certification.value?.currentApplicationId || null
  uncertain.value = false
  notice.value = ''
  message.value = ''
  Object.keys(errors).forEach(key => delete errors[key])
  editing.value = true
}

async function checkFields() {
  const count = (value: string) => Array.from(value.trim()).length
  const fields: Record<string, string> = {
    realName: count(form.realName) < 2 || count(form.realName) > 20 ? '姓名需为 2—20 字' : '',
    contactPhone: /^1[3-9]\d{9}$/.test(form.contactPhone.trim()) ? '' : '请填写有效的 11 位手机号',
    province: form.province.trim() ? '' : '请填写省份', city: form.city.trim() ? '' : '请填写城市', district: form.district.trim() ? '' : '请填写区县',
    categoryIds: form.categoryIds.length < 1 || form.categoryIds.length > 3 ? '请选择 1—3 个一级主品类' : '',
    experienceYears: /^\d+$/.test(years.value) && Number(years.value) <= 70 ? '' : '从业年限需为 0—70 的整数',
    introduction: count(form.introduction) < 50 || count(form.introduction) > 500 ? '个人介绍需为 50—500 字' : '',
    alipayAccount: /^(1[3-9]\d{9}|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(form.alipayAccount.trim()) ? '' : '请填写手机号或邮箱格式的支付宝账号',
    payeeName: form.payeeName.trim() !== form.realName.trim() || !form.payeeName.trim() ? '收款人姓名须与申请人姓名一致' : '',
    originalWorks: form.originalWorks.length < 3 || form.originalWorks.length > 5 ? '请提供 3—5 件原创作品' : '',
  }
  form.originalWorks.forEach((w, index) => {
    fields[`originalWorks[${index}].finishedImageIds`] = w.finishedImageIds.length ? '' : '每件作品至少提供一张成品图'
    fields[`originalWorks[${index}].processImageIds`] = w.processImageIds.length ? '' : '每件作品至少提供一张制作过程图'
  })
  return validate(fields)
}

async function acceptApplication(application: ApplicationVO) {
  selected.value = application
  editing.value = false
  uncertain.value = false
  notice.value = '申请已提交，可在下方查看审核进度。'
  await router.replace({ query: { applicationId: application.id } })
  await load()
}

/** 响应丢失后重查服务端状态，不把超时直接视为提交失败。 */
async function querySubmissionResult() {
  const state = await getCertification()
  certification.value = state
  if (!state.currentApplicationId || state.currentApplicationId === baselineApplicationId) return false
  const current = await getApplication(state.currentApplicationId)
  const same = current.realName === form.realName.trim() && current.alipayAccount === form.alipayAccount.trim() && JSON.stringify(current.originalWorks.map(w => [w.finishedImageIds, w.processImageIds])) === JSON.stringify(form.originalWorks.map(w => [w.finishedImageIds, w.processImageIds]))
  if (same) {
    await acceptApplication(current)
    return true
  }
  return false
}

async function submit() {
  if (submitting.value || uploads.value) return
  if (!(await checkFields())) return
  submitting.value = true
  try {
    // 转换提交快照，不回写表单，避免内部规范化误触发新的幂等请求键。
    const input = { ...form, experienceYears: Number(years.value), realName: form.realName.trim(), contactPhone: form.contactPhone.trim(), payeeName: form.payeeName.trim(), alipayAccount: form.alipayAccount.trim() }
    await acceptApplication(await submitApplication(input))
  } catch (failure) {
    if (failure instanceof ApiError && (failure.status === 0 || failure.status >= 500)) {
      uncertain.value = true
      try { if (await querySubmissionResult()) return } catch { /* 保留原键和所有材料，允许核对或重试。 */ }
      message.value = '暂时无法确认提交结果，材料已保留。可查询结果，或使用本次材料安全重试；修改材料将作为新提交。'
    } else showError(failure)
  } finally { submitting.value = false }
}

async function checkResult() {
  if (submitting.value) return
  submitting.value = true
  try { if (!(await querySubmissionResult())) message.value = '尚未查询到本次新申请，可稍后查询或保留当前材料重试。' }
  catch (failure) { showError(failure) }
  finally { submitting.value = false }
}

async function withdraw() {
  if (!selected.value || withdrawing.value) return
  withdrawing.value = true
  message.value = ''
  try {
    await withdrawApplication(selected.value.id)
    withdrawalDialog.value?.close()
    await load()
    notice.value = '申请已撤回，原材料与记录已保留。'
  } catch (failure) {
    showError(failure)
    if (failure instanceof ApiError && failure.status === 409) { withdrawalDialog.value?.close(); await load() }
    else if (failure instanceof ApiError && (failure.status === 0 || failure.status >= 500)) {
      try {
        const latest = await getApplication(selected.value.id)
        if (latest.status !== 'PENDING') {
          withdrawalDialog.value?.close()
          await load()
          notice.value = '已重新查询申请最新状态，请以服务端记录为准。'
        } else message.value = '已查询到申请仍待审核，可保留当前页面后重试撤回。'
      } catch { message.value = '暂时无法确认撤回结果，请重新读取申请后核对。' }
    }
  } finally { withdrawing.value = false }
}

watch(() => route.query.applicationId, () => { if (!editing.value) void load() })
onMounted(() => { void load(); window.addEventListener('creator-certification-updated', refreshState); window.addEventListener('focus', refreshState) })
onBeforeUnmount(() => { disposed = true; loadRevision++; window.removeEventListener('creator-certification-updated', refreshState); window.removeEventListener('focus', refreshState) })
</script>

<template>
  <AccountLayout title="创作者入驻">
    <p
      v-if="loading && !editing"
      class="account-loading"
      role="status"
    >
      正在读取入驻资料…
    </p>
    <div
      v-else-if="loadError && !editing"
      class="account-load-error"
    >
      <p
        class="form-alert"
        role="alert"
      >
        {{ loadError }}
      </p><button
        class="button-secondary"
        @click="load"
      >
        重新读取
      </button>
    </div>
    <template v-else>
      <p
        v-if="notice"
        class="success-note"
        role="status"
      >
        {{ notice }}
      </p>
      <section
        v-if="!editing"
        class="certification-overview"
      >
        <div>
          <h2>认证状态</h2>
          <p v-if="auth.session?.roles.includes('ADMIN')">
            管理员可从后台审核入驻材料。
          </p>
          <p v-else-if="certificationStatus === 'APPROVED'">
            姓名及收款资料仅供查看，可在页首切换为创作者身份。
          </p>
          <p v-else-if="certificationStatus === 'PENDING'">
            申请已提交，可查看材料和审核进度。
          </p>
          <p v-else>
            请准备 3—5 件原创作品的成品图、制作过程图和收款资料。审核材料仅本人及有权审核的管理员可见。
          </p>
        </div>
        <span
          class="status-pill"
          :data-status="certificationStatus"
        >{{ applicationStatusLabels[certificationStatus] }}</span>
        <button
          v-if="mayApply"
          class="button-primary"
          @click="startApplication"
        >
          {{ selected && ['REJECTED', 'WITHDRAWN'].includes(selected.status) ? '补正并重新申请' : '开始申请' }}
        </button>
      </section>
      <form
        v-if="editing"
        class="creator-form"
        novalidate
        autocomplete="off"
        :aria-busy="submitting || uploads > 0"
        @submit.prevent="submit"
      >
        <section
          class="certification-form-section"
          aria-labelledby="application-info-title"
        >
          <h2 id="application-info-title">
            申请资料
          </h2>
          <div class="form-columns">
            <AccountField
              v-model="form.realName"
              label="申请人姓名"
              hint="2—20 字，与收款人姓名一致"
              :error="errors.realName"
              :disabled="submitting"
            /><AccountField
              v-model="form.contactPhone"
              label="联系电话"
              inputmode="tel"
              :error="errors.contactPhone"
              :disabled="submitting"
            />
          </div>
          <AddressRegion
            v-model:province="form.province"
            v-model:city="form.city"
            v-model:district="form.district"
            :errors="errors"
            :disabled="submitting"
          />
          <fieldset
            class="category-picker"
            :disabled="submitting"
          >
            <legend>一级主品类 · 选择 1—3 个</legend><div>
              <label
                v-for="category in primaryCategories"
                :key="category.id"
                class="category-choice"
              ><input
                v-model="form.categoryIds"
                type="checkbox"
                :value="category.id"
                :disabled="!form.categoryIds.includes(category.id) && form.categoryIds.length >= 3"
              >{{ category.name }}</label>
            </div><p
              v-if="!primaryCategories.length"
              class="field-help"
            >
              暂时没有可选择的品类，请联系平台或稍后重试。
            </p><p
              v-if="errors.categoryIds"
              class="field-error"
            >
              {{ errors.categoryIds }}
            </p>
          </fieldset>
          <AccountField
            v-model="years"
            label="从业年限"
            hint="0—70 年，请填写整数"
            :error="errors.experienceYears"
            :disabled="submitting"
          />
          <AccountField
            v-model="form.introduction"
            label="手艺与个人介绍"
            multiline
            :hint="`${Array.from(form.introduction).length} / 50—500 字，分享你的手艺经历和创作方向`"
            :error="errors.introduction"
            :disabled="submitting"
          />
        </section>
        <section
          class="certification-form-section"
          aria-labelledby="application-work-title"
        >
          <h2 id="application-work-title">
            原创作品
          </h2>
          <p class="field-help">
            3—5 件，每件至少一张成品图和一张过程图。支持 JPEG / PNG / WebP，单张不超过 5 MiB。
          </p>
          <fieldset
            v-for="(work, index) in form.originalWorks"
            :key="index"
            class="work-editor"
          >
            <legend>原创作品 {{ String(index + 1).padStart(2, '0') }}</legend><ApplicationImagePicker
              v-model="work.finishedImageIds"
              :label="`作品${index + 1}成品图`"
              :disabled="submitting || uploads > 0"
              :error="errors[`originalWorks[${index}].finishedImageIds`]"
              @busy="uploads += $event ? 1 : -1"
            /><ApplicationImagePicker
              v-model="work.processImageIds"
              :label="`作品${index + 1}过程图`"
              :disabled="submitting || uploads > 0"
              :error="errors[`originalWorks[${index}].processImageIds`]"
              @busy="uploads += $event ? 1 : -1"
            /><button
              v-if="form.originalWorks.length > 3"
              class="inline-button delete-button"
              type="button"
              :disabled="submitting || uploads > 0"
              @click="form.originalWorks.splice(index, 1)"
            >
              移除此件作品
            </button>
          </fieldset>
          <button
            v-if="form.originalWorks.length < 5"
            class="button-secondary add-work"
            type="button"
            :disabled="submitting || uploads > 0"
            @click="form.originalWorks.push({ finishedImageIds: [], processImageIds: [] })"
          >
            ＋ 添加一件原创作品（{{ form.originalWorks.length }} / 5）
          </button>
          <p
            v-if="errors.originalWorks"
            class="field-error"
          >
            {{ errors.originalWorks }}
          </p>
        </section>
        <section
          class="certification-form-section"
          aria-labelledby="application-payment-title"
        >
          <h2 id="application-payment-title">
            收款资料
          </h2>
          <p class="privacy-note">
            管理员会核对真实支付宝资料。认证通过后，姓名及收款账户只读。平台以模拟方式记录结算。
          </p>
          <div class="form-columns">
            <AccountField
              v-model="form.alipayAccount"
              label="支付宝账号"
              hint="支付宝绑定的手机号或邮箱"
              :error="errors.alipayAccount"
              :disabled="submitting"
            />
            <AccountField
              v-model="form.payeeName"
              label="收款人姓名"
              hint="须与申请人姓名完全一致"
              :error="errors.payeeName"
              :disabled="submitting"
            />
          </div>
          <AccountField
            v-model="form.supportingDescription"
            label="补充证明说明（选填）"
            multiline
            hint="可说明从业或原创情况，无需身份证号及证件照片"
            :error="errors.supportingDescription"
            :disabled="submitting"
          />
        </section>
        <p
          v-if="message"
          class="form-alert"
          role="alert"
        >
          {{ message }}
        </p>
        <div class="account-form-footer">
          <button
            class="button-primary"
            :disabled="submitting || uploads > 0"
          >
            {{ submitting ? '正在提交…' : '提交入驻申请' }}
          </button><button
            v-if="uncertain"
            class="button-secondary"
            type="button"
            :disabled="submitting"
            @click="checkResult"
          >
            查询提交结果
          </button><button
            class="inline-button"
            type="button"
            :disabled="submitting || uploads > 0"
            @click="editing = false"
          >
            取消填写
          </button>
        </div>
      </form>
      <template v-else>
        <section
          v-if="selected"
          class="current-application"
        >
          <h2>申请材料与结论</h2>
          <ApplicationMaterials :application="selected" />
          <button
            v-if="isCurrentPending"
            class="button-secondary"
            :disabled="withdrawing"
            @click="withdrawalDialog?.showModal()"
          >
            撤回申请
          </button>
        </section>
        <p
          v-if="message"
          class="form-alert"
          role="alert"
        >
          {{ message }}
        </p>
        <section class="application-history">
          <h2>历次申请</h2>
          <p
            v-if="!history.length"
            class="field-help"
          >
            暂无申请记录
          </p><button
            v-for="record in history"
            :key="record.id"
            class="history-row"
            :class="{ selected: selected?.id === record.id }"
            :aria-current="selected?.id === record.id ? 'true' : undefined"
            @click="viewHistory(record.id)"
          >
            <span>#{{ record.id }}<small>{{ formatTime(record.submittedAt) }}</small></span><span
              class="status-pill"
              :data-status="record.status"
            >{{ applicationStatusLabels[record.status] }}</span><span aria-hidden="true">↗</span>
          </button><div
            v-if="total > 20"
            class="pagination"
          >
            <button
              class="button-secondary"
              :disabled="page <= 1"
              @click="page--; load()"
            >
              上一页
            </button><span>第 {{ page }} 页 · 共 {{ total }} 条</span><button
              class="button-secondary"
              :disabled="page * 20 >= total"
              @click="page++; load()"
            >
              下一页
            </button>
          </div>
        </section>
      </template>
    </template>
    <dialog
      ref="withdrawalDialog"
      class="delete-dialog"
      aria-labelledby="withdraw-title"
      @cancel="withdrawing && $event.preventDefault()"
    >
      <h2 id="withdraw-title">
        确认撤回这次申请？
      </h2><p>撤回后停止本次审核，材料和历史记录仍会保留。你可以补正后重新提交。</p><p
        v-if="message"
        class="field-error"
        role="alert"
      >
        {{ message }}
      </p><div>
        <button
          class="button-secondary"
          :disabled="withdrawing"
          @click="withdrawalDialog?.close()"
        >
          取消
        </button><button
          class="button-primary"
          :disabled="withdrawing"
          @click="withdraw"
        >
          {{ withdrawing ? '正在撤回…' : '确认撤回' }}
        </button>
      </div>
    </dialog>
  </AccountLayout>
</template>
