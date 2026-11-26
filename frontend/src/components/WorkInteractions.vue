<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import * as api from '@/api/interaction'
import { ApiError } from '@/utils/request'
import type { InteractionStats, WorkComment } from '@/types/interaction'
import type { ImageVO } from '@/types/creator'
import WorkPagination from './WorkPagination.vue'
import CommentImage from './CommentImage.vue'
import ReportDialog from './ReportDialog.vue'
import { reportWork, reportComment } from '@/api/report'
import type { ReportInput } from '@/types/report'
import { prepareOwnReportVerification } from '@/utils/report'
import { imageRenewalDelay } from '@/utils/imageExpiry'
import { useConfirmation } from '@/composables/useConfirmation'

const confirm = useConfirmation()
const props = defineProps<{ workId: string; creatorId: string; actionsTarget: HTMLElement | null }>()
const auth = useAuthStore()
const allowed = computed(() => !!auth.session && !auth.session.roles.includes('ADMIN'))
const stats = ref<InteractionStats>()
const comments = ref<WorkComment[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const busy = ref(false)
const uploading = ref(false)
const content = ref('')
const images = ref<ImageVO[]>([])
const error = ref('')
const reactionError = ref('')
const unknown = ref(false)
const checked = ref(false)
let revision = 0
let readRevision = 0
let timer: ReturnType<typeof setTimeout> | undefined
async function load(next = page.value) {
  const context = revision
  const current = ++readRevision
  loading.value = true; error.value = ''; clearTimeout(timer)
  try {
    const [state, result] = await Promise.all([api.getInteractions(props.workId), api.getComments(props.workId, next)])
    if (context !== revision || current !== readRevision) return
    // 删除或并发变化可能让当前页失效，重新读取最后有效页，保留其余评论的入口。
    const lastPage = Math.max(1, Math.ceil(result.total / result.size))
    if (next > lastPage) { await load(lastPage); return }
    stats.value = state; comments.value = result.items; page.value = next; total.value = result.total
    if (unknown.value) checked.value = true
    // 头像从原评论分页续签，权限失效时一起撤下旧正文与签名。
    const delay = imageRenewalDelay(...result.items.map(comment => comment.avatarExpiresAt))
    if (delay !== undefined) timer = setTimeout(() => void load(), delay)
  } catch (failure) {
    if (context === revision && current === readRevision) { stats.value = undefined; comments.value = []; error.value = failure instanceof Error ? failure.message : '互动读取失败' }
  } finally { if (context === revision && current === readRevision) loading.value = false }
}
async function reaction(kind: 'like' | 'favorite') {
  if (busy.value || !stats.value || !allowed.value) return
  const current = revision
  busy.value = true; reactionError.value = ''
  const active = kind === 'like' ? !stats.value.liked : !stats.value.favorited
  try { await api.setReaction(props.workId, kind, active); if (current === revision) await load() }
  catch (failure) { if (current === revision) reactionError.value = failure instanceof Error ? failure.message : '操作失败，可重试' }
  finally { if (current === revision) busy.value = false }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]; input.value = ''
  if (!file || uploading.value || busy.value || images.value.length >= 3) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { error.value = '请选择不超过5MB的JPG、PNG或WebP图片'; return }
  const current = revision
  uploading.value = true; error.value = ''
  try { const image = await api.uploadCommentImage(file); if (current === revision) images.value.push(image) }
  catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '上传失败' }
  finally { if (current === revision) uploading.value = false }
}
async function submit() {
  if (busy.value || uploading.value || unknown.value || !allowed.value) return
  if (Array.from(content.value.trim()).length < 10 || Array.from(content.value.trim()).length > 500) { error.value = '评论须填写10—500字'; return }
  const current = revision
  busy.value = true; error.value = ''
  try {
    await api.postComment(props.workId, content.value, images.value.map(image => image.id))
    if (current !== revision) return
    content.value = ''; images.value = []; await load(1)
  } catch (failure) {
    if (current !== revision) return
    if (failure instanceof ApiError && failure.status === 0) { unknown.value = true; checked.value = false; error.value = '评论提交结果未知，请先刷新核对评论列表，避免重复发表。' }
    else error.value = failure instanceof Error ? failure.message : '评论发表失败'
  } finally { if (current === revision) busy.value = false }
}
async function remove(id: string) {
  const current = revision
  if (busy.value || !allowed.value) return
  if (!(await confirm({ title: '删除评论？', message: '删除后无法恢复。', confirmLabel: '确认删除' }))) return
  if (current !== revision || busy.value || !allowed.value || !comments.value.some(comment => comment.id === id && comment.canDelete)) return
  busy.value = true; error.value = ''
  try { await api.deleteComment(id); if (current === revision) await load(page.value > 1 && comments.value.length === 1 ? page.value - 1 : page.value) }
  catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '删除失败，可刷新核对后重试' }
  finally { if (current === revision) busy.value = false }
}
// 作品及评论举报入口：'work' 或 'comment:<id>'，提交后提示结果并收起表单。
const reportTarget = ref('')
const reportScope = ref<'work' | 'comment'>('work')
const reportMessage = ref('')
function toggleReport(target: string) {
  reportTarget.value = reportTarget.value === target ? '' : target
  reportScope.value = target === 'work' ? 'work' : 'comment'
  reportMessage.value = ''
}
async function submitReport(input: ReportInput) {
  const target = reportTarget.value
  const current = revision
  if (target === 'work') await reportWork(props.workId, input)
  else if (target.startsWith('comment:')) await reportComment(target.slice('comment:'.length), input)
  else return
  if (current === revision && target === reportTarget.value) finishReport()
}
function finishReport() {
  reportMessage.value = '举报已提交，管理员将核查处理。'
  reportTarget.value = ''
}
function prepareVerification(input: ReportInput) {
  const target = reportTarget.value
  const current = revision
  return prepareOwnReportVerification(target === 'work' ? 'WORK' : 'COMMENT', target === 'work' ? props.workId : target.slice('comment:'.length), input, () => {
    if (current === revision && target === reportTarget.value) finishReport()
  })
}
// 会话对象同账号刷新时保留草稿及未知提交保护，仅实际身份或作品变化才清理。
watch([() => props.workId, () => auth.session?.userId, () => auth.session?.activeRole, () => auth.session?.roles.includes('ADMIN')], () => {
  revision++; readRevision++; clearTimeout(timer)
  stats.value = undefined; comments.value = []; content.value = ''; images.value = []; unknown.value = false; checked.value = false; busy.value = false; uploading.value = false
  reactionError.value = ''
  reportTarget.value = ''; reportMessage.value = ''
  void load(1)
}, { immediate: true })
onBeforeUnmount(() => { revision++; readRevision++; clearTimeout(timer) })
</script>
<template>
  <!-- 右栏互动和左栏评论共用一次读取，避免两处状态在刷新时分离。 -->
  <Teleport
    v-if="actionsTarget"
    :to="actionsTarget"
  >
    <div
      v-if="allowed || stats"
      class="interaction-toolbar"
    >
      <div
        v-if="allowed"
        class="interaction-actions"
        role="group"
        aria-label="作品互动"
      >
        <!-- 将计数放入按钮名称，讲述人聚焦时可同时播报操作和次数。 -->
        <button
          v-if="stats"
          class="button-secondary reaction-like"
          :disabled="busy || loading"
          :aria-label="`${stats.liked ? '取消点赞' : '点赞'} 点赞数 ${stats.likeCount}`"
          :aria-pressed="stats.liked"
          @click="reaction('like')"
        >
          {{ stats.liked ? '取消点赞' : '点赞' }} <span>{{ stats.likeCount }}</span>
        </button>
        <button
          v-if="stats"
          class="button-secondary reaction-favorite"
          :disabled="busy || loading"
          :aria-label="`${stats.favorited ? '取消收藏' : '收藏'} 收藏数 ${stats.favoriteCount}`"
          :aria-pressed="stats.favorited"
          @click="reaction('favorite')"
        >
          {{ stats.favorited ? '取消收藏' : '收藏' }} <span>{{ stats.favoriteCount }}</span>
        </button>
        <button
          v-if="creatorId !== auth.session?.userId"
          class="inline-button work-report-toggle"
          :aria-expanded="reportTarget === 'work'"
          @click="toggleReport('work')"
        >
          举报作品
        </button>
      </div>
      <span
        v-else-if="stats"
        class="muted"
      >{{ stats.likeCount }} 点赞 · {{ stats.favoriteCount }} 收藏</span>
      <p
        v-if="reactionError"
        class="form-alert"
        role="alert"
      >
        {{ reactionError }}
      </p>
      <ReportDialog
        v-if="reportTarget === 'work'"
        :submit-report="submitReport"
        :prepare-verification="prepareVerification"
      />
      <p
        v-if="reportScope === 'work' && reportMessage"
        role="status"
      >
        {{ reportMessage }}
      </p>
    </div>
  </Teleport>
  <section class="work-interactions">
    <header class="work-section-heading">
      <h2>作品公开评论</h2>
      <span
        v-if="stats"
        class="muted"
      >{{ stats.commentCount }} 评论</span>
      <button
        class="inline-button"
        :disabled="loading || busy"
        @click="load()"
      >
        核对评论
      </button>
    </header>
    <p
      v-if="reportScope === 'comment' && reportMessage"
      role="status"
    >
      {{ reportMessage }}
    </p>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
    </p>
    <form
      v-if="allowed"
      class="comment-form"
      @submit.prevent="submit"
    >
      <label for="work-comment">评论内容</label><textarea
        id="work-comment"
        v-model="content"
        rows="4"
        maxlength="1000"
        :disabled="busy || unknown"
        placeholder="请输入 10—500 字"
      />
      <p class="field-help">
        {{ Array.from(content.trim()).length }}/500 · 最多 3 张 JPG、PNG 或 WebP 图片，每张不超过 5 MB
      </p>
      <label class="comment-upload">评论图片<input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :disabled="uploading || busy || unknown || images.length >= 3"
        @change="upload"
      ></label>
      <div
        v-if="images.length"
        class="comment-images"
      >
        <div
          v-for="(image, index) in images"
          :key="image.id"
        >
          <CommentImage
            :image="image"
            :label="`待发布评论图片 ${index + 1}`"
          /><button
            type="button"
            class="inline-button"
            :disabled="busy || unknown"
            @click="images.splice(index, 1)"
          >
            移除图片 {{ index + 1 }}
          </button>
        </div>
      </div>
      <p
        v-if="uploading"
        role="status"
      >
        正在上传图片…
      </p>
      <p
        v-if="unknown"
        class="field-error"
      >
        结果未知，输入和图片已保留。<button
          v-if="checked"
          type="button"
          class="inline-button"
          @click="unknown = false; error = ''"
        >
          已核对列表，确认未发表，允许再次提交
        </button><button
          v-if="checked"
          type="button"
          class="inline-button"
          @click="unknown = false; content = ''; images = []; error = ''"
        >
          已找到评论，开始新评论
        </button>
      </p>
      <button
        type="submit"
        class="button-primary"
        :disabled="busy || uploading || unknown"
      >
        发表评论
      </button>
    </form>
    <p
      v-if="loading && !comments.length"
      class="comment-empty muted"
      role="status"
    >
      正在读取评论…
    </p>
    <p
      v-else-if="!comments.length && stats"
      class="comment-empty muted"
    >
      还没有评论，留下你的第一份共鸣。
    </p>
    <article
      v-for="comment in comments"
      :key="comment.id"
      class="work-comment"
    >
      <div class="comment-heading">
        <img
          v-if="comment.avatarUrl"
          :src="comment.avatarUrl"
          :alt="`${comment.authorNickname}的头像`"
          @error="comment.avatarUrl = null"
        >
        <strong>{{ comment.authorNickname }}</strong>
        <time :datetime="comment.createdAt">{{ new Date(comment.createdAt).toLocaleString('zh-CN') }}</time>
      </div>
      <p class="comment-content">
        {{ comment.content }}
      </p>
      <div
        v-if="comment.images.length"
        class="comment-images"
      >
        <CommentImage
          v-for="(image, index) in comment.images"
          :key="image.id"
          :image="image"
          :label="`评论图片 ${index + 1}`"
        />
      </div>
      <button
        v-if="allowed && comment.canDelete"
        class="inline-button"
        :disabled="busy"
        @click="remove(comment.id)"
      >
        删除评论
      </button>
      <button
        v-if="allowed && !comment.canDelete"
        class="inline-button"
        :aria-expanded="reportTarget === `comment:${comment.id}`"
        @click="toggleReport(`comment:${comment.id}`)"
      >
        举报评论
      </button>
      <p
        v-if="reportTarget === `comment:${comment.id}`"
        class="field-help"
      >
        举报将提交管理员核查，不会直接隐藏该评论。
      </p>
      <ReportDialog
        v-if="reportTarget === `comment:${comment.id}`"
        submit-label="提交评论举报"
        :submit-report="submitReport"
        :prepare-verification="prepareVerification"
      />
    </article>
    <WorkPagination
      label="评论分页"
      :page="page"
      :total="total"
      :loading="loading || busy"
      @change="load"
    />
  </section>
</template>
<style scoped>
.interaction-toolbar { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--craft-border); }
.interaction-toolbar > .muted { color: var(--craft-muted); font-size: 13px; }
.interaction-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.interaction-actions :is(.reaction-like, .reaction-favorite) { padding-inline: 10px; font-variant-numeric: tabular-nums; }
.interaction-actions .reaction-like[aria-pressed=true] { border-color: #fecdd3; background: #fff1f2; color: #9f1239; }
.interaction-actions .reaction-favorite[aria-pressed=true] { border-color: #fde68a; background: #fffbeb; color: #854d0e; }
.interaction-actions .work-report-toggle { margin-inline-start: auto; color: var(--craft-muted); font-size: 13px; }
.interaction-toolbar :deep(.report-dialog), .work-interactions :deep(.report-dialog) { background: var(--craft-bg); border: 1px solid var(--craft-border); }
.work-interactions .work-section-heading { display: flex; justify-content: flex-start; gap: 8px 12px; }
.work-section-heading > .inline-button { margin-inline-start: auto; }
.comment-form { display: grid; gap: 10px; margin: 16px 0; padding: 16px; border: 1px solid var(--craft-border); border-radius: 10px; background: var(--craft-bg); }
.comment-form > label { font-size: 13px; font-weight: 600; }
.comment-form textarea { display: block; box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid var(--craft-border); font: inherit; resize: vertical; }
.comment-form .field-help, .comment-form [role=status] { margin: 0; }
.comment-form .button-primary { justify-self: end; }
.comment-upload input { display: block; width: 100%; max-width: 100%; margin-top: 6px; font-size: 13px; }
.comment-empty { padding: 15px 0; text-align: center; }
.work-comment { padding: 16px 0; border-top: 1px solid var(--craft-border); }
.comment-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 7px 10px; overflow-wrap: anywhere; }
.comment-heading img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.comment-heading time { color: var(--craft-muted); font-size: 12px; }
.comment-content { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; }
.comment-images { display: flex; flex-wrap: wrap; gap: 10px; }
.work-comment .comment-images { margin: 10px 0; }
.comment-images :deep(img) { width: 120px; height: 120px; object-fit: contain; border-radius: 6px; }
</style>
