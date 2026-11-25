<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import WorkImage from './WorkImage.vue'
import type { WorkVO } from '@/types/work'
import { priceLabel } from '@/utils/work'
import { getCreator } from '@/api/work'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
const props = defineProps<{ work: WorkVO; presentation?: 'public' }>()
// 缩略图切换只影响当前展示，不改变持久化图片顺序。
const selected = ref(0)
const mainImage = computed(() => props.work.mainImageIds[selected.value] || props.work.mainImageIds[0])
const avatar = ref('')
let avatarTimer: ReturnType<typeof setTimeout> | undefined
let avatarRevision = 0
/** 作者头像同样是私有短时签名，续签失败时使用昵称首字。 */
async function refreshAvatar() {
  const current = ++avatarRevision
  try {
    const profile = await getCreator(props.work.creatorId)
    if (current !== avatarRevision) return
    avatar.value = profile.avatarUrl || ''
    scheduleAvatar(profile.avatarExpiresAt)
  } catch { if (current === avatarRevision) avatar.value = '' }
}
function scheduleAvatar(expiresAt: string | null) {
  clearTimeout(avatarTimer)
  if (expiresAt) avatarTimer = setTimeout(() => void refreshAvatar(), Math.max(5000, Date.parse(expiresAt) - Date.now() - 20_000))
}
watch(() => [props.work.creatorId, props.work.creatorAvatarUrl], () => {
  avatarRevision++
  avatar.value = props.work.creatorAvatarUrl || ''
  scheduleAvatar(props.work.creatorAvatarExpiresAt)
}, { immediate: true })
onBeforeUnmount(() => { avatarRevision++; clearTimeout(avatarTimer) })
</script>
<template>
  <div class="work-detail-grid">
    <div class="work-gallery">
      <WorkImage
        v-if="mainImage"
        :image-id="mainImage"
        :label="work.title || '作品主图'"
      />
      <div
        v-if="presentation !== 'public' || work.mainImageIds.length > 1"
        class="work-thumbnails"
      >
        <button
          v-for="(id, index) in work.mainImageIds"
          :key="id"
          type="button"
          :class="{ selected: selected === index }"
          :aria-label="`查看主图第${index + 1}张`"
          :aria-pressed="selected === index"
          @click="selected = index"
        >
          <WorkImage
            :image-id="id"
            :label="`主图 ${index + 1}`"
          />
        </button>
      </div>
    </div><div class="work-detail-info">
      <p class="eyebrow">
        {{ work.categoryPath.join(' / ') || '未选择品类' }}
      </p><h1>{{ work.title || '未命名作品' }}</h1><p
        v-if="presentation !== 'public'"
        class="work-detail-lead"
      >
        把手作的温度，带进每一天。
      </p><dl class="work-specifications">
        <div><dt>材质</dt><dd>{{ work.material || '未填写' }}</dd></div><div><dt>尺寸规格</dt><dd>{{ work.specification || '未填写' }}</dd></div>
      </dl><section class="trade-summary">
        <h2>作品与交易属性</h2><div>
          <span>现货</span><strong
            v-if="work.saleEnabled"
            class="work-price"
          >¥ {{ priceLabel(work.stockPrice) }}</strong><span v-else>不出售现货</span>
        </div><p
          v-if="work.saleEnabled"
          class="field-help"
        >
          {{ work.stockStatus === 'SOLD_OUT' ? '现货已售出' : work.stockStatus === 'RESERVED' ? '现货已锁定' : work.purchasable ? '当前一件成品可售' : '暂不可直购' }}
        </p><div><span>同类定制</span><span>{{ work.customEnabled ? `参考周期 ${work.customReferenceDays} 个自然日` : '暂不接受定制' }}</span></div><p
          v-if="work.customEnabled"
          class="field-help"
        >
          另行制作，具体价格和工期以独立报价为准。
        </p>
      </section>
      <slot name="trade-actions" />
      <RouterLink
        v-if="work.customizable && work.creatorId !== auth.session?.userId && !auth.session?.roles.includes('ADMIN')"
        class="button-primary"
        :to="{ path: '/my-requests/new', query: { sourceWorkId: work.id } }"
      >发起同类定制 ↗</RouterLink>
      <slot name="interaction-actions" />
      <RouterLink
        :to="`/creators/${work.creatorId}`"
        class="work-creator-link"
      ><img
        v-if="avatar"
        :src="avatar"
        class="creator-initial"
        :alt="`${work.creatorNickname}的头像`"
        @error="avatar = ''"
      ><span
        v-else
        class="creator-initial"
      >{{ work.creatorNickname?.slice(0, 1) }}</span><span><strong>{{ work.creatorNickname }}</strong><small>认证创作者 · 查看主页</small></span><span aria-hidden="true">↗</span></RouterLink><slot name="creator-actions" />
    </div>
  </div>
  <div class="work-prose">
    <section>
      <p
        v-if="presentation !== 'public'"
        class="eyebrow"
      >
        ABOUT THE CRAFT
      </p><h2>作品介绍</h2><p>{{ work.description || '暂无描述' }}</p>
    </section><section v-if="work.specificationImageIds.length">
      <h2>尺寸图</h2><div class="specification-images">
        <WorkImage
          v-for="id in work.specificationImageIds"
          :key="id"
          :image-id="id"
          label="尺寸图"
        />
      </div>
    </section><section v-if="work.processDescription">
      <p
        v-if="presentation !== 'public'"
        class="eyebrow"
      >
        THE MAKING
      </p><h2>制作过程</h2><p>{{ work.processDescription }}</p>
    </section>
  </div>
</template>
