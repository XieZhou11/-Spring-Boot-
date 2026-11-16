<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import WorkCard from '@/components/WorkCard.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getCreator, getWorks } from '@/api/work'
import type { CreatorPublicVO, WorkVO } from '@/types/work'
const route = useRoute()
const creator = ref<CreatorPublicVO>()
const works = ref<WorkVO[]>([])
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
    const [profile, result] = await Promise.all([getCreator(String(route.params.id)), getWorks({ creatorId: String(route.params.id), page: next })])
    if (current !== revision) return
    creator.value = profile; works.value = result.items; total.value = result.total
    if (profile.avatarExpiresAt) timer = setTimeout(() => void load(), Math.max(5000, Date.parse(profile.avatarExpiresAt) - Date.now() - 20_000))
  } catch (failure) { if (current === revision) { creator.value = undefined; error.value = failure instanceof Error ? failure.message : '创作者资料读取失败' } }
  finally { if (current === revision) loading.value = false }
}
watch(() => route.params.id, () => void load(1), { immediate: true })
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
        </div><dl class="creator-public-stats">
          <div><dt>口碑评分</dt><dd>{{ creator.averageRating || '暂无评价' }}</dd></div><div><dt>真实评价</dt><dd>{{ creator.reviewCount }}</dd></div><div><dt>已完成订单</dt><dd>{{ creator.completedOrderCount }}</dd></div>
        </dl>
      </section><header class="work-section-heading">
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
    </template><p
      v-else-if="loading"
      class="account-loading"
    >
      正在读取创作者…
    </p>
  </WorkLayout>
</template>
