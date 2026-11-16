<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AccountLayout from '@/layouts/AccountLayout.vue'
import WorkImage from '@/components/WorkImage.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { useAuthStore } from '@/stores/auth'
import { getFavorites, getFollowing, setReaction, setFollow } from '@/api/interaction'
import type { FavoriteWork, FollowedCreator } from '@/types/interaction'
const route = useRoute()
const auth = useAuthStore()
const favoritesMode = computed(() => route.path.endsWith('/favorites'))
const allowed = computed(() => !!auth.session && !auth.session.roles.includes('ADMIN'))
const favorites = ref<FavoriteWork[]>([])
const following = ref<FollowedCreator[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
let revision = 0
let readRevision = 0
let timer: ReturnType<typeof setTimeout> | undefined
async function load(next = page.value) {
  const context = revision
  const current = ++readRevision
  loading.value = true; error.value = ''; clearTimeout(timer)
  if (!allowed.value) { loading.value = false; return }
  try {
    const result = favoritesMode.value ? await getFavorites(next) : await getFollowing(next)
    if (context !== revision || current !== readRevision) return
    // 其他标签取消关系后，刷新或续签应回到最后有效页，避免剩余列表失去入口。
    const lastPage = Math.max(1, Math.ceil(result.total / result.size))
    if (next > lastPage) { await load(lastPage); return }
    if (favoritesMode.value) favorites.value = result.items as FavoriteWork[]
    else following.value = result.items as FollowedCreator[]
    total.value = result.total; page.value = next
    // 列表端点重新核验失效项，避免仅续签图片而遗留失效标题。
    const expiries = favoritesMode.value ? favorites.value.flatMap(v => v.coverImage ? [Date.parse(v.coverImage.expiresAt)] : []) : following.value.flatMap(v => v.avatarExpiresAt ? [Date.parse(v.avatarExpiresAt)] : [])
    if (expiries.length) timer = setTimeout(() => void load(), Math.max(5000, Math.min(...expiries) - Date.now() - 20_000))
  } catch (failure) {
    if (context === revision && current === readRevision) { favorites.value = []; following.value = []; error.value = failure instanceof Error ? failure.message : '列表读取失败' }
  } finally { if (context === revision && current === readRevision) loading.value = false }
}
async function remove(id: string) {
  if (busy.value) return
  const current = revision
  busy.value = true; error.value = ''
  try {
    if (favoritesMode.value) await setReaction(id, 'favorite', false)
    else await setFollow(id, false)
    if (current === revision) await load(page.value > 1 && (favoritesMode.value ? favorites.value.length : following.value.length) === 1 ? page.value - 1 : page.value)
  } catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '取消失败，可重试' }
  finally { if (current === revision) busy.value = false }
}
watch(() => [route.path, auth.session?.userId, auth.session?.activeRole], () => {
  revision++; readRevision++; clearTimeout(timer); favorites.value = []; following.value = []; total.value = 0; busy.value = false
  void load(1)
}, { immediate: true })
onBeforeUnmount(() => { revision++; readRevision++; clearTimeout(timer) })
</script>
<template>
  <AccountLayout
    :title="favoritesMode ? '收藏作品' : '关注创作者'"
    :subtitle="favoritesMode ? '收藏每一份打动你的手作。' : '和喜欢的手艺，保持相遇。'"
    :number="favoritesMode ? '05' : '06'"
  >
    <p
      v-if="!allowed"
      class="form-alert"
    >
      管理员仅可浏览公开内容。
    </p>
    <template v-else>
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
        刷新列表
      </button>
      <p
        v-if="loading"
        role="status"
      >
        正在读取…
      </p>
      <div
        v-if="!loading && !error && !total"
        class="work-empty"
      >
        <h2>{{ favoritesMode ? '还没有收藏作品' : '还没有关注创作者' }}</h2><RouterLink to="/">去发现手作</RouterLink>
      </div>
      <div
        v-if="favoritesMode"
        class="favorite-grid"
      >
        <article
          v-for="item in favorites"
          :key="item.workId"
          class="saved-card"
        >
          <RouterLink
            v-if="item.available"
            :to="`/works/${item.workId}`"
          ><WorkImage
            v-if="item.coverImage"
            :image-id="item.coverImage.id"
            :initial="item.coverImage"
            :label="item.title || '收藏作品'"
          /><h2>{{ item.title }}</h2><p>{{ item.creatorNickname }}</p></RouterLink>
          <div
            v-else
            class="unavailable-work"
          >
            <h2>已下架</h2><p>这件收藏作品暂不可浏览。</p>
          </div>
          <button
            class="inline-button"
            :disabled="busy || loading"
            @click="remove(item.workId)"
          >
            取消收藏
          </button>
        </article>
      </div>
      <div
        v-else
        class="followed-list"
      >
        <article
          v-for="item in following"
          :key="item.creatorId"
          class="saved-card followed-card"
        >
          <RouterLink
            v-if="item.available"
            :to="`/creators/${item.creatorId}`"
          ><img
            v-if="item.avatarUrl"
            :src="item.avatarUrl"
            :alt="`${item.nickname}的头像`"
            @error="item.avatarUrl = null"
          ><div><h2>{{ item.nickname }}</h2><p>{{ item.bio || '这位创作者还未填写简介。' }}</p><p v-if="item.paused">暂时停止承接新业务</p></div></RouterLink>
          <div v-else>
            <h2>创作者暂不可浏览</h2>
          </div>
          <button
            class="inline-button"
            :disabled="busy || loading"
            @click="remove(item.creatorId)"
          >
            取消关注
          </button>
        </article>
      </div>
      <WorkPagination
        :page="page"
        :total="total"
        :loading="loading || busy"
        @change="load"
      />
    </template>
  </AccountLayout>
</template>
<style scoped>
.favorite-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 24px; }.saved-card { border: 1px solid #e5dfd3; padding: 20px; border-radius: 8px; }.saved-card a { color: inherit; text-decoration: none; }.saved-card h2 { font-size: 20px; }.saved-card p { color: #777; line-height: 1.6; }.unavailable-work { min-height: 120px; padding: 24px; background: #f3f0ea; }/* 收藏封面按宽度确定高度，避免继承通用全高样式后挤出正文和取消入口。 */
.saved-card :deep(.work-image) { aspect-ratio: 4/3; height: auto; }.followed-list { margin-top: 24px; display: grid; gap: 16px; }.followed-card, .followed-card a { display: flex; align-items: center; gap: 20px; }.followed-card a { flex: 1; }.followed-card img { width: 72px; height: 72px; object-fit: cover; border-radius: 50%; }
@media (max-width: 640px) { .favorite-grid { grid-template-columns: minmax(0, 1fr); }.followed-card { flex-wrap: wrap; }.followed-card a { min-width: 0; }.followed-card p { overflow-wrap: anywhere; } }
</style>
