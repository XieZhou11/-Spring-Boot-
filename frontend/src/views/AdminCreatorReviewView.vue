<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import ApplicationMaterials from '@/components/ApplicationMaterials.vue'
import AccountField from '@/components/AccountField.vue'
import { getApplication, reviewApplication } from '@/api/creator'
import type { ApplicationVO } from '@/types/creator'
import { useAuthForm } from '@/composables/useAuthForm'
import { ApiError } from '@/utils/request'

const route = useRoute()
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
  } catch (failure) { loadError.value = failure instanceof Error ? failure.message : '申请读取失败' }
  finally { if (current === revision) loading.value = false }
}

async function prepareReview(value: 'APPROVED' | 'REJECTED') {
  if (submitting.value) return
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
  } finally { submitting.value = false }
}
watch(() => route.params.id, () => void load())
onMounted(() => void load())
</script>

<template>
  <AdminLayout
    title="入驻材料审核"
    subtitle="核对完整性、原创过程及收款人一致性，结论将保留在历史记录中。"
  >
    <div class="detail-toolbar">
      <RouterLink
        class="text-link"
        to="/admin/creator-applications"
      >← 返回审核队列</RouterLink><button
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
      </p><ApplicationMaterials
        :application="application"
        :previous="previous"
      />
      <section
        v-if="application.status === 'PENDING'"
        class="review-editor"
      >
        <div class="section-caption">
          <span>审核结论</span><small>ONE REVIEW, A CLEAR DECISION</small>
        </div><ul class="review-checklist">
          <li>3—5 件作品，成品及制作过程完整，能说明原创手艺。</li><li>主品类与作品对应，介绍和材料符合平台规则。</li><li>真实支付宝资料，收款人姓名与申请人一致。</li>
        </ul><AccountField
          v-model="reason"
          label="审核意见"
          multiline
          hint="驳回必填：请明确说明原因及需补正的材料；通过可补充核对意见。"
          :error="errors.reason"
          :disabled="submitting"
        /><p class="privacy-note">
          此审核为平台资格及材料人工核对，不宣称完成权威实名认证或实际打款验证。
        </p><div class="review-actions">
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
      <p class="eyebrow">
        CONFIRM YOUR REVIEW
      </p><h2 id="review-confirm-title">
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
  </AdminLayout>
</template>
