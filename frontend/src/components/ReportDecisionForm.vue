<script setup lang="ts" generic="Decision extends string">
import { computed, ref } from 'vue'
import { ApiError } from '@/utils/request'

const props = defineProps<{
  actions: Decision[]
  labels: Record<Decision, string>
  submitDecision: (decision: Decision, reason: string, expectedHistoryId: string, recovery?: string) => Promise<void>
  verifyDecision: (decision: Decision, reason: string, previousId: string | undefined, recovery?: string) => Promise<boolean>
  lastHistoryId?: string
}>()
const reason = ref('')
const recovery = ref('')
const busy = ref(false)
const error = ref('')
const unknown = ref<{ decision: Decision; previousId?: string }>()
const needsRecovery = computed(() => props.actions.includes('PAUSE' as Decision))

async function decide(decision: Decision) {
  if (busy.value || unknown.value || !reason.value.trim()) return
  const previousId = props.lastHistoryId
  busy.value = true
  error.value = ''
  try {
    await props.submitDecision(decision, reason.value.trim(), previousId ?? '0', decision === 'PAUSE' ? recovery.value.trim() : undefined)
    reason.value = ''; recovery.value = ''
  } catch (failure) {
    if (failure instanceof ApiError && failure.status === 0) unknown.value = { decision, previousId }
    error.value = unknown.value ? '处置结果未知，请先核对处置历史。' : failure instanceof Error ? failure.message : '处置失败'
  } finally { busy.value = false }
}

async function verify() {
  if (!unknown.value || busy.value) return
  busy.value = true
  try {
    const decision = unknown.value.decision
    const recoveryCondition = decision === 'PAUSE' ? recovery.value.trim() : undefined
    if (await props.verifyDecision(decision, reason.value.trim(), unknown.value.previousId, recoveryCondition)) {
      reason.value = ''; recovery.value = ''; error.value = ''
    } else error.value = '尚未查到本次处置，已保留输入，可在核对后重试。'
    unknown.value = undefined
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '核对失败' }
  finally { busy.value = false }
}
</script>

<template>
  <section
    v-if="actions.length || unknown"
    class="report-decision"
    aria-label="处置举报"
  >
    <label>处理依据<textarea
      v-model="reason"
      maxlength="500"
      :disabled="busy || !!unknown"
    /></label>
    <label v-if="needsRecovery">恢复条件<textarea
      v-model="recovery"
      maxlength="1000"
      :disabled="busy || !!unknown"
    /></label>
    <p
      v-if="error"
      class="field-error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="report-decision-actions">
      <button
        v-for="action in actions"
        :key="action"
        type="button"
        :class="action === 'NOT_UPHELD' ? 'button-secondary' : 'button-primary'"
        :disabled="busy || !!unknown || !reason.trim() || (action === 'PAUSE' && !recovery.trim())"
        @click="decide(action)"
      >
        {{ labels[action] }}
      </button>
      <button
        v-if="unknown"
        type="button"
        class="button-secondary"
        :disabled="busy"
        @click="verify"
      >
        核对处置
      </button>
    </div>
  </section>
</template>

<style scoped>
.report-decision { display: grid; gap: 12px; padding-top: 16px; border-top: 1px solid var(--craft-border); }
.report-decision label { display: grid; gap: 6px; font-size: 13px; font-weight: 600; }
.report-decision textarea { min-height: 74px; padding: 9px 11px; resize: vertical; font: inherit; }
.report-decision-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
