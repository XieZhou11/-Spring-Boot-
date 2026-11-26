<script setup lang="ts">
import { useActivationRead } from '@/utils/pageActivation'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import CreatorLayout from '@/layouts/CreatorLayout.vue'
import PrivateImage from '@/components/PrivateImage.vue'
import RequestCollection from '@/components/RequestCollection.vue'
import RequestQuotePanel from '@/components/RequestQuotePanel.vue'
import { closeRequest, copyRequest, deleteRequest, getCustomRequest, openConversation } from '@/api/customRequest'
import type { CustomRequestVO } from '@/types/customRequest'
import { parseRequestListReturn, requestBudget, requestListPaths, requestStatus } from '@/utils/customRequest'
import { formatTime } from '@/utils/creator'
import { ApiError } from '@/utils/request'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { stickyHeaderOffset } from '@/router/scroll'
import '@/assets/styles/custom-request.css'
import '@/assets/styles/craftflow-demand.css'
import '@/assets/styles/craftflow-publication.css'
import { useConfirmation } from '@/composables/useConfirmation'

const confirm = useConfirmation()
const route = useRoute(); const router = useRouter(); const value = ref<CustomRequestVO>()
const auth = useAuthStore(); const notifications = useNotificationsStore()
const loading = ref(false); const busy = ref(false); const error = ref(''); let copyKey = crypto.randomUUID()
const refreshVersion = ref(0)
const quotes = ref<HTMLElement>()
const source = computed(() => parseRequestListReturn(route.query.returnTo))
const sourcePath = computed(() => source.value && router.resolve(source.value).path)
const creator = computed(() => auth.session?.roles.includes('CREATOR'))
/** 按服务端返回的需求关系校验来路，保留匹配列表的已应用筛选。 */
const returnTo = computed(() => {
  if (value.value?.owned) return sourcePath.value === requestListPaths.mine ? source.value! : requestListPaths.mine
  if (sourcePath.value === '/creator/quotes') return source.value!
  if (!creator.value) return requestListPaths.mine
  if (!value.value) return source.value ?? requestListPaths.mine
  const list = value.value.visibility === 'DIRECTED' && value.value.invitedCreatorId === auth.session?.userId
    ? requestListPaths.invitations
    : requestListPaths.hall
  return sourcePath.value === list ? source.value! : list
})
const returnPath = computed(() => router.resolve(returnTo.value).path)
const creatorWorkspace = computed(() => returnPath.value !== requestListPaths.mine && creator.value)
const buyerWorkspace = computed(() => value.value?.owned ?? (sourcePath.value === requestListPaths.mine))
const returnLabel = computed(() => {
  if (returnPath.value === requestListPaths.mine) return '我的需求'
  if (returnPath.value === requestListPaths.hall) return '需求大厅'
  if (returnPath.value === requestListPaths.invitations) return '收到的定向邀约'
  return '我的报价'
})
const editorQuery = computed(() => returnTo.value === requestListPaths.mine ? {} : { returnTo: returnTo.value })
let revision = 0; let deferredRefresh = false
/** 路由离开时参数会先变化，旧页面与延迟刷新只读取仍属于本页的有效需求。 */
function currentRequestId() {
  const id = route.params.id
  return route.name === 'custom-request-detail' && typeof id === 'string' && /^[1-9]\d*$/.test(id) ? id : undefined
}
async function load() {
  const id = currentRequestId()
  if (!auth.session || !id) return
  if (busy.value) { deferredRefresh = true; return }
  const current = ++revision; loading.value = true; error.value = ''
  try { const result = await getCustomRequest(id); if (current === revision) value.value = result }
  catch (failure) {
    if (current === revision) {
      // 临时刷新失败保留同一需求及未知提交上下文；权限或可见性失效仍立即清空。
      if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) value.value = undefined
      error.value = failure instanceof Error ? failure.message : '需求读取失败'
    }
  }
  finally { if (current === revision) loading.value = false }
}
/** 状态写入结果未知时保留当前详情，重新读取确认；复制始终复用当前请求键。 */
async function act(action: 'close' | 'copy' | 'chat' | 'delete') {
  const request = value.value
  const actor = auth.session?.userId
  if (!request || busy.value) return
  if (action === 'close' || action === 'delete') {
    const closing = action === 'close'
    const title = closing ? '关闭定制需求？' : '删除需求草稿？'
    const message = closing ? '关闭后不能继续报价或在未成单会话发送消息。' : '删除后无法恢复。'
    if (!(await confirm({ title, message: request.title + '。' + message, confirmLabel: closing ? '确认关闭' : '确认删除' }))) return
    if (auth.session?.userId !== actor || currentRequestId() !== request.id || value.value?.version !== request.version || busy.value) return
  }
  revision++; busy.value = true; error.value = ''
  const expected = revision; const requestId = request.id; const version = request.version
  const stillCurrent = () => expected === revision && requestId === currentRequestId()
  try {
    if (action === 'close') {
      const result = await closeRequest(requestId, version)
      if (stillCurrent()) { value.value = result; refreshVersion.value++ }
    }
    if (action === 'copy') { const result = await copyRequest(requestId, copyKey); if (stillCurrent()) await router.push({ path: `/my-requests/${result.id}/edit`, query: editorQuery.value }) }
    if (action === 'chat') { const result = await openConversation(requestId); if (stillCurrent()) await router.push(`/messages/conversations/${result.id}`) }
    if (action === 'delete') { await deleteRequest(requestId, version); if (stillCurrent()) await router.push(returnTo.value) }
  } catch (failure) { if (stillCurrent()) error.value = `${failure instanceof Error ? failure.message : '操作失败'}。请刷新核对最新状态。` }
  finally { busy.value = false; if (deferredRefresh) { deferredRefresh = false; void load() } }
}
/** 提交期间合并恢复事件，完成后再核验持久化状态。 */
function updated() { void load() }
function quoteChanged() { refreshVersion.value++; void load() }
watch([() => route.name, () => route.params.id, () => auth.session?.userId], () => { revision++; copyKey = crypto.randomUUID(); value.value = undefined; void load() }, { immediate: true })
watch(() => notifications.connected, (connected, previous) => { if (connected && !previous) updated() })
// 对比页可通过锚点返回，等真实需求和对应报价区挂载后再滚动。
watch([() => route.hash, quotes], ([hash, element]) => {
  if (hash !== '#quotes' || !element) return
  element.style.scrollMarginTop = stickyHeaderOffset() + 'px'
  element.scrollIntoView({ block: 'start' })
}, { flush: 'post' })
window.addEventListener('custom-request-updated', updated)


onBeforeUnmount(() => { revision++; window.removeEventListener('custom-request-updated', updated) })
useActivationRead(() => JSON.stringify([auth.session?.userId, currentRequestId()]), load)
</script>
<template>
  <component
    :is="creatorWorkspace ? CreatorLayout : WorkLayout"
  >
    <div :class="{ 'cf-request-workspace has-request': buyerWorkspace }">
      <RequestCollection
        v-if="buyerWorkspace"
        scope="mine"
        :location="returnTo"
        :selected-id="currentRequestId()"
        :refresh-version="refreshVersion"
      />
      <section
        class="cf-request-main"
        aria-label="需求详情"
      >
        <nav
          class="cf-request-breadcrumb"
          aria-label="需求导航"
        >
          <RouterLink :to="returnTo">{{ returnLabel }}</RouterLink>
          <span aria-hidden="true">/</span>
          <span>需求详情</span>
        </nav>
        <p
          v-if="error"
          class="form-alert"
          role="alert"
        >
          {{ error }}
          <button
            class="inline-button"
            :disabled="busy"
            @click="load"
          >
            刷新详情
          </button>
        </p>
        <p
          v-if="loading && !value"
          class="cf-request-state"
          role="status"
        >
          正在读取需求…
        </p>
        <p
          v-else-if="!value && !error"
          class="cf-request-state"
        >
          找不到该需求
        </p>
        <template v-if="value">
          <article class="cf-request-detail-card">
            <header class="cf-request-detail-header">
              <div>
                <div class="cf-request-tags">
                  <span
                    class="cf-request-status"
                    :data-status="value.status"
                  >{{ requestStatus[value.status] || value.status }}</span>
                  <span
                    v-if="value.categoryPath.length"
                    class="cf-request-category"
                  >{{ value.categoryPath.join(' / ') }}</span>
                </div>
                <h1>{{ value.title || '未命名草稿' }}</h1>
              </div>
              <button
                v-if="value.canClose"
                class="button-secondary"
                :disabled="busy"
                @click="act('close')"
              >
                关闭需求
              </button>
            </header>
            <dl class="cf-request-facts">
              <div><dt>预算区间</dt><dd>{{ requestBudget(value) }}</dd></div>
              <div><dt>期望发货日期</dt><dd>{{ value.expectedShipDate || '待填写' }}</dd></div>
              <div><dt>发布范围</dt><dd>{{ value.visibility === 'DIRECTED' ? ['定向邀约', value.invitedCreatorNickname].filter(Boolean).join(' · ') : '公开需求' }}</dd></div>
              <div><dt>发布者</dt><dd>{{ value.buyerNickname }}</dd></div>
            </dl>
            <h2>需求描述</h2>
            <p class="cf-request-description">
              {{ value.description || '未填写描述' }}
            </p>
            <dl class="cf-request-facts">
              <div><dt>用途</dt><dd>{{ value.purpose || '未填写' }}</dd></div>
              <div><dt>材质偏好</dt><dd>{{ value.materialPreference || '未填写' }}</dd></div>
              <div><dt>尺寸规格</dt><dd>{{ value.specification || '未填写' }}</dd></div>
            </dl>
            <template v-if="value.referenceImageIds.length">
              <h3>参考图片</h3>
              <div class="request-images">
                <PrivateImage
                  v-for="(id, index) in value.referenceImageIds"
                  :key="id"
                  :image-id="id"
                  scope="request"
                  :label="`需求参考图 ${index + 1}`"
                />
              </div>
            </template>
            <div class="cf-request-detail-notes">
              <p class="field-help">
                {{ value.publishedAt ? `发布于 ${formatTime(value.publishedAt)}` : '尚未发布' }}
              </p>
              <p
                v-if="['OPEN', 'QUOTING'].includes(value.status) && value.noQuoteExpireAt"
                class="field-help"
              >
                {{ formatTime(value.noQuoteExpireAt) }} 后，无有效报价将过期。
              </p>
              <p
                v-if="!value.owned && !value.canConsult && ['OPEN', 'QUOTING'].includes(value.status) && value.consultationReason"
                class="field-help"
              >
                {{ value.consultationReason }}
              </p>
            </div>
            <div
              v-if="value.canEdit || value.canConsult || value.owned || value.canCopy"
              class="cf-request-detail-actions"
            >
              <RouterLink
                v-if="value.canEdit"
                class="button-primary"
                :to="{ path: `/my-requests/${value.id}/edit`, query: editorQuery }"
              >继续编辑草稿</RouterLink>
              <button
                v-if="value.canEdit"
                class="button-secondary"
                :disabled="busy"
                @click="act('delete')"
              >
                删除草稿
              </button>
              <button
                v-if="value.canConsult"
                class="button-primary"
                :disabled="busy"
                @click="act('chat')"
              >
                进入需求沟通
              </button>
              <button
                v-if="value.canCopy"
                class="button-primary"
                :disabled="busy"
                @click="act('copy')"
              >
                复制为新草稿
              </button>
              <RouterLink
                v-if="value.owned && !value.canEdit"
                to="/messages/conversations"
                class="button-secondary"
              >查看已有沟通会话 ↗</RouterLink>
            </div>
          </article>
          <div
            v-if="value.status !== 'DRAFT'"
            id="quotes"
            ref="quotes"
          >
            <RequestQuotePanel
              :key="value.id"
              :request="value"
              :return-to="returnTo"
              @changed="quoteChanged"
            />
          </div>
        </template>
      </section>
    </div>
  </component>
</template>
