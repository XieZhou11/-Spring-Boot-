<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { createOrderReview, getOrderReview, reportReview, uploadReviewImage } from '@/api/review'
import type { OrderReviewVO } from '@/types/review'

const props = defineProps<{ orderId: string }>()
const current = ref<OrderReviewVO>()
const content = ref(''); const rating = ref(5); const images = ref<{ id: string; url: string }[]>([])
const reason = ref('ABUSE'); const error = ref(''); const notice = ref(''); const busy = ref(false); const reporting = ref(false)
async function load() { try { current.value = await getOrderReview(props.orderId); error.value = '' } catch (e) { error.value = e instanceof Error ? e.message : '评价状态读取失败' } }
async function upload(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file || images.value.length >= 3) return; busy.value = true; try { const uploaded = await uploadReviewImage(file); images.value.push(uploaded) } catch (e) { error.value = e instanceof Error ? e.message : '图片上传失败' } finally { busy.value = false; (event.target as HTMLInputElement).value = '' } }
async function submit() { busy.value = true; error.value = ''; try { current.value = await createOrderReview(props.orderId, { rating: rating.value, content: content.value, imageIds: images.value.map(x => x.id) }); notice.value = '评价已提交。提交后不能修改。' } catch (e) { error.value = e instanceof Error ? e.message : '评价提交失败' } finally { busy.value = false } }
async function report() { if (!current.value?.id || !window.confirm('确认举报此评价并提交核查？')) return; busy.value = true; error.value = ''; try { await reportReview(current.value.id, { reasonCode: reason.value, description: '请管理员结合订单与沟通记录核查。', imageIds: [] }); notice.value = '举报已提交；重复举报会追加到同一待处理记录。'; reporting.value = false } catch (e) { error.value = e instanceof Error ? e.message : '举报提交失败' } finally { busy.value = false } }
watch(() => props.orderId, () => { current.value = undefined; images.value = []; content.value = ''; void load() })
onMounted(load)
</script>
<template>
  <section
    class="editor-section order-review-panel"
    aria-label="订单评价"
  >
    <h2>订单评价</h2>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
    </p><p
      v-if="notice"
      role="status"
    >
      {{ notice }}
    </p>
    <form
      v-if="current?.canCreate"
      @submit.prevent="submit"
    >
      <label>总体评分<select v-model.number="rating"><option
        v-for="star in 5"
        :key="star"
        :value="star"
      >{{ star }} 星</option></select></label>
      <label>交易体验<textarea
        v-model="content"
        minlength="10"
        maxlength="500"
        required
        placeholder="请描述现货展示或定制约定的符合程度及合作体验（10—500字）"
      /></label>
      <label>评价图片（最多3张）<input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :disabled="busy || images.length >= 3"
        @change="upload"
      ></label>
      <div class="review-image-row">
        <img
          v-for="image in images"
          :key="image.id"
          :src="image.url"
          alt="评价图片"
        ><button
          v-for="image in images"
          :key="`rm-${image.id}`"
          type="button"
          class="inline-button"
          @click="images = images.filter(x => x.id !== image.id)"
        >
          移除 {{ image.id }}
        </button>
      </div>
      <button
        class="button-primary"
        :disabled="busy || content.trim().length < 10"
      >
        提交评价
      </button>
    </form>
    <article
      v-else-if="current?.id && current.canView"
      class="creator-review-item"
    >
      <p><strong>{{ current.buyerNickname }}</strong><span> · {{ current.rating }} 星</span></p><p>{{ current.content }}</p><div class="review-image-row">
        <img
          v-for="image in current.images"
          :key="image.id"
          :src="image.url"
          alt="评价图片"
        >
      </div><time>{{ current.createdAt }}</time><button
        v-if="current.canReport"
        class="inline-button"
        @click="reporting = !reporting"
      >
        举报评价
      </button>
    </article>
    <p v-else-if="current?.reviewDeadlineAt && !current.canCreate">
      本订单当前不在评价窗口内。
    </p>
    <form
      v-if="reporting"
      @submit.prevent="report"
    >
      <label>举报理由<select v-model="reason"><option value="COPYRIGHT">盗图</option><option value="FALSE_ADVERTISING">虚假宣传</option><option value="OFFSITE">站外引流</option><option value="ABUSE">辱骂</option><option value="OTHER">其他</option></select></label><button
        class="button-primary"
        :disabled="busy"
      >
        提交举报
      </button>
    </form>
  </section>
</template>
<style scoped>
.order-review-panel form{display:grid;gap:14px;max-width:620px}.order-review-panel label{display:grid;gap:6px}.order-review-panel textarea{min-height:110px}.creator-review-item{border-top:1px solid #e8e4db;padding-top:14px}.review-image-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.review-image-row img{width:88px;height:88px;object-fit:cover;border-radius:8px}.creator-review-item time{display:block;color:#73776f;font-size:12px}
</style>
