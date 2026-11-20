<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { decideReviewReport, getReviewReport, getReviewReports, getReviewImage } from '@/api/review'
import type { ReviewReportDetailVO, ReviewReportVO } from '@/types/review'

const rows = ref<ReviewReportVO[]>([]); const detail = ref<ReviewReportDetailVO>(); const error = ref(''); const reason = ref(''); const busy = ref(false); const images = ref<Record<string,string>>({})
async function load(id?: string) { busy.value = true; error.value = ''; try { const page = await getReviewReports('ALL'); rows.value = page.items; const target = id || detail.value?.report.id || rows.value[0]?.id; detail.value = target ? await getReviewReport(target) : undefined; if (detail.value) for (const fileId of [...detail.value.report.imageIds,...detail.value.evidence.flatMap(x => x.imageIds)]) images.value[fileId] = (await getReviewImage(fileId)).url } catch (e) { error.value = e instanceof Error ? e.message : '举报队列读取失败' } finally { busy.value = false } }
async function choose(row: ReviewReportVO) { try { detail.value = await getReviewReport(row.id); await load(row.id) } catch (e) { error.value = e instanceof Error ? e.message : '举报详情读取失败' } }
async function decide(decision: 'NOT_UPHELD' | 'HIDE' | 'DELETE' | 'RESTORE') { if (!detail.value || reason.value.trim().length < 5) return; busy.value = true; try { await decideReviewReport(detail.value.report.id, decision, reason.value.trim()); reason.value = ''; await load(detail.value.report.id) } catch (e) { error.value = e instanceof Error ? e.message : '举报处理失败' } finally { busy.value = false } }
onMounted(() => void load())
</script>
<template>
  <AdminLayout title="评价举报">
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }} <button
        class="inline-button"
        @click="load()"
      >
        重新读取
      </button>
    </p>
    <div class="admin-review-grid">
      <aside class="admin-queue">
        <h2>举报队列</h2><button
          v-for="row in rows"
          :key="row.id"
          class="admin-queue-item"
          :class="{ active: detail?.report.id === row.id }"
          @click="choose(row)"
        >
          <strong>#{{ row.id }} · {{ row.reasonCode }}</strong><span>{{ row.status === 'PENDING' ? '待处理' : '已处理' }} · {{ row.createdAt }}</span><span>{{ row.description || '图片证据' }}</span>
        </button>
      </aside>
      <section
        v-if="detail"
        class="admin-review-detail"
      >
        <h2>订单评价核查</h2><dl><div><dt>订单</dt><dd><RouterLink :to="`/orders/${detail.orderId}`">{{ detail.orderNo }} ↗</RouterLink></dd></div><div><dt>买家 / 创作者</dt><dd>{{ detail.buyerId }} / {{ detail.creatorId }}</dd></div><div><dt>总体评分</dt><dd>{{ detail.review.rating }} 星</dd></div></dl><blockquote>{{ detail.review.content }}</blockquote><div class="review-image-row">
          <img
            v-for="image in detail.review.images"
            :key="image.id"
            :src="image.url"
            alt="评价图片"
          >
        </div><h3>举报说明与证据</h3><p>{{ detail.report.description || '举报人仅附图片证据' }}</p><div class="review-image-row">
          <img
            v-for="id in detail.report.imageIds"
            :key="id"
            :src="images[id]"
            alt="举报证据"
          >
        </div><article
          v-for="item in detail.evidence"
          :key="item.id"
        >
          <h4>{{ item.evidenceType === 'OBJECTION' ? '处置异议' : '补充证据' }} · {{ item.submitterId }}</h4><p>{{ item.content }}</p><div class="review-image-row">
            <img
              v-for="id in item.imageIds"
              :key="id"
              :src="images[id]"
              alt="补充证据"
            >
          </div>
        </article><section v-if="detail.messages.length">
          <h3>关联订单会话（最近100条）</h3><ol>
            <li
              v-for="message in detail.messages"
              :key="message.id"
            >
              <strong>{{ message.senderId }}</strong> · {{ message.content || '图片/节点证据' }} <time>{{ message.createdAt }}</time><span v-if="message.imageIds.length"> · {{ message.imageIds.length }} 张图片证据</span>
            </li>
          </ol>
        </section><section v-if="detail.history.length">
          <h3>处置历史</h3><ol>
            <li
              v-for="entry in detail.history"
              :key="entry.id"
            >
              <strong>{{ entry.action === 'CORRECT' ? '更正' : '处置' }} · {{ entry.afterStatus }}</strong><p>{{ entry.reason }}</p><small>{{ entry.createdAt }} · 管理员 {{ entry.operatorId }}</small>
            </li>
          </ol>
        </section><label>处理依据<textarea
          v-model="reason"
          maxlength="500"
          minlength="5"
        /></label><div class="admin-decision-actions">
          <button
            :disabled="busy || reason.trim().length < 5"
            @click="decide('NOT_UPHELD')"
          >
            举报不成立
          </button><button
            :disabled="busy || reason.trim().length < 5"
            @click="decide('HIDE')"
          >
            隐藏评价
          </button><button
            :disabled="busy || reason.trim().length < 5"
            @click="decide('DELETE')"
          >
            删除评价
          </button><button
            v-if="detail.report.status === 'PROCESSED'"
            :disabled="busy || reason.trim().length < 5"
            @click="decide('RESTORE')"
          >
            更正并恢复评价
          </button>
        </div>
      </section><p
        v-else
        class="admin-review-placeholder"
      >
        暂无评价举报。
      </p>
    </div>
  </AdminLayout>
</template>
<style scoped>
.admin-review-grid{display:grid;grid-template-columns:minmax(220px,320px) minmax(0,1fr);gap:20px}.admin-queue{display:grid;align-content:start;gap:8px}.admin-queue-item{text-align:left;display:grid;gap:5px;padding:12px;border:1px solid #ddd8ce;border-radius:8px;background:#fff}.admin-queue-item.active{border-color:#68765d}.admin-queue-item span{font-size:12px;color:#71756e}.admin-review-detail{padding:20px;background:#fff;border:1px solid #e7e2d8;border-radius:10px}.admin-review-detail dl{display:grid;grid-template-columns:repeat(3,1fr)}.admin-review-detail dl div{padding:8px}.admin-review-detail dt{font-size:12px;color:#777}.admin-review-detail textarea{display:block;width:100%;min-height:80px}.admin-decision-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.review-image-row{display:flex;gap:8px;flex-wrap:wrap}.review-image-row img{width:88px;height:88px;object-fit:cover;border-radius:8px}@media(max-width:760px){.admin-review-grid{grid-template-columns:1fr}}
</style>
