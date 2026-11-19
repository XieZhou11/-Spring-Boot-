<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import * as api from '@/api/interaction'
import { ApiError } from '@/utils/request'
import type { InteractionStats, WorkComment } from '@/types/interaction'
import type { ImageVO } from '@/types/creator'
import WorkPagination from './WorkPagination.vue'
import CommentImage from './CommentImage.vue'
const props = defineProps<{ workId: string }>()
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
    const expiry = result.items.map(c => c.avatarExpiresAt).filter((v): v is string => !!v).map(Date.parse)
    if (expiry.length) timer = setTimeout(() => void load(), Math.max(5000, Math.min(...expiry) - Date.now() - 20_000))
  } catch (failure) {
    if (context === revision && current === readRevision) { stats.value = undefined; comments.value = []; error.value = failure instanceof Error ? failure.message : '互动读取失败' }
  } finally { if (context === revision && current === readRevision) loading.value = false }
}
async function reaction(kind: 'like' | 'favorite') {
  if (busy.value || !stats.value || !allowed.value) return
  const current = revision
  busy.value = true; error.value = ''
  const active = kind === 'like' ? !stats.value.liked : !stats.value.favorited
  try { await api.setReaction(props.workId, kind, active); if (current === revision) await load() }
  catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '操作失败，可重试' }
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
  if (busy.value || !window.confirm('确定删除这条评论吗？')) return
  const current = revision
  busy.value = true; error.value = ''
  try { await api.deleteComment(id); if (current === revision) await load(page.value > 1 && comments.value.length === 1 ? page.value - 1 : page.value) }
  catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '删除失败，可刷新核对后重试' }
  finally { if (current === revision) busy.value = false }
}
// 会话对象同账号刷新时保留草稿及未知提交保护，仅实际身份或作品变化才清理。
watch([() => props.workId, () => auth.session?.userId, () => auth.session?.activeRole], () => {
  revision++; readRevision++; clearTimeout(timer)
  stats.value = undefined; comments.value = []; content.value = ''; images.value = []; unknown.value = false; checked.value = false; busy.value = false; uploading.value = false
  void load(1)
}, { immediate: true })
onBeforeUnmount(() => { revision++; readRevision++; clearTimeout(timer) })
</script>
<template>
  <section class="work-interactions">
    <header class="work-section-heading">
      <h2>手作共鸣</h2><span
        v-if="stats"
        class="muted"
      >{{ stats.likeCount }} 点赞 · {{ stats.favoriteCount }} 收藏 · {{ stats.commentCount }} 评论</span>
    </header>
    <div
      v-if="allowed && stats"
      class="interaction-actions"
    >
      <button
        class="button-secondary"
        :disabled="busy || loading"
        :aria-pressed="stats.liked"
        @click="reaction('like')"
      >
        {{ stats.liked ? '取消点赞' : '点赞' }}
      </button>
      <button
        class="button-secondary"
        :disabled="busy || loading"
        :aria-pressed="stats.favorited"
        @click="reaction('favorite')"
      >
        {{ stats.favorited ? '取消收藏' : '收藏' }}
      </button>
    </div>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
    </p>
    <button
      class="inline-button"
      :disabled="loading || busy"
      @click="load()"
    >
      核对评论
    </button>
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
        placeholder="分享你对这件手作的感受（10—500字）"
      />
      <p class="field-help">
        {{ Array.from(content.trim()).length }}/500 · 最多3张JPG、PNG、WebP图片，每张不超过5MB
      </p>
      <label class="comment-upload">评论图片<input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :disabled="uploading || busy || unknown || images.length >= 3"
        @change="upload"
      ></label>
      <div class="comment-images">
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
      v-if="!comments.length && !loading"
      class="muted"
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
        ><strong>{{ comment.authorNickname }}</strong><time>{{ new Date(comment.createdAt).toLocaleString('zh-CN') }}</time>
      </div>
      <p class="comment-content">
        {{ comment.content }}
      </p><div class="comment-images">
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
    </article>
    <WorkPagination
      :page="page"
      :total="total"
      :loading="loading || busy"
      @change="load"
    />
  </section>
</template>
<style scoped>
.work-interactions { margin-top: 48px; border-top: 1px solid var(--line); padding-top: 32px; }
.interaction-actions, .comment-images { display: flex; flex-wrap: wrap; gap: 14px; margin: 16px 0; }
.comment-form { margin: 24px 0; padding: 24px; background: #f5f2eb; border-radius: 8px; }
.comment-form textarea { display: block; box-sizing: border-box; width: 100%; margin-top: 10px; padding: 12px; border: 1px solid #d9d3c7; border-radius: 4px; font: inherit; resize: vertical; }
.comment-upload { display: block; margin: 16px 0; }.comment-upload input { display: block; width: 100%; max-width: 100%; margin-top: 8px; }
.work-comment { padding: 24px 0; border-bottom: 1px solid #e5dfd3; }.comment-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }.comment-heading img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }.comment-heading time { font-size: 12px; color: #777; }.comment-content { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.8; }
.comment-images :deep(img) { width: 140px; height: 140px; object-fit: contain; border-radius: 4px; }
</style>
