<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import PrivateImage from '@/components/PrivateImage.vue'
import RequestQuotePanel from '@/components/RequestQuotePanel.vue'
import { closeRequest, copyRequest, deleteRequest, getCustomRequest, openConversation } from '@/api/customRequest'
import type { CustomRequestVO } from '@/types/customRequest'
import { requestStatus } from '@/utils/customRequest'
import { formatTime } from '@/utils/creator'
import { ApiError } from '@/utils/request'
import '@/assets/styles/custom-request.css'
const route = useRoute(); const router = useRouter(); const value = ref<CustomRequestVO>()
const loading = ref(false); const busy = ref(false); const error = ref(''); let copyKey = crypto.randomUUID()
let revision = 0
async function load() {
  const current = ++revision; loading.value = true; error.value = ''
  try { const result = await getCustomRequest(String(route.params.id)); if (current === revision) value.value = result }
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
  if (!value.value || busy.value) return
  if (action === 'close' && !window.confirm('关闭后不能继续报价或在未成单会话发送消息。确定关闭？')) return
  if (action === 'delete' && !window.confirm('确定删除此草稿？')) return
  busy.value = true; error.value = ''
  const expected = revision; const requestId = value.value.id; const version = value.value.version
  const stillCurrent = () => expected === revision && requestId === String(route.params.id)
  try {
    if (action === 'close') { const result = await closeRequest(requestId, version); if (stillCurrent()) value.value = result }
    if (action === 'copy') { const result = await copyRequest(requestId, copyKey); if (stillCurrent()) await router.push(`/my-requests/${result.id}/edit`) }
    if (action === 'chat') { const result = await openConversation(requestId); if (stillCurrent()) await router.push(`/messages/conversations/${result.id}`) }
    if (action === 'delete') { await deleteRequest(requestId, version); if (stillCurrent()) await router.push('/my-requests') }
  } catch (failure) { if (stillCurrent()) error.value = `${failure instanceof Error ? failure.message : '操作失败'}。请刷新核对最新状态。` }
  finally { busy.value = false }
}
function updated() { if (!busy.value) void load() }
watch(() => route.params.id, () => { copyKey = crypto.randomUUID(); value.value = undefined; void load() }, { immediate: true })
window.addEventListener('custom-request-updated', updated)
onBeforeUnmount(() => { revision++; window.removeEventListener('custom-request-updated', updated) })
</script>
<template>
  <WorkLayout>
    <nav class="work-breadcrumb">
      <RouterLink to="/my-requests">我的需求</RouterLink><span>/</span><span>需求详情</span>
    </nav>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }} <button
        class="inline-button"
        :disabled="busy"
        @click="load"
      >
        刷新详情
      </button>
    </p><p
      v-if="loading && !value"
      role="status"
    >
      正在读取需求…
    </p>
    <template v-if="value">
      <header class="work-section-heading">
        <div>
          <p class="eyebrow">
            {{ value.categoryPath.join(' / ') }}
          </p><h1>{{ value.title || '未命名草稿' }}</h1><p class="muted">
            {{ value.buyerNickname }} · {{ value.visibility === 'DIRECTED' ? `定向邀约 ${value.invitedCreatorNickname || ''}` : '公开需求' }}
          </p>
        </div><span class="work-status">{{ requestStatus[value.status] || value.status }}</span>
      </header>
      <div class="request-detail-grid">
        <section class="editor-section">
          <h2>定制期待</h2><p class="request-description">
            {{ value.description || '未填写描述' }}
          </p><dl class="work-specifications">
            <div><dt>用途</dt><dd>{{ value.purpose || '未填写' }}</dd></div><div><dt>材质偏好</dt><dd>{{ value.materialPreference || '未填写' }}</dd></div><div><dt>尺寸规格</dt><dd>{{ value.specification || '未填写' }}</dd></div>
          </dl><h3 v-if="value.referenceImageIds.length">
            参考图片
          </h3><div class="request-images">
            <PrivateImage
              v-for="(id, index) in value.referenceImageIds"
              :key="id"
              :image-id="id"
              scope="request"
              :label="`需求参考图 ${index + 1}`"
            />
          </div>
        </section>
        <aside class="editor-section request-summary">
          <p class="eyebrow">
            BUDGET & TIMING
          </p><strong class="work-price">{{ value.budgetMin ? `¥ ${value.budgetMin} — ${value.budgetMax || '待定'}` : '预算待填写' }}</strong><p>期望发货：{{ value.expectedShipDate || '待填写' }}</p><p class="field-help">
            {{ value.publishedAt ? `发布于 ${formatTime(value.publishedAt)}` : '尚未发布' }}
          </p><p
            v-if="value.noQuoteExpireAt"
            class="field-help"
          >
            {{ formatTime(value.noQuoteExpireAt) }} 后，无有效报价将过期。
          </p><RouterLink
            v-if="value.canEdit"
            class="button-secondary"
            :to="`/my-requests/${value.id}/edit`"
          >继续编辑草稿</RouterLink><button
            v-if="value.canEdit"
            class="inline-button"
            :disabled="busy"
            @click="act('delete')"
          >
            删除草稿
          </button><button
            v-if="value.canConsult"
            class="button-primary"
            :disabled="busy"
            @click="act('chat')"
          >
            进入需求沟通
          </button><p
            v-else-if="value.consultationReason"
            class="field-help"
          >
            {{ value.consultationReason }}
          </p><RouterLink
            v-if="value.owned"
            to="/messages/conversations"
            class="inline-button"
          >查看已有沟通会话 ↗</RouterLink><button
            v-if="value.canClose"
            class="button-secondary"
            :disabled="busy"
            @click="act('close')"
          >
            关闭需求
          </button><button
            v-if="value.canCopy"
            class="button-primary"
            :disabled="busy"
            @click="act('copy')"
          >
            复制为新草稿
          </button><p
            v-if="!value.canEdit"
            class="field-help"
          >
            发布内容已锁定。关闭或过期后，可复制正文和本人参考图重新发布。
          </p>
        </aside>
      </div>
      <RequestQuotePanel
        :key="value.id"
        :request="value"
        @changed="load"
      />
    </template>
  </WorkLayout>
</template>
