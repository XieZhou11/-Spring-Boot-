<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import CreatorFollow from '@/components/CreatorFollow.vue'
import WorkCard from '@/components/WorkCard.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import PrivateImage from '@/components/PrivateImage.vue'
import { getCreator, getWorks } from '@/api/work'
import { addReviewReportEvidence, getCreatorReviews, getReviewReportsForActor, reportReview, uploadReviewImage } from '@/api/review'
import { reportCreatorProfile } from '@/api/report'
import type { ReportInput } from '@/types/report'
import ReportDialog from '@/components/ReportDialog.vue'
import { useAuthStore } from '@/stores/auth'
import type { PageVO } from '@/types/creator'
import type { CreatorPublicVO, WorkVO } from '@/types/work'
import type { CreatorReviewVO, ReviewReportVO } from '@/types/review'
import { formatTime } from '@/utils/creator'
import { prepareOwnReportVerification } from '@/utils/report'
import '@/assets/styles/craftflow-works.css'
import { imageRenewalDelay } from '@/utils/imageExpiry'
const route = useRoute()
const auth = useAuthStore()
const creator = ref<CreatorPublicVO>()
const creatorLocation = computed(() => {
  if (!creator.value) return ''
  const { province, city, categories } = creator.value
  const district = [province, city].filter(Boolean).join(' ')
  return [district, categories.map(category => category.name).join(' / ')].filter(Boolean).join(' · ')
})
const works = ref<WorkVO[]>([])
const reviews = ref<PageVO<CreatorReviewVO>>()
const reviewsLoading = ref(false)
const reviewsError = ref('')
const requestedReviewPage = ref(1)
const reviewError = ref('')
const reportingId = ref('')
const relatedReports = ref<Record<string, ReviewReportVO[]>>({})
const evidenceText = ref<Record<string,string>>({})
const evidenceImages = ref<Record<string,{id:string;url:string}[]>>({})
const reportStatus = ref<Record<string,string>>({})
const uploadingEvidence = ref<Record<string, boolean>>({})
const page = ref(1)
const total = ref(0)
const error = ref('')
const loading = ref(false)
let revision = 0
let reviewsRevision = 0
let reportRevision = 0
let timer: ReturnType<typeof setTimeout> | undefined
/** 公开资料及作品独立查询，头像到期前重新从资料接口核验签名。 */
async function load(next = page.value) {
  const current = ++revision
  page.value = next
  loading.value = true
  error.value = ''
  clearTimeout(timer)
  try {
    const [profile, result] = await Promise.all([getCreator(String(route.params.id)), getWorks({ creatorId: String(route.params.id), page: next })])
    if (current !== revision) return
    creator.value = profile; works.value = result.items; total.value = result.total
    const delay = imageRenewalDelay(profile.avatarExpiresAt)
    if (delay !== undefined) timer = setTimeout(() => void load(), delay)
  } catch (failure) { if (current === revision) { creator.value = undefined; error.value = failure instanceof Error ? failure.message : '创作者资料读取失败' } }
  finally { if (current === revision) loading.value = false }
}
/** 评价使用独立分页，作品翻页和头像续签不重置当前评价页。 */
async function loadReviews(next = requestedReviewPage.value) {
  const current = ++reviewsRevision
  requestedReviewPage.value = next
  reviewsLoading.value = true
  reviewsError.value = ''
  try {
    const result = await getCreatorReviews(String(route.params.id), next)
    if (current !== reviewsRevision) return
    const lastPage = Math.max(1, Math.ceil(result.total / result.size))
    if (next > lastPage) {
      void loadReviews(lastPage)
      return
    }
    reviews.value = result
    if (reportingId.value && !result.items.some(review => review.id === reportingId.value)) openReviewReport('')
  } catch (failure) {
    if (current === reviewsRevision) reviewsError.value = failure instanceof Error ? failure.message : '评价读取失败'
  } finally {
    if (current === reviewsRevision) reviewsLoading.value = false
  }
}
function openReviewReport(id: string) {
  reportingId.value = reportingId.value === id ? '' : id
}
async function flagReview(id: string, input: ReportInput) {
  const current = reportRevision
  await reportReview(id, input)
  if (current === reportRevision && id === reportingId.value) {
    reviewError.value = '举报已提交；若已有待处理举报，会追加到原记录。'
    reportingId.value = ''
  }
}
function prepareReviewVerification(id: string, input: ReportInput) {
  const current = reportRevision
  return prepareOwnReportVerification('REVIEW', id, input, () => {
    if (current === reportRevision && id === reportingId.value) {
      reviewError.value = '已核对到提交的举报。'
      reportingId.value = ''
    }
  })
}
async function loadRelatedReports(reviewId: string) {
  const current = reportRevision
  try {
    const reports = await getReviewReportsForActor(reviewId)
    if (current === reportRevision) relatedReports.value[reviewId] = reports
  } catch (failure) {
    if (current === reportRevision) reviewError.value = failure instanceof Error ? failure.message : '当前账号没有该评价举报的查询权限'
  }
}
async function uploadEvidenceImage(reportId: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const list = evidenceImages.value[reportId] ?? []
  if (!file || list.length >= 6 || uploadingEvidence.value[reportId]) return
  // 先反馈文件问题，再向服务端上传并由服务端校验实际内容。
  if (!file.size || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    reportStatus.value[reportId] = '请选择非空且不超过 5 MiB 的 JPEG、PNG 或 WebP 图片'
    return
  }
  const current = reportRevision
  uploadingEvidence.value[reportId] = true
  reportStatus.value[reportId] = ''
  try {
    const image = await uploadReviewImage(file)
    if (current === reportRevision) evidenceImages.value[reportId] = [...list, image]
  } catch (failure) {
    if (current === reportRevision) reportStatus.value[reportId] = failure instanceof Error ? failure.message : '证据图片上传失败'
  } finally {
    if (current === reportRevision) uploadingEvidence.value[reportId] = false
  }
}
async function submitEvidence(reviewId: string, reportId: string) {
  const current = reportRevision
  if (uploadingEvidence.value[reportId]) return
  const list = evidenceImages.value[reportId] ?? []
  try {
    await addReviewReportEvidence(reportId, { content: evidenceText.value[reportId]?.trim() ?? '', imageIds: list.map(x => x.id) })
    if (current !== reportRevision) return
    reportStatus.value[reportId] = '材料已提交'
    evidenceText.value[reportId] = ''
    evidenceImages.value[reportId] = []
    await loadRelatedReports(reviewId)
  } catch (failure) {
    if (current === reportRevision) reportStatus.value[reportId] = failure instanceof Error ? failure.message : '材料提交失败'
  }
}
// 主页举报入口：管理员不显示，提交后收起表单并提示。
const profileReportOpen = ref(false)
const profileReportMessage = ref('')
async function submitProfileReport(input: ReportInput) {
  const current = reportRevision
  await reportCreatorProfile(String(route.params.id), input)
  if (current === reportRevision) finishProfileReport()
}
function finishProfileReport() {
  profileReportMessage.value = '举报已提交，管理员将核查处理。'
  profileReportOpen.value = false
}
function prepareProfileVerification(input: ReportInput) {
  const current = reportRevision
  return prepareOwnReportVerification('CREATOR_PROFILE', String(route.params.id), input, () => {
    if (current === reportRevision) finishProfileReport()
  })
}
// 公开分页与头像续签保留举报输入。账号资格、会话身份或主页变更时清除私有材料并拒收旧响应。
watch([() => route.params.id, () => auth.session?.userId, () => auth.session?.activeRole, () => auth.session?.roles.join(',')], () => {
  reportRevision++
  reviewError.value = ''
  reportingId.value = ''
  relatedReports.value = {}
  evidenceText.value = {}
  evidenceImages.value = {}
  reportStatus.value = {}
  uploadingEvidence.value = {}
  profileReportOpen.value = false
  profileReportMessage.value = ''
  creator.value = undefined
  works.value = []
  reviews.value = undefined
  void load(1)
  void loadReviews(1)
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { revision++; reviewsRevision++; reportRevision++; clearTimeout(timer) })
</script>
<template>
  <WorkLayout
    class="cf-creator-public"
  >
    <nav aria-label="创作者主页导航">
      <RouterLink
        class="cf-work-back"
        :to="auth.session?.roles.includes('ADMIN') ? '/discover' : '/'"
      >返回作品广场</RouterLink>
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
          referrerpolicy="no-referrer"
          @error="creator.avatarUrl = null"
        ><span
          v-else
          class="creator-public-avatar"
          aria-hidden="true"
        >{{ creator.nickname.slice(0, 1) }}</span>
        <div class="creator-public-identity">
          <h1>{{ creator.nickname }}</h1>
          <p v-if="creatorLocation">
            {{ creatorLocation }}
          </p>
          <p
            v-if="creator.bio"
            class="creator-bio"
          >
            {{ creator.bio }}
          </p><p
            v-if="creator.paused"
            class="field-error"
          >
            创作者暂时停止承接新业务
          </p>
          <div class="creator-public-actions">
            <CreatorFollow :creator-id="creator.id" />
            <RouterLink
              v-if="!creator.paused && creator.id !== auth.session?.userId && !auth.session?.roles.includes('ADMIN')"
              class="button-primary"
              :to="{ path: '/my-requests/new', query: { creatorId: creator.id } }"
            >邀请定制</RouterLink>
            <button
              v-if="creator.id !== auth.session?.userId && !auth.session?.roles.includes('ADMIN')"
              class="inline-button profile-report-toggle"
              :aria-expanded="profileReportOpen"
              @click="profileReportOpen = !profileReportOpen; profileReportMessage = ''"
            >
              {{ profileReportOpen ? '收起主页举报' : '举报主页' }}
            </button>
          </div>
        </div><dl class="creator-public-stats">
          <div><dt>口碑评分</dt><dd>{{ creator.averageRating || '暂无评价' }}</dd></div><div><dt>好评率</dt><dd>{{ creator.positiveRate === null ? '暂无评价' : `${creator.positiveRate}%` }}</dd></div><div><dt>真实评价</dt><dd>{{ creator.reviewCount }}</dd></div><div><dt>已完成订单</dt><dd>{{ creator.completedOrderCount }}</dd></div>
        </dl>
      </section><p
        v-if="profileReportMessage"
        role="status"
      >
        {{ profileReportMessage }}
      </p><ReportDialog
        v-if="profileReportOpen"
        submit-label="提交主页举报"
        :submit-report="submitProfileReport"
        :prepare-verification="prepareProfileVerification"
      /><header class="work-section-heading">
        <h2>手作作品</h2><span class="muted">{{ total }} 件已上架作品</span>
      </header><div
        v-if="!works.length && !loading"
        class="work-empty"
      >
        <p>暂无已上架作品。</p>
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
      <section
        class="creator-reviews"
        aria-label="交易评价"
        :aria-busy="reviewsLoading"
      >
        <header class="work-section-heading">
          <h2>交易评价</h2><span class="muted">{{ creator.reviewCount }} 条有效评价</span>
        </header><p
          v-if="reviewError"
          class="field-help"
          role="status"
        >
          {{ reviewError }}
        </p>
        <p
          v-if="reviewsError"
          class="form-alert"
          role="alert"
        >
          {{ reviewsError }} <button
            class="inline-button"
            type="button"
            @click="loadReviews()"
          >
            重新读取评价
          </button>
        </p>
        <p
          v-if="reviewsLoading && !reviews"
          class="field-help"
          role="status"
        >
          正在读取评价…
        </p>
        <p
          v-else-if="reviews && !reviews.items.length"
          class="muted"
        >
          暂无评价，完成交易后买家可以分享体验。
        </p><article
          v-for="review in reviews?.items"
          :key="review.id"
          class="creator-review-card"
        >
          <header class="creator-review-heading">
            <strong>{{ review.buyerNickname }}</strong><span>{{ review.rating }} 星</span>
            <time :datetime="review.createdAt">{{ formatTime(review.createdAt) }}</time>
          </header>
          <p class="creator-review-content">
            {{ review.content }}
          </p>
          <div
            v-if="review.images.length"
            class="review-images"
          >
            <PrivateImage
              v-for="(image, index) in review.images"
              :key="image.id"
              :image-id="image.id"
              scope="review"
              :label="`订单评价图片 ${index + 1}`"
            />
          </div><button
            v-if="review.canReport && !auth.session?.roles.includes('ADMIN')"
            class="inline-button"
            @click="openReviewReport(review.id)"
          >
            举报评价
          </button><ReportDialog
            v-if="reportingId === review.id"
            :submit-report="input => flagReview(review.id, input)"
            :prepare-verification="input => prepareReviewVerification(review.id, input)"
          />
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
            <RouterLink :to="`/review-reports/${item.id}`">查看举报详情</RouterLink>
            <template v-if="(item.status === 'PENDING' && item.reporterId === auth.session?.userId) || (item.status === 'PROCESSED' && item.reporterId !== auth.session?.userId)">
              <label>{{ item.status === 'PENDING' ? '补充证据' : '处置异议' }}<textarea
                v-model="evidenceText[item.id]"
                maxlength="1000"
              /></label>
              <label>图片<input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                :disabled="uploadingEvidence[item.id] || (evidenceImages[item.id] || []).length >= 6"
                @change="uploadEvidenceImage(item.id, $event)"
              ></label>
              <button
                class="button-primary"
                :disabled="uploadingEvidence[item.id] || (!evidenceText[item.id]?.trim() && !(evidenceImages[item.id] || []).length)"
                @click="submitEvidence(review.id,item.id)"
              >
                提交材料
              </button>
            </template>
            <p
              v-if="reportStatus[item.id]"
              class="field-help"
              role="status"
            >
              {{ reportStatus[item.id] }}
            </p>
          </article>
        </article>
        <WorkPagination
          v-if="reviews"
          :page="reviews.page"
          :size="reviews.size"
          :total="reviews.total"
          :loading="reviewsLoading"
          label="评价分页"
          @change="loadReviews"
        />
      </section>
    </template><p
      v-else-if="loading"
      class="account-loading"
    >
      正在读取创作者…
    </p>
  </WorkLayout>
</template>
