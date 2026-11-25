<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import QuoteImages from '@/components/QuoteImages.vue'
import { decideRefund, getAdminRefund, getAdminRefundMessages, getRefundEvidence } from '@/api/refund'
import type { AdminRefundDetailVO, RefundDecisionDTO, RefundEvidenceVO } from '@/types/refund'
import type { ChatMessageVO } from '@/types/customRequest'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { ApiError } from '@/utils/request'
import { clearRefundState, clearUserRefundState, readRefundDecision, refundReasons, refundStatuses, sameRefundDecision, saveRefundState } from '@/utils/refund'
import { formatTime } from '@/utils/creator'
import { orderStatus, progressNodeName, settlementStatus } from '@/utils/quote'

const emit = defineEmits<{ reviewed: [] }>()
const route = useRoute(); const auth = useAuthStore(); const notifications = useNotificationsStore()
const detail = ref<AdminRefundDetailVO>(); const evidence = ref<RefundEvidenceVO[]>([]); const messages = ref<ChatMessageVO[]>([])
const evidenceCursor = ref<string | null>(null); const moreEvidenceAvailable = ref(false); const moreMessagesAvailable = ref(false)
const loading = ref(false); const writing = ref(false); const error = ref(''); const notice = ref(''); const attempt = ref<RefundDecisionDTO>(); const checked = ref(false); const recoveryConflict = ref(false)
const input = ref<RefundDecisionDTO>({ expectedVersion: 0, decision: 'REJECT', reason: '', returnRequired: false, returnedConfirmed: false, returnTrackingNo: '', returnEvidenceImageIds: [], noReturnBasis: '' })
const stale = ref(false); const reviewed = ref(false); let revision = 0; let restoring = false
const id = () => typeof route.params.id === 'string' && /^[1-9]\d*$/.test(route.params.id) ? route.params.id : undefined
const context = () => ({ userId: auth.session?.userId, applicationId: id() })
const sameContext = (c: ReturnType<typeof context>) => !!c.userId && !!c.applicationId && c.userId === auth.session?.userId && c.applicationId === id() && !!auth.session?.roles.includes('ADMIN')
const frozen = computed(() => writing.value || !!attempt.value || !detail.value?.canDecide)
const availableReturnImages = computed(() => [...new Set([...(detail.value?.application.imageIds || []), ...evidence.value.flatMap(item => item.imageIds)])])
/** 草稿与待确认原裁定分开保存，通知/刷新只能更新材料，不能改写意见或偷偷升级版本。 */
watch(input, value => { const c = context(); if (!restoring && c.userId && c.applicationId) { try { saveRefundState(c.userId, c.applicationId, 'admin-draft', value) } catch { /* 写前强制保存失败将阻止HTTP。 */ } } }, { deep: true, flush: 'sync' })
function clearSensitive() {
  const c = context(); if (c.userId && c.applicationId) { clearRefundState(c.userId, c.applicationId, 'admin-attempt'); clearRefundState(c.userId, c.applicationId, 'admin-draft') }
  restoring = true; detail.value = undefined; evidence.value = []; messages.value = []; attempt.value = undefined; input.value = { expectedVersion: 0, decision: 'REJECT', reason: '', returnRequired: false, returnedConfirmed: false, returnTrackingNo: '', returnEvidenceImageIds: [], noReturnBasis: '' }; reviewed.value = false; restoring = false
  evidenceCursor.value = null
  moreEvidenceAvailable.value = false
  moreMessagesAvailable.value = false
  checked.value = false
  recoveryConflict.value = false
  stale.value = false
  notice.value = ''
}
/** 原申请或会话不可访问时撤下已显示材料，并清除本申请裁定输入。 */
function readFailed(failure: unknown, fallback: string) {
  if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) clearSensitive()
  error.value = failure instanceof Error ? failure.message : fallback
}
async function load() {
  const c = context(); if (!sameContext(c)) { clearSensitive(); return }
  if (writing.value) return
  const current = ++revision; loading.value = true; checked.value = false; recoveryConflict.value = false
  try {
    const result = await getAdminRefund(c.applicationId!)
    const [proof, chat] = await Promise.all([getRefundEvidence(c.applicationId!, {}, true), getAdminRefundMessages(c.applicationId!)])
    if (current !== revision || !sameContext(c)) return
    const initial = !detail.value; detail.value = result; evidence.value = proof.items; evidenceCursor.value = proof.nextCursor; moreEvidenceAvailable.value = proof.hasMore; messages.value = chat.items; moreMessagesAvailable.value = chat.hasMore
    if (initial && !input.value.reason && !attempt.value && !readRefundDecision(c.userId!, c.applicationId!, 'admin-draft')) input.value.expectedVersion = result.application.version
    stale.value = input.value.expectedVersion !== result.application.version
    if (stale.value) reviewed.value = false
    if (attempt.value) {
      if (sameRefundDecision(result, c.userId!, attempt.value)) {
        clearRefundState(c.userId!, c.applicationId!, 'admin-attempt'); clearRefundState(c.userId!, c.applicationId!, 'admin-draft'); attempt.value = undefined; error.value = ''; notice.value = '已精确核验原管理员及完整裁定参数，原裁定提交成功。'; emit('reviewed')
      } else { checked.value = true; recoveryConflict.value = result.application.status !== 'WAIT_ADMIN'; error.value = recoveryConflict.value ? '当前申请已有不同处理结论，不能将其视为本次裁定成功，也不能重放原裁定。请核对处理历史。' : '裁定结果尚未确认，原版本和全部参数已保留。已重新核验，可重试同一次裁定。' }
    }
  } catch (failure) {
    if (current !== revision || !sameContext(c)) return
    readFailed(failure, '查证材料读取失败')
  } finally { if (current === revision) loading.value = false }
}
async function moreEvidence() {
  const c = context(); if (!sameContext(c) || loading.value || writing.value || !moreEvidenceAvailable.value || !evidenceCursor.value) return
  const current = revision; loading.value = true
  try { const result = await getRefundEvidence(c.applicationId!, { cursor: evidenceCursor.value }, true); if (current === revision && sameContext(c)) { evidence.value = [...evidence.value, ...result.items.filter(item => !evidence.value.some(old => old.id === item.id))]; evidenceCursor.value = result.nextCursor; moreEvidenceAvailable.value = result.hasMore } }
  catch (failure) { if (current === revision && sameContext(c)) readFailed(failure, '证据读取失败') }
  finally { if (current === revision) loading.value = false }
}
async function moreMessages() {
  const c = context(); if (!sameContext(c) || loading.value || writing.value || !moreMessagesAvailable.value) return
  const before = messages.value.reduce<string | undefined>((min, item) => !min || BigInt(item.seqNo) < BigInt(min) ? item.seqNo : min, undefined)
  const current = revision; loading.value = true
  try { const result = await getAdminRefundMessages(c.applicationId!, { before }); if (current === revision && sameContext(c)) { messages.value = [...result.items.filter(item => !messages.value.some(old => old.id === item.id)), ...messages.value].sort((a, b) => BigInt(a.seqNo) < BigInt(b.seqNo) ? -1 : 1); moreMessagesAvailable.value = result.hasMore } }
  catch (failure) { if (current === revision && sameContext(c)) readFailed(failure, '聊天读取失败') }
  finally { if (current === revision) loading.value = false }
}
function acknowledge() { if (detail.value && !loading.value && !writing.value && !attempt.value) { input.value.expectedVersion = detail.value.application.version; stale.value = false; reviewed.value = true; error.value = '' } }
async function submit(retry = false) {
  const c = context(); if (!sameContext(c) || !detail.value || writing.value || loading.value) return
  if (attempt.value) { if (!retry || !checked.value || recoveryConflict.value) return }
  else if (retry || !detail.value.canDecide || stale.value || !reviewed.value) return
  const candidate: RefundDecisionDTO = attempt.value || { ...input.value, reason: input.value.reason.trim(), returnTrackingNo: input.value.returnTrackingNo.trim(), noReturnBasis: input.value.noReturnBasis.trim(), returnEvidenceImageIds: [...input.value.returnEvidenceImageIds] }
  // 只规范化新裁定的当前分支，未知重试保留已经发送的全部原事实。
  if (!attempt.value) {
    if (candidate.decision === 'REJECT' || !detail.value.order.shippedAt) { candidate.returnRequired = false; candidate.returnedConfirmed = false; candidate.returnTrackingNo = ''; candidate.returnEvidenceImageIds = []; candidate.noReturnBasis = '' }
    else if (candidate.returnRequired) candidate.noReturnBasis = ''
    else { candidate.returnedConfirmed = false; candidate.returnTrackingNo = ''; candidate.returnEvidenceImageIds = [] }
  }
  error.value = ''
  if (!candidate.reason || candidate.reason.length > 500) { error.value = '裁定原因需1—500字。'; return }
  const shipped = !!detail.value.order.shippedAt
  if (candidate.decision === 'APPROVE' && shipped) {
    if (candidate.returnRequired && (!candidate.returnedConfirmed || (!/^[A-Za-z0-9]{8,30}$/.test(candidate.returnTrackingNo) && !candidate.returnEvidenceImageIds.length))) { error.value = '需退货时，必须确认原成品已退回，并提供合法退回单号或选择当前申请已保存的凭证。'; return }
    if (!candidate.returnRequired && !candidate.noReturnBasis) { error.value = '无需退货时请填写核查依据。'; return }
  }
  if (!retry && !window.confirm(`确认裁定订单 ${detail.value.order.orderNo}、申请 ${c.applicationId}：${candidate.decision === 'APPROVE' ? `全额退款 ¥ ${detail.value.application.refundAmount}，取消待结算并终止履约` : '驳回申请并恢复原履约状态'}？`)) return
  try { saveRefundState(c.userId!, c.applicationId!, 'admin-attempt', candidate) }
  catch { error.value = '浏览器存储暂时不可用，本次裁定未提交。原意见和核验输入保留，请允许存储后重试。'; return }
  attempt.value = candidate; input.value = { ...candidate, returnEvidenceImageIds: [...candidate.returnEvidenceImageIds] }; const current = ++revision; writing.value = true; checked.value = false; loading.value = false; notice.value = ''
  try {
    const result = await decideRefund(c.applicationId!, candidate)
    if (current !== revision || !sameContext(c)) return
    detail.value = result; attempt.value = undefined; clearRefundState(c.userId!, c.applicationId!, 'admin-attempt'); clearRefundState(c.userId!, c.applicationId!, 'admin-draft'); notice.value = candidate.decision === 'APPROVE' ? '全额退款裁定已执行，原支付和履约证据保留。' : '已驳回退款申请，原履约状态恢复。'; emit('reviewed')
  } catch (failure) {
    if (current !== revision || !sameContext(c)) return
    const unknown = !(failure instanceof ApiError) || !failure.status || failure.status >= 500
    if (!unknown) { attempt.value = undefined; clearRefundState(c.userId!, c.applicationId!, 'admin-attempt'); reviewed.value = false; if (failure.status === 409) stale.value = true; if ([401, 403, 404].includes(failure.status)) clearSensitive() }
    error.value = unknown ? '裁定结果尚未确认，请刷新材料核验；只能以原版本和全部原始参数重试。' : `${failure.message}。意见已保留，请重新查阅材料并确认。`
  } finally { if (sameContext(c)) { writing.value = false; void load() } }
}
function refresh() { void load() }
function visible() { if (document.visibilityState === 'visible') refresh() }
onBeforeRouteLeave(() => !auth.session || !writing.value); onBeforeRouteUpdate(() => !auth.session || !writing.value)
watch([() => route.params.id, () => auth.session?.userId, () => auth.session?.roles.includes('ADMIN')], () => {
  if (!auth.session?.roles.includes('ADMIN')) { revision++; clearUserRefundState(auth.session?.userId); clearSensitive(); loading.value = false; writing.value = false; return }
  revision++; detail.value = undefined; evidence.value = []; messages.value = []; error.value = ''; notice.value = ''; reviewed.value = false; stale.value = false; writing.value = false
  const c = context(); restoring = true
  attempt.value = c.userId && c.applicationId ? readRefundDecision(c.userId, c.applicationId, 'admin-attempt') : undefined
  input.value = attempt.value || (c.userId && c.applicationId ? readRefundDecision(c.userId, c.applicationId, 'admin-draft') : undefined) || { expectedVersion: 0, decision: 'REJECT', reason: '', returnRequired: false, returnedConfirmed: false, returnTrackingNo: '', returnEvidenceImageIds: [], noReturnBasis: '' }
  restoring = false; void load()
}, { immediate: true })
watch(() => notifications.connected, (value, old) => { if (value && !old) refresh() })
onMounted(() => { window.addEventListener('order-updated', refresh); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible) })
onBeforeUnmount(() => { revision++; window.removeEventListener('order-updated', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) })
</script>
<template>
  <div
    class="admin-refund-detail"
    :aria-busy="loading || writing"
  >
    <header class="review-detail-heading">
      <h2>查证与裁定</h2>
      <div class="refund-actions">
        <button
          type="button"
          class="inline-button"
          :disabled="loading || writing"
          @click="load"
        >
          刷新查证材料
        </button><RouterLink :to="{ path: '/admin/refunds', query: route.query }">返回队列</RouterLink>
      </div>
    </header>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }} <button
        v-if="attempt"
        type="button"
        class="inline-button"
        :disabled="writing || loading || !checked || recoveryConflict"
        @click="submit(true)"
      >
        重试原裁定
      </button>
    </p><p
      v-if="notice"
      class="form-success"
      role="status"
    >
      {{ notice }}
    </p><p
      v-if="loading && !detail"
      role="status"
    >
      正在读取订单与售后证据…
    </p>
    <template v-if="detail">
      <header class="refund-summary">
        <div class="refund-summary-heading">
          <h3>{{ detail.order.title }}</h3><span
            class="work-status refund-status"
            :data-status="detail.application.status"
          >{{ refundStatuses[detail.application.status] }}</span>
        </div>
        <p class="refund-summary-ids">
          订单 {{ detail.order.orderNo }} · 申请 {{ detail.application.id }} · 材料版本 {{ detail.application.version }}
        </p>
        <dl class="refund-summary-facts">
          <div>
            <dt>全额退款金额</dt>
            <dd class="refund-amount">
              ¥ {{ detail.application.refundAmount }}
            </dd>
          </div>
          <div>
            <dt>买家 / 创作者</dt>
            <dd>{{ detail.order.buyerNickname }} / {{ detail.order.creatorNickname }}</dd>
          </div>
          <div><dt>原订单状态</dt><dd>{{ orderStatus[detail.application.originalOrderStatus] }}</dd></div>
          <div><dt>当前订单状态</dt><dd>{{ orderStatus[detail.order.status] }}</dd></div>
        </dl>
      </header>
      <section
        class="refund-detail-section"
        aria-label="售后初始申请"
      >
        <h3>初始申请 · {{ detail.application.applicationType === 'NORMAL' ? refundReasons[detail.application.reasonCode] || detail.application.reasonCode : '系统无责退款' }}</h3><time>{{ formatTime(detail.application.createdAt) }}</time><p class="request-description">
          {{ detail.application.description }}
        </p><QuoteImages
          :image-ids="detail.application.imageIds"
          :admin-application-id="detail.application.id"
          scope="refund"
          label="初始售后凭证"
        />
      </section>
      <section
        class="refund-detail-section"
        aria-label="双方补证"
      >
        <h3>双方补证</h3><ol class="order-timeline refund-evidence">
          <li
            v-for="item in evidence"
            :key="item.id"
          >
            <strong>{{ item.submitterId === detail.order.buyerId ? '买家' : '创作者' }}追加证据</strong><time>{{ formatTime(item.createdAt) }}</time><p class="request-description">
              {{ item.content }}
            </p><QuoteImages
              :image-ids="item.imageIds"
              :admin-application-id="detail.application.id"
              scope="refund"
              label="补充售后凭证"
            />
          </li>
        </ol><p
          v-if="!evidence.length"
          class="field-help"
        >
          当前无补充证据
        </p><button
          v-if="moreEvidenceAvailable"
          class="inline-button"
          :disabled="loading || writing"
          @click="moreEvidence"
        >
          继续读取证据
        </button>
      </section>
      <details
        class="refund-detail-section"
        open
      >
        <summary>订单约定与付款</summary><h3>{{ detail.order.agreementSnapshot.request.title }}</h3><p class="request-description">
          {{ detail.order.agreementSnapshot.request.description }}
        </p><p>{{ detail.order.agreementSnapshot.request.materialPreference }} · {{ detail.order.agreementSnapshot.request.specification }}</p><QuoteImages
          :image-ids="detail.order.agreementSnapshot.request.referenceImageIds"
          :admin-application-id="detail.application.id"
          scope="request"
          label="原需求参考图"
        /><p class="request-description">
          {{ detail.order.agreementSnapshot.proposal }}
        </p><p class="request-description">
          {{ detail.order.agreementSnapshot.additionalAgreement }}
        </p><QuoteImages
          :image-ids="detail.order.agreementSnapshot.imageIds"
          :admin-application-id="detail.application.id"
          label="原方案图片"
        /><dl class="work-specifications">
          <div><dt>原成交金额</dt><dd>¥ {{ detail.order.totalAmount }}</dd></div><div v-if="detail.order.payment">
            <dt>成功实付</dt><dd>¥ {{ detail.order.payment.amount }} · {{ detail.order.payment.flowNo }}<br>{{ formatTime(detail.order.payment.occurredAt) }}</dd>
          </div><div v-if="detail.order.settlement">
            <dt>应结算</dt><dd>¥ {{ detail.order.settlement.paidAmount }} · {{ settlementStatus[detail.order.settlement.status] || detail.order.settlement.status }}</dd>
          </div>
        </dl>
      </details>
      <details class="refund-detail-section">
        <summary>发货、收货与必要地址</summary><dl class="work-specifications">
          <div><dt>运单号</dt><dd>{{ detail.order.trackingNo || '尚未发货' }}</dd></div><div v-if="detail.order.shippedAt">
            <dt>原发货时间</dt><dd>{{ formatTime(detail.order.shippedAt) }}</dd>
          </div><div v-if="detail.order.autoConfirmAt">
            <dt>自动收货时间</dt><dd>{{ formatTime(detail.order.autoConfirmAt) }}（售后中暂停）</dd>
          </div><div v-if="detail.order.originalCompletedAt">
            <dt>最初完成时间</dt><dd>{{ formatTime(detail.order.originalCompletedAt) }}</dd>
          </div>
        </dl><address v-if="detail.order.addressSnapshot">
          {{ detail.order.addressSnapshot.recipientName }} · {{ detail.order.addressSnapshot.phone }}<br>{{ detail.order.addressSnapshot.province }} {{ detail.order.addressSnapshot.city }} {{ detail.order.addressSnapshot.district }} {{ detail.order.addressSnapshot.detailAddress }}
        </address>
      </details>
      <details class="refund-detail-section">
        <summary>制作节点与追加记录</summary><article
          v-for="node in detail.order.progressNodes"
          :key="node.id"
          class="refund-node"
        >
          <header><strong>{{ progressNodeName[node.nodeCode] }}</strong><span>参考 {{ node.plannedFinishDate }}</span></header><section
            v-for="record in node.records"
            :key="record.id"
          >
            <time>{{ formatTime(record.createdAt) }}</time><p>{{ record.skipReason }}</p><p class="request-description">
              {{ record.content }}
            </p><QuoteImages
              :image-ids="record.imageIds"
              :admin-application-id="detail.application.id"
              scope="progress"
              label="制作阶段记录"
            />
          </section>
        </article>
      </details>
      <details class="refund-detail-section">
        <summary>原订单会话（只读）</summary><button
          v-if="moreMessagesAvailable"
          class="inline-button"
          :disabled="loading || writing"
          @click="moreMessages"
        >
          读取更早会话
        </button><div class="refund-readonly-chat">
          <article
            v-for="message in messages"
            :key="message.id"
          >
            <header><strong>{{ message.senderId === detail.order.buyerId ? '买家' : '创作者' }}</strong><time>{{ formatTime(message.createdAt) }}</time></header><p v-if="message.referencedNodeCode">
              引用进度：{{ progressNodeName[message.referencedNodeCode] }}
            </p><p class="request-description">
              {{ message.content }}
            </p><QuoteImages
              :image-ids="message.imageIds"
              :admin-application-id="detail.application.id"
              scope="chat"
              label="会话凭证"
            />
          </article><p v-if="!messages.length">
            当前无会话消息
          </p>
        </div>
      </details>
      <section
        v-if="detail.canDecide || attempt"
        class="refund-decision"
        aria-label="管理员退款裁定"
      >
        <h3>核验与裁定</h3><p
          v-if="stale"
          class="refund-conflict"
          role="status"
        >
          申请材料版本已变化，原意见保留。请重新查阅最新材料后明确确认，系统不会自动替换版本重放。
        </p><button
          v-if="!reviewed && !attempt"
          type="button"
          class="button-secondary"
          :disabled="loading || writing"
          @click="acknowledge"
        >
          已重新查阅当前材料
        </button><p
          v-if="reviewed"
          class="field-help"
        >
          已确认查阅材料版本 {{ input.expectedVersion }}
        </p>
        <form @submit.prevent="submit()">
          <label class="work-field">裁定结果<select
            v-model="input.decision"
            aria-label="裁定结果"
            :disabled="frozen"
          ><option value="REJECT">驳回申请，恢复履约</option><option value="APPROVE">批准全额退款</option></select></label><label class="work-field">裁定原因<textarea
            v-model="input.reason"
            aria-label="裁定原因"
            rows="4"
            maxlength="500"
            :disabled="frozen"
          /></label>
          <div
            v-if="input.decision === 'APPROVE' && detail.order.shippedAt"
            class="refund-return-fields"
          >
            <label class="work-field">退货核查<select
              v-model="input.returnRequired"
              aria-label="退货核查"
              :disabled="frozen"
            ><option :value="true">需要退回原成品</option><option :value="false">无需退货，记录依据</option></select></label><template v-if="input.returnRequired">
              <label><input
                v-model="input.returnedConfirmed"
                type="checkbox"
                :disabled="frozen"
              >已核实原成品确已退回</label><label class="work-field">退回运单号<input
                v-model="input.returnTrackingNo"
                aria-label="退回运单号"
                maxlength="30"
                :disabled="frozen"
                placeholder="8—30位字母数字，可与已存凭证择一"
              ></label><fieldset v-if="availableReturnImages.length">
                <legend>或选择当前申请已保存的退回凭证</legend><label
                  v-for="fileId in availableReturnImages"
                  :key="fileId"
                ><input
                  v-model="input.returnEvidenceImageIds"
                  type="checkbox"
                  :value="fileId"
                  :disabled="frozen"
                >凭证 {{ fileId }}</label>
              </fieldset>
            </template><label
              v-else
              class="work-field"
            >无需退货依据<textarea
              v-model="input.noReturnBasis"
              aria-label="无需退货依据"
              rows="3"
              maxlength="500"
              :disabled="frozen"
            /></label>
          </div>
          <p
            class="refund-confirmation"
            :class="{ 'refund-confirmation-approval': input.decision === 'APPROVE' }"
          >
            {{ input.decision === 'APPROVE' ? `全额退款 ¥ ${detail.application.refundAmount}，终止履约并取消待结算` : '驳回后恢复原订单状态，沿用原完成时间和售后期限' }}
          </p><button
            class="button-primary"
            :disabled="frozen || loading || stale || !reviewed"
          >
            {{ writing ? '正在提交裁定…' : '确认裁定' }}
          </button>
        </form>
      </section>
      <section
        v-if="detail.application.finishedAt"
        class="refund-detail-section"
        aria-label="售后处理结论"
      >
        <h3>{{ refundStatuses[detail.application.status] }}</h3><p class="request-description">
          {{ detail.application.decisionReason }}
        </p><p v-if="detail.application.returnConfirmedAt">
          原成品退回核实：{{ detail.application.returnTrackingNo || '已保存凭证' }} · {{ formatTime(detail.application.returnConfirmedAt) }}
        </p><p v-if="detail.application.noReturnBasis">
          无需退货依据：{{ detail.application.noReturnBasis }}
        </p><time>{{ formatTime(detail.application.finishedAt) }}</time>
      </section>
      <details class="refund-detail-section">
        <summary>处理历史</summary><ol class="order-timeline">
          <li
            v-for="item in detail.history"
            :key="item.id"
          >
            <strong>{{ item.action }} · {{ item.operatorType }} {{ item.operatorId }}</strong><p>{{ item.reason }}</p><time>{{ formatTime(item.createdAt) }}</time>
          </li>
        </ol>
      </details>
    </template>
  </div>
</template>
