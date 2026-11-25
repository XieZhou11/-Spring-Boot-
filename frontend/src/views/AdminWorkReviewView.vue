<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import WorkMaterials from '@/components/WorkMaterials.vue'
import WorkHistory from '@/components/WorkHistory.vue'
import { getManagedWork, offlineWork, reviewWork } from '@/api/work'
import type { WorkVO } from '@/types/work'
import { workStatusLabels } from '@/utils/work'
import { formatTime } from '@/utils/creator'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/work.css'
const emit = defineEmits<{ reviewed: [] }>()
const route = useRoute()
const auth = useAuthStore()
const work = ref<WorkVO>()
const reason = ref('')
const error = ref('')
const notice = ref('')
const busy = ref(false)
const loading = ref(true)
let revision = 0
async function load() {
  const current = ++revision; loading.value = true; error.value = ''; work.value = undefined
  try { const result = await getManagedWork(String(route.params.id), true); if (current === revision) work.value = result }
  catch (failure) { if (current === revision) { work.value = undefined; error.value = failure instanceof Error ? failure.message : '材料读取失败' } }
  finally { if (current === revision) loading.value = false }
}
/** 审核携带材料版本；冲突或未知响应先核验，不自动重放旧结论。 */
async function decide(decision: 'APPROVED' | 'REJECTED' | 'OFFLINE') {
  if (!work.value || busy.value || loading.value) return
  if (decision !== 'APPROVED' && !reason.value.trim()) { error.value = '驳回或下架必须填写原因'; return }
  if (!window.confirm(decision === 'APPROVED' ? '确认通过该作品并公开上架？' : decision === 'REJECTED' ? '确认驳回并发送审核意见？' : '确认下架并通知创作者？')) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    work.value = decision === 'OFFLINE' ? await offlineWork(work.value.id, work.value.version, true, reason.value) : await reviewWork(work.value.id, work.value.version, decision, reason.value)
    reason.value = ''; notice.value = decision === 'APPROVED' ? '审核通过，作品已上架' : decision === 'REJECTED' ? '已驳回并通知创作者' : '作品已下架并通知创作者'
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : '操作结果未知'
    await load(); error.value = `${message}。已重新核验，请以当前状态为准。`
  } finally { busy.value = false; emit('reviewed') }
}
/** 审核中阻止切换对象；会话已撤销时立即离开，避免草稿确认拦住退出。 */
function canLeave() { return !auth.session || (!busy.value && (!reason.value.trim() || window.confirm('审核意见尚未提交，确定离开？'))) }
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(canLeave)
watch(() => route.params.id, () => void load(), { immediate: true })
onBeforeUnmount(() => revision++)
</script>
<template>
  <div>
    <header class="review-detail-heading">
      <h2>当前审核对象</h2><RouterLink :to="{ path: '/admin/works', query: route.query }">返回队列</RouterLink>
    </header><p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }} <button
        class="inline-button"
        @click="load"
      >
        重新读取
      </button>
    </p><p
      v-if="notice"
      class="form-success"
      role="status"
    >
      {{ notice }}
    </p><template v-if="work">
      <div class="admin-work-meta">
        <span
          class="work-status"
          :class="work.reviewStatus"
        >{{ workStatusLabels[work.reviewStatus] }}</span><span>作品编号 {{ work.id }}</span><span>提交于 {{ formatTime(work.submittedAt) }}</span>
        <span v-if="work.sourceOrderId">定制案例 · 来源订单 {{ work.sourceOrderId }}</span>
      </div><div
        class="review-material-scroll"
        role="region"
        aria-label="作品审核材料"
        tabindex="0"
      >
        <WorkMaterials
          :key="`${work.id}-${work.version}`"
          :work="work"
        />
      </div><section
        v-if="work.reviewStatus === 'PENDING' || work.reviewStatus === 'ONLINE'"
        class="work-review-panel"
      >
        <div>
          <h2>{{ work.reviewStatus === 'PENDING' ? '审核结论' : '下架管理' }}</h2>
        </div><label class="work-field">审核意见<textarea
          v-model="reason"
          rows="4"
          maxlength="500"
          :disabled="busy || loading"
          placeholder="请填写具体原因（驳回、下架必填）"
        /></label><div class="review-actions">
          <template v-if="work.reviewStatus === 'PENDING'">
            <button
              class="button-secondary"
              :disabled="busy || loading"
              @click="decide('REJECTED')"
            >
              驳回作品
            </button><button
              class="button-primary"
              :disabled="busy || loading"
              @click="decide('APPROVED')"
            >
              审核通过并上架
            </button>
          </template><button
            v-else
            class="button-secondary"
            :disabled="busy || loading"
            @click="decide('OFFLINE')"
          >
            下架作品
          </button>
        </div>
      </section><p
        v-else-if="work.reviewReason"
        class="review-reason"
      >
        处理意见：{{ work.reviewReason }}
      </p><WorkHistory
        :work-id="work.id"
        :revision="work.version"
        admin
      />
    </template><p
      v-else-if="!error"
      class="account-loading"
    >
      正在读取作品材料…
    </p>
  </div>
</template>
