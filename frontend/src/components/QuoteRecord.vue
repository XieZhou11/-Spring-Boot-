<script setup lang="ts">
import { ref } from 'vue'
import QuoteImages from './QuoteImages.vue'
import { withdrawQuote } from '@/api/quote'
import type { QuoteVO } from '@/types/quote'
import { quoteStatus, invalidQuoteReason } from '@/utils/quote'
import { formatTime } from '@/utils/creator'
const props = defineProps<{ quote: QuoteVO; showRequest?: boolean; requestReturnTo?: string }>()
const emit = defineEmits<{ changed: [] }>()
const busy = ref(false); const error = ref('')
/** 从我的报价进入需求时保留来路，底部操作可定位到对应的报价区域。 */
function requestDetail(hash = '') {
  return {
    name: 'custom-request-detail',
    params: { id: props.quote.requestId },
    query: props.requestReturnTo ? { returnTo: props.requestReturnTo } : {},
    hash,
  }
}
/** 撤回是明确的业务动作；未知响应可按同一报价重试，服务端保证幂等。 */
async function withdraw() {
  if (busy.value || !window.confirm('撤回后原报价失效并保留历史；重报将计入当天报价次数。确认撤回？')) return
  busy.value = true; error.value = ''
  try { await withdrawQuote(props.quote.id); emit('changed') }
  catch (failure) { error.value = `${failure instanceof Error ? failure.message : '撤回失败'}。请刷新核对，或重试撤回。` }
  finally { busy.value = false }
}
</script>
<template>
  <article
    :id="`quote-${quote.id}`"
    class="quote-record"
  >
    <header>
      <div>
        <RouterLink
          v-if="showRequest"
          :to="requestDetail()"
        >{{ quote.requestTitle }} ↗</RouterLink><RouterLink
          v-else
          :to="`/creators/${quote.creatorId}`"
        >{{ quote.creatorNickname }}</RouterLink><p class="field-help">
          提交于 {{ formatTime(quote.createdAt) }}
        </p>
      </div>
      <span
        class="work-status"
        :class="quote.status"
      >{{ quoteStatus[quote.status] || quote.status }}</span>
    </header>
    <div class="quote-record-terms">
      <strong class="quote-amount">¥ {{ quote.goodsAmount }}</strong><span>{{ quote.durationDays }} 个自然日</span><span>预计发货 {{ quote.estimatedShipDate }}</span>
    </div>
    <details>
      <summary>查看方案与约定</summary><p class="request-description">
        {{ quote.proposal }}
      </p><p
        v-if="quote.additionalAgreement"
        class="request-description"
      >
        补充约定：{{ quote.additionalAgreement }}
      </p><QuoteImages :image-ids="quote.imageIds" />
    </details>
    <p
      v-if="quote.invalidReason"
      class="field-help"
    >
      {{ invalidQuoteReason(quote.invalidReason) }}
    </p>
    <p class="field-help">
      有效期至 {{ formatTime(quote.expiresAt) }}；预计发货以实际支付时间确定。
    </p>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
    </p>
    <footer v-if="quote.owned">
      <button
        v-if="quote.canWithdraw"
        type="button"
        class="inline-button"
        :disabled="busy"
        @click="withdraw"
      >
        {{ busy ? '正在撤回…' : '撤回报价' }}
      </button><RouterLink
        v-if="showRequest"
        :to="requestDetail('#quotes')"
      >查看需求 ↗</RouterLink>
    </footer>
  </article>
</template>
