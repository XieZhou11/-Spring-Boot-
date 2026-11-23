<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import CreatorFollow from '@/components/CreatorFollow.vue'
import WorkCard from '@/components/WorkCard.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getCreator, getWorks } from '@/api/work'
import { addReviewReportEvidence, getCreatorReviews, getReviewReportsForActor, reportReview, uploadReviewImage } from '@/api/review'
import { reportCreatorProfile } from '@/api/report'
import type { ReportInput } from '@/types/report'
import ReportDialog from '@/components/ReportDialog.vue'
import { useAuthStore } from '@/stores/auth'
import type { CreatorPublicVO, WorkVO } from '@/types/work'
import type { CreatorReviewVO } from '@/types/review'
const route = useRoute()
const auth = useAuthStore()
const creator = ref<CreatorPublicVO>()
const works = ref<WorkVO[]>([])
const reviews = ref<CreatorReviewVO[]>([])
const reviewError = ref('')
const reportingId = ref('')
const reportReason = ref('OTHER')
const reportDescription = ref('')
const reportImages = ref<{id:string;url:string}[]>([])
const relatedReports = ref<Record<string, {id:string;status:string;reporterId:string;reasonCode:string;decisionReason:string|null}[]>>({})
const evidenceText = ref<Record<string,string>>({})
const evidenceImages = ref<Record<string,{id:string;url:string}[]>>({})
const reportStatus = ref<Record<string,string>>({})
const page = ref(1)
const total = ref(0)
const error = ref('')
const loading = ref(false)
let revision = 0
let timer: ReturnType<typeof setTimeout> | undefined
/** 公开资料及作品独立查询，头像到期前重新从资料接口核验签名。 */
async function load(next = page.value) {
  const current = ++revision
  page.value = next
  loading.value = true
  error.value = ''
  clearTimeout(timer)
  try {
    const [profile, result, reviewPage] = await Promise.all([getCreator(String(route.params.id)), getWorks({ creatorId: String(route.params.id), page: next }), getCreatorReviews(String(route.params.id))])
    if (current !== revision) return
    creator.value = profile; works.value = result.items; total.value = result.total; reviews.value = reviewPage.items
    if (profile.avatarExpiresAt) timer = setTimeout(() => void load(), Math.max(5000, Date.parse(profile.avatarExpiresAt) - Date.now() - 20_000))
  } catch (failure) { if (current === revision) { creator.value = undefined; error.value = failure instanceof Error ? failure.message : '创作者资料读取失败' } }
  finally { if (current === revision) loading.value = false }
}
async function flagReview(review: CreatorReviewVO) {
  if (!window.confirm('确认提交评价举报？')) return
  try { await reportReview(review.id, { reasonCode: reportReason.value, description: reportDescription.value.trim(), imageIds: reportImages.value.map(x => x.id) }); reviewError.value = '举报已提交；若已有待处理举报，会追加到原记录。'; reportingId.value = ''; reportDescription.value = ''; reportImages.value = [] }
  catch (failure) { reviewError.value = failure instanceof Error ? failure.message : '举报提交失败' }
}
async function uploadReportImage(event: Event) { const file=(event.target as HTMLInputElement).files?.[0]; if(!file||reportImages.value.length>=6)return; try{reportImages.value.push(await uploadReviewImage(file))}catch(failure){reviewError.value=failure instanceof Error?failure.message:'证据图片上传失败'}finally{(event.target as HTMLInputElement).value=''} }
async function loadRelatedReports(reviewId:string) { try { relatedReports.value[reviewId]=await getReviewReportsForActor(reviewId) } catch (failure) { reviewError.value=failure instanceof Error?failure.message:'当前账号没有该评价举报的查询权限' } }
async function uploadEvidenceImage(reviewId:string,event:Event) { const file=(event.target as HTMLInputElement).files?.[0];const list=evidenceImages.value[reviewId]??[];if(!file||list.length>=6)return;try{evidenceImages.value[reviewId]=[...list,await uploadReviewImage(file)]}catch(failure){reportStatus.value[reviewId]=failure instanceof Error?failure.message:'证据图片上传失败'}finally{(event.target as HTMLInputElement).value=''} }
async function submitEvidence(reviewId:string,reportId:string) { const list=evidenceImages.value[reviewId]??[];try{await addReviewReportEvidence(reportId,{content:evidenceText.value[reviewId]?.trim()??'',imageIds:list.map(x=>x.id)});reportStatus.value[reviewId]='材料已提交';evidenceText.value[reviewId]='';evidenceImages.value[reviewId]=[];await loadRelatedReports(reviewId)}catch(failure){reportStatus.value[reviewId]=failure instanceof Error?failure.message:'材料提交失败'} }
// 主页举报入口：管理员不显示，提交后收起表单并提示。
const profileReportOpen = ref(false)
const profileReportMessage = ref('')
const profileReportError = ref('')
async function submitProfileReport(input: ReportInput) {
  profileReportError.value = ''
  try {
    await reportCreatorProfile(String(route.params.id), input)
    profileReportMessage.value = '举报已提交，管理员将核查处理；可在“我的举报”中查看进度。'
    profileReportOpen.value = false
  } catch (failure) { profileReportError.value = failure instanceof Error ? failure.message : '举报提交失败' }
}
// 同账号凭证回读保留当前作者与分页，实际身份或主页变化仍清理旧内容。
watch([() => route.params.id, () => auth.session?.userId, () => auth.session?.activeRole], () => { creator.value = undefined; works.value = []; profileReportOpen.value = false; void load(1) }, { immediate: true })
onBeforeUnmount(() => { revision++; clearTimeout(timer) })
</script>
<template>
  <WorkLayout>
    <nav class="work-breadcrumb">
      <RouterLink to="/">发现作品</RouterLink><span>/</span><span>创作者主页</span>
    </nav><p
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
    </p><template v-if="creator">
      <section class="creator-public-header">
        <img
          v-if="creator.avatarUrl"
          :src="creator.avatarUrl"
          :alt="`${creator.nickname}的头像`"
          @error="creator.avatarUrl = null"
        ><span
          v-else
          class="creator-public-avatar"
        >{{ creator.nickname.slice(0, 1) }}</span><div>
          <p class="eyebrow">
            THE HANDS BEHIND THE CRAFT
          </p><h1>{{ creator.nickname }}</h1><p>{{ creator.province }} {{ creator.city }} <span v-if="creator.province">·</span> {{ creator.categories.map(c => c.name).join(' / ') }}</p><p class="creator-bio">
            {{ creator.bio || '这位创作者还未填写简介。' }}
          </p><p
            v-if="creator.paused"
            class="field-error"
          >
            创作者暂时停止承接新业务
          </p>
          <CreatorFollow :creator-id="creator.id" />
        </div><dl class="creator-public-stats">
          <div><dt>口碑评分</dt><dd>{{ creator.averageRating || '暂无评价' }}</dd></div><div><dt>好评率</dt><dd>{{ creator.positiveRate === null ? '暂无评价' : `${creator.positiveRate}%` }}</dd></div><div><dt>真实评价</dt><dd>{{ creator.reviewCount }}</dd></div><div><dt>已完成订单</dt><dd>{{ creator.completedOrderCount }}</dd></div>
        </dl>
      </section><RouterLink
        v-if="!creator.paused && creator.id !== auth.session?.userId && !auth.session?.roles.includes('ADMIN')"
        class="button-primary"
        :to="{ path: '/my-requests/new', query: { creatorId: creator.id } }"
      >邀请定制 ↗</RouterLink><button
        v-if="creator.id !== auth.session?.userId && !auth.session?.roles.includes('ADMIN')"
        class="inline-button profile-report-toggle"
        @click="profileReportOpen = !profileReportOpen; profileReportMessage = ''"
      >
        {{ profileReportOpen ? '收起主页举报' : '举报主页' }}
      </button><p
        v-if="profileReportMessage"
        role="status"
      >
        {{ profileReportMessage }}
      </p><p
        v-if="profileReportError"
        class="field-error"
        role="alert"
      >
        {{ profileReportError }}
      </p><ReportDialog
        v-if="profileReportOpen"
        submit-label="提交主页举报"
        @submit="submitProfileReport"
      /><header class="work-section-heading">
        <h2>手作作品</h2><span class="muted">{{ total }} 件已上架作品</span>
      </header><div
        v-if="!works.length && !loading"
        class="work-empty"
      >
        <h3>创作慢慢来，好物值得等</h3><p>目前没有已上架作品。</p>
      </div><div class="work-grid">
        <WorkCard
          v-for="work in works"
          :key="work.id"
          :work="work"
        />
      </div><WorkPagination
        :page="page"
        :total="total"
        :loading="loading"
        @change="load"
      />
      <section class="creator-reviews">
        <header class="work-section-heading">
          <h2>交易评价</h2><span class="muted">{{ creator.reviewCount }} 条有效评价</span>
        </header><p
          v-if="reviewError"
          class="field-help"
          role="status"
        >
          {{ reviewError }}
        </p><p
          v-if="!reviews.length"
          class="muted"
        >
          暂无评价，完成交易后买家可以分享体验。
        </p><article
          v-for="review in reviews"
          :key="review.id"
          class="creator-review-card"
        >
          <p><strong>{{ review.buyerNickname }}</strong><span> · {{ review.rating }} 星</span></p><p>{{ review.content }}</p><div class="review-images">
            <img
              v-for="image in review.images"
              :key="image.id"
              :src="image.url"
              alt="订单评价图片"
            >
          </div><time>{{ review.createdAt }}</time><button
            v-if="review.canReport"
            class="inline-button"
            @click="reportingId = reportingId === review.id ? '' : review.id"
          >
            举报评价
          </button><form
            v-if="reportingId === review.id"
            class="review-report-form"
            @submit.prevent="flagReview(review)"
          >
            <label>举报理由<select v-model="reportReason"><option value="COPYRIGHT">盗图</option><option value="FALSE_ADVERTISING">虚假宣传</option><option value="OFFSITE">站外引流</option><option value="ABUSE">辱骂</option><option value="OTHER">其他</option></select></label><label>说明<textarea
              v-model="reportDescription"
              maxlength="1000"
              placeholder="描述需要核实的问题；也可仅附图片证据"
            /></label><label>证据图片（最多6张）<input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="reportImages.length >= 6"
              @change="uploadReportImage"
            ></label><button
              class="button-primary"
              :disabled="!reportDescription.trim() && !reportImages.length"
            >
              提交举报
            </button>
          </form>
          <button
            v-if="auth.session"
            class="inline-button"
            @click="loadRelatedReports(review.id)"
          >
            查询关联举报
          </button>
          <article
            v-for="item in relatedReports[review.id]"
            :key="item.id"
            class="review-report-followup"
          >
            <p>举报 #{{ item.id }} · {{ item.status === 'PENDING' ? '处理中' : '已处理' }} · {{ item.decisionReason || item.reasonCode }}</p>
            <template v-if="(item.status === 'PENDING' && item.reporterId === auth.session?.userId) || (item.status === 'PROCESSED' && item.reporterId !== auth.session?.userId)">
              <label>{{ item.status === 'PENDING' ? '补充证据' : '处置异议' }}<textarea
                v-model="evidenceText[review.id]"
                maxlength="1000"
              /></label>
              <label>图片<input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                :disabled="(evidenceImages[review.id] || []).length >= 6"
                @change="uploadEvidenceImage(review.id,$event)"
              ></label>
              <button
                class="button-primary"
                :disabled="!evidenceText[review.id]?.trim() && !(evidenceImages[review.id] || []).length"
                @click="submitEvidence(review.id,item.id)"
              >
                提交材料
              </button>
            </template>
            <p
              v-if="reportStatus[review.id]"
              class="field-help"
            >
              {{ reportStatus[review.id] }}
            </p>
          </article>
        </article>
      </section>
    </template><p
      v-else-if="loading"
      class="account-loading"
    >
      正在读取创作者…
    </p>
  </WorkLayout>
</template>
