<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import ApplicationMaterials from '@/components/ApplicationMaterials.vue'
import AccountField from '@/components/AccountField.vue'
import { getApplication, reviewApplication } from '@/api/creator'
import type { ApplicationVO } from '@/types/creator'
import { useAuthForm } from '@/composables/useAuthForm'
import { ApiError } from '@/utils/request'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{ reviewed: [] }>()
const route = useRoute()
const auth = useAuthStore()
const application = ref<ApplicationVO | null>(null)
const previous = ref<ApplicationVO | null>(null)
const loading = ref(true)
const loadError = ref('')
const comparisonError = ref('')
const reason = ref('')
const decision = ref<'APPROVED' | 'REJECTED'>('APPROVED')
const confirmation = ref<HTMLDialogElement>()
const notice = ref('')
const { errors, message, submitting, validate, showError } = useAuthForm()
let revision = 0

async function load() {
  const current = ++revision
  loading.value = true
  loadError.value = ''
  comparisonError.value = ''
  previous.value = null
  application.value = null
  try {
    const result = await getApplication(String(route.params.id), true)
    if (current !== revision) return
    application.value = result
    if (result.previousApplicationId) {
      try {
        const previousResult = await getApplication(result.previousApplicationId, true)
        if (current === revision) previous.value = previousResult
      }
      catch (failure) { if (current === revision) comparisonError.value = failure instanceof Error ? failure.message : '上次材料读取失败，请重新读取后审核' }
    }
  } catch (failure) { if (current === revision) loadError.value = failure instanceof Error ? failure.message : '申请读取失败' }
  finally { if (current === revision) loading.value = false }
}

async function prepareReview(value: 'APPROVED' | 'REJECTED') {
  if (submitting.value || loading.value || !application.value) return
  if (!(await validate({ reason: value === 'REJECTED' && !reason.value.trim() ? '驳回时请说明具体原因及需补正的材料' : '' }))) return
  decision.value = value
  confirmation.value?.showModal()
}

/** 审核响应未知时查询权威结论，冲突或他人抢先处理后禁止继续使用旧状态。 */
async function review() {
  if (!application.value || submitting.value) return
  submitting.value = true
  message.value = ''
  try {
    application.value = await reviewApplication(application.value.id, decision.value, reason.value.trim())
    confirmation.value?.close()
    reason.value = ''
    notice.value = '审核结论已保存，系统通知已生成。'
  } catch (failure) {
    showError(failure)
    if (failure instanceof ApiError && (failure.status === 409 || failure.status === 0 || failure.status >= 500)) {
      try {
        const latest = await getApplication(application.value.id, true)
        application.value = latest
        if (latest.status !== 'PENDING') {
          confirmation.value?.close()
          notice.value = '已重新查询最新结论，请以下方服务端记录为准。'
        } else message.value = '尚未保存审核结论，可保留当前意见后重试。'
      } catch { message.value = '暂时无法确认审核结果，请重新读取材料后核对。' }
    }
  } finally { submitting.value = false; emit('reviewed') }
}
/** 阻止提交中换材料；会话已撤销时立即离开，避免草稿确认拦住退出。 */
function canLeave() { return !auth.session || (!submitting.value && (!reason.value.trim() || window.confirm('审核意见尚未提交，确定离开？'))) }
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(canLeave)
watch(() => route.params.id, () => void load(), { immediate: true })
onBeforeUnmount(() => revision++)
</script>

<template>
  <div>
    <header class="review-detail-heading">
      <h2>当前审核对象</h2><RouterLink :to="{ path: '/admin/creator-applications', query: route.query }">返回队列</RouterLink>
    </header>
    <div class="detail-toolbar">
      <button
        class="button-secondary"
        :disabled="loading || submitting"
        @click="load"
      >
        重新读取材料
      </button>
    </div>
    <p
      v-if="loading"
      class="account-loading"
      role="status"
    >
      正在读取申请材料…
    </p><p
      v-else-if="loadError"
      class="form-alert"
      role="alert"
    >
      {{ loadError }}
    </p>
    <template v-else-if="application">
      <p
        v-if="notice"
        class="success-note"
        role="status"
      >
        ✓ {{ notice }}
      </p><p
        v-if="comparisonError"
        class="form-alert"
        role="alert"
      >
        无法比较上次材料：{{ comparisonError }}
      </p><div
        class="review-material-scroll"
        role="region"
        aria-label="入驻审核材料"
        tabindex="0"
      >
        <ApplicationMaterials
          :application="application"
          :previous="previous"
        />
      </div>
      <section
        v-if="application.status === 'PENDING'"
        class="review-editor"
      >
        <div class="section-caption">
          <span>审核结论</span>
        </div><AccountField
          v-model="reason"
          label="审核意见"
          multiline
          hint="驳回必填：请明确说明原因及需补正的材料；通过可补充核对意见。"
          :error="errors.reason"
          :disabled="submitting"
        /><div class="review-actions">
          <button
            class="button-secondary reject-review"
            :disabled="submitting || !!comparisonError"
            @click="prepareReview('REJECTED')"
          >
            驳回并说明原因
          </button><button
            class="button-primary"
            :disabled="submitting || !!comparisonError"
            @click="prepareReview('APPROVED')"
          >
            通过入驻审核 ↗
          </button>
        </div>
      </section>
      <p
        v-else
        class="privacy-note"
      >
        该申请已有最终结论，材料和收款资料仅供查看。
      </p><p
        v-if="message"
        class="form-alert"
        role="alert"
      >
        {{ message }}
      </p>
    </template>
    <dialog
      ref="confirmation"
      class="delete-dialog"
      aria-labelledby="review-confirm-title"
      @cancel="submitting && $event.preventDefault()"
    >
      <h2 id="review-confirm-title">
        {{ decision === 'APPROVED' ? '确认通过这份申请？' : '确认驳回这份申请？' }}
      </h2><p>{{ decision === 'APPROVED' ? '通过后账号取得创作者资格，姓名与收款账户只读，并通知申请人。' : '将保留本次结论并通知申请人补正，历史材料不会覆盖。' }}</p><p
        v-if="reason"
        class="review-confirm-reason"
      >
        {{ reason }}
      </p><p
        v-if="message"
        class="field-error"
        role="alert"
      >
        {{ message }}
      </p><div>
        <button
          class="button-secondary"
          :disabled="submitting"
          @click="confirmation?.close()"
        >
          取消
        </button><button
          class="button-primary"
          :disabled="submitting"
          @click="review"
        >
          {{ submitting ? '正在保存…' : '确认审核' }}
        </button>
      </div>
    </dialog>
  </div>
</template>
