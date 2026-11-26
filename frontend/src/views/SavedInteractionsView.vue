<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AccountLayout from '@/layouts/AccountLayout.vue'
import WorkImage from '@/components/WorkImage.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { useAuthStore } from '@/stores/auth'
import { getFavorites, getFollowing, setReaction, setFollow } from '@/api/interaction'
import type { FavoriteWork, FollowedCreator } from '@/types/interaction'
import { imageRenewalDelay } from '@/utils/imageExpiry'
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
    const expiries = favoritesMode.value
      ? favorites.value.map(work => work.coverImage?.expiresAt)
      : following.value.map(creator => creator.avatarExpiresAt)
    const delay = imageRenewalDelay(...expiries)
    if (delay !== undefined) timer = setTimeout(() => void load(), delay)
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
// 同账号凭证刷新不重置分页及写操作状态，切换账号或列表时仍撤下旧数据。
watch([() => route.path, () => auth.session?.userId, () => auth.session?.activeRole], () => {
  revision++; readRevision++; clearTimeout(timer); favorites.value = []; following.value = []; total.value = 0; busy.value = false
  void load(1)
}, { immediate: true })
onBeforeUnmount(() => { revision++; readRevision++; clearTimeout(timer) })
</script>
<template>
  <AccountLayout :title="favoritesMode ? '收藏作品' : '关注创作者'">
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
      <div class="saved-list-toolbar">
        <span
          v-if="!loading && !error"
          class="muted"
        >{{ favoritesMode ? `${total} 件作品` : `${total} 位创作者` }}</span>
        <span
          v-if="loading"
          role="status"
        >正在读取…</span>
        <button
          class="inline-button"
          :disabled="loading || busy"
          @click="load()"
        >
          刷新列表
        </button>
      </div>
      <div
        v-if="!loading && !error && !total"
        class="saved-empty"
      >
        <h2>{{ favoritesMode ? '还没有收藏作品' : '还没有关注创作者' }}</h2>
        <RouterLink to="/">浏览作品广场</RouterLink>
      </div>
      <div
        v-if="favoritesMode"
        class="favorite-grid"
      >
        <article
          v-for="item in favorites"
          :key="item.workId"
          class="saved-card favorite-card"
        >
          <template v-if="item.available">
            <div
              v-if="item.coverImage"
              class="saved-cover"
            >
              <WorkImage
                :image-id="item.coverImage.id"
                :initial="item.coverImage"
                :label="item.title || '收藏作品'"
              />
              <RouterLink
                class="saved-cover-link"
                :to="`/works/${item.workId}`"
                :aria-label="'查看' + item.title"
              />
            </div>
            <div class="saved-card-copy">
              <h2><RouterLink :to="`/works/${item.workId}`">{{ item.title }}</RouterLink></h2>
              <p v-if="item.creatorNickname">
                {{ item.creatorNickname }}
              </p>
            </div>
          </template>
          <div
            v-else
            class="saved-card-copy unavailable-work"
          >
            <h2>已下架</h2>
          </div>
          <button
            class="inline-button saved-remove"
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
            class="followed-link"
          >
            <img
              v-if="item.avatarUrl"
              class="followed-avatar"
              :src="item.avatarUrl"
              alt=""
              @error="item.avatarUrl = null"
            >
            <span
              v-else
              class="followed-avatar followed-avatar-fallback"
              aria-hidden="true"
            >{{ item.nickname?.slice(0, 1) }}</span>
            <div class="saved-card-copy">
              <h2>{{ item.nickname }}</h2>
              <p v-if="item.bio">{{ item.bio }}</p>
              <span
                v-if="item.paused"
                class="followed-paused"
              >暂时停止承接新业务</span>
            </div>
          </RouterLink>
          <div v-else>
            <h2>创作者暂不可浏览</h2>
          </div>
          <button
            class="inline-button saved-remove"
            :disabled="busy || loading"
            @click="remove(item.creatorId)"
          >
            取消关注
          </button>
        </article>
      </div>
      <WorkPagination
        :label="favoritesMode ? '收藏作品分页' : '关注创作者分页'"
        :page="page"
        :total="total"
        :loading="loading || busy"
        @change="load"
      />
    </template>
  </AccountLayout>
</template>
<style scoped>
.saved-list-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-bottom: 16px; color: var(--craft-muted); font-size: 13px; }
.saved-list-toolbar > button { margin-inline-start: auto; }
.favorite-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 16px; }
.saved-card { min-width: 0; border: 1px solid var(--craft-border); border-radius: 14px; background: var(--craft-surface); }
.saved-card a { color: inherit; text-decoration: none; }
.saved-card a:hover h2, .saved-card h2 a:hover { color: #854d0e; }
.saved-card h2, .saved-empty h2 { margin: 0; color: var(--craft-ink); font: 650 15px var(--craft-font); overflow-wrap: anywhere; }
.saved-card-copy p { margin: 5px 0 0; color: var(--craft-muted); line-height: 1.65; overflow-wrap: anywhere; }
.favorite-card { display: flex; flex-direction: column; align-items: start; padding-bottom: 12px; }
.favorite-card .saved-card-copy { padding: 14px 16px; }
.favorite-card .saved-remove { margin: auto 16px 0; }
/* 用封面比例确定高度，其他内容可随标题换行。 */
.saved-cover { position: relative; width: 100%; }
.saved-cover-link { position: absolute; inset: 0; }
.saved-cover-link:focus-visible { outline-offset: -3px; }
.favorite-card :deep(.work-image) { width: 100%; height: auto; aspect-ratio: 16 / 9; border-radius: 13px 13px 0 0; background: #f4f4f5; }
.favorite-card :deep(.work-image-placeholder) { background: #f4f4f5; color: var(--craft-muted); }
.favorite-card :deep(.work-image-error) { z-index: 1; }
.unavailable-work { margin: 12px; border-radius: 8px; background: #f4f4f5; }
.followed-list { display: grid; gap: 10px; }
.followed-card { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px 16px; padding: 14px 16px; }
.followed-link { flex: 1; min-width: min(100%, 160px); display: flex; align-items: center; gap: 12px; }
.followed-avatar { flex: 0 0 46px; width: 46px; height: 46px; object-fit: cover; border-radius: 50%; }
.followed-avatar-fallback { display: grid; place-items: center; background: #fef3c7; color: #78350f; font-weight: 650; }
.followed-paused { display: inline-block; margin-top: 6px; color: #92400e; font-size: 12px; }
.saved-empty { display: grid; justify-items: center; gap: 10px; padding: 34px 12px; border: 1px dashed var(--craft-border); border-radius: 14px; }
.saved-empty a { color: #854d0e; font-size: 13px; }
</style>
