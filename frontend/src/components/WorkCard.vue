<script setup lang="ts">
import { computed } from 'vue'
import WorkImage from './WorkImage.vue'
import type { WorkVO } from '@/types/work'
import { priceLabel } from '@/utils/work'
const props = defineProps<{ work: WorkVO; browsePath?: string }>()
/** 广场的回跳来源保存在浏览器记录中，详情地址可单独访问。 */
const detail = computed(() => ({
  path: '/works/' + props.work.id,
  state: props.browsePath ? { workBrowsePath: props.browsePath } : undefined,
}))
/** 保留不可购买的原因，展示类作品不显示价格。 */
const stockCaption = computed(() => {
  if (props.work.stockStatus === 'SOLD_OUT') return '现货已售出'
  if (props.work.stockStatus === 'RESERVED') return '现货已锁定'
  return props.work.customizable ? '同类定制' : '作品展示'
})
</script>
<template>
  <article class="work-card">
    <div class="work-card-photo">
      <WorkImage
        v-if="work.mainImageIds[0]"
        :image-id="work.mainImageIds[0]"
        :initial="work.coverImage"
        :label="work.title"
      />
      <RouterLink
        :to="detail"
        class="work-card-cover-link"
        :aria-label="'查看' + work.title"
      />
      <span class="work-card-statuses">
        <span
          v-if="work.purchasable"
          class="work-card-status work-card-status-stock"
        >可直购</span>
        <span
          v-else-if="work.stockStatus === 'RESERVED'"
          class="work-card-status"
        >已锁定</span>
        <span
          v-else-if="work.stockStatus === 'SOLD_OUT'"
          class="work-card-status"
        >已售出</span>
        <span
          v-if="work.customizable"
          class="work-card-status work-card-status-custom"
        >接受定制</span>
      </span>
    </div>
    <div class="work-card-body">
      <p class="work-category">
        {{ work.categoryPath.join(' / ') }}
      </p>
      <h3><RouterLink :to="detail">{{ work.title }}</RouterLink></h3>
      <p
        v-if="work.material"
        class="work-card-material"
      >
        {{ work.material }}
      </p>
      <RouterLink
        :to="'/creators/' + work.creatorId"
        class="work-author"
      >{{ work.creatorNickname }} <span aria-hidden="true">↗</span></RouterLink>
      <div class="work-card-bottom">
        <strong
          v-if="work.purchasable"
          class="work-price"
        >¥ {{ priceLabel(work.stockPrice) }}</strong><span
          v-else
          class="muted"
        >{{ stockCaption }}</span>
        <span
          v-if="work.customizable"
          class="muted"
        >约 {{ work.customReferenceDays }} 天</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.work-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--craft-border);
  border-radius: 16px;
  background: var(--craft-surface);
  font-family: var(--craft-font);
  transition: border-color .2s, box-shadow .2s;
}

.work-card:hover {
  transform: none;
  border-color: #d4d4d8;
  box-shadow: 0 6px 16px #18181b0b;
}

.work-card-photo { aspect-ratio: 16 / 9; background: #f4f4f5; }
.work-card-photo :deep(:is(.work-image, .work-image-placeholder)) { background: #f4f4f5; color: var(--craft-muted); }

/* 封面导航和错误重试分别可操作。 */
.work-card-cover-link {
  position: absolute;
  inset: 0;
}

.work-card-cover-link:focus-visible {
  outline-offset: -3px;
}

.work-card-photo :deep(.work-image-error) {
  z-index: 1;
  background: #fffbebf5;
  color: #78350f;
}

.work-card-statuses {
  position: absolute;
  inset: 10px 10px auto auto;
  display: grid;
  justify-items: end;
  gap: 4px;
  pointer-events: none;
}

.work-card-status {
  border: 1px solid var(--craft-border);
  border-radius: 999px;
  background: var(--craft-bg);
  padding: 3px 8px;
  color: #3f3f46;
  font-size: 11px;
  font-weight: 600;
}

.work-card-status-stock { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
.work-card-status-custom { border-color: #fde68a; background: #fffbeb; color: #854d0e; }
.work-card-body { display: flex; flex-direction: column; flex: 1; padding: 16px; }
.work-category, .work-card-material { color: var(--craft-muted); font-size: 12px; }
.work-card h3 { margin: 5px 0 4px; color: var(--craft-ink); font: 600 15px/1.45 var(--craft-font); }
.work-card h3 a { color: inherit; }
.work-card :is(h3 a, .work-author):hover { color: #854d0e; }
.work-card-material { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.work-author { align-self: start; max-width: 100%; margin: 9px 0 13px; color: var(--craft-muted); overflow-wrap: anywhere; }
.work-card-bottom { margin-top: auto; padding-top: 10px; border-color: #f4f4f5; }
.work-card-bottom .muted { color: var(--craft-muted); }
.work-price { color: var(--craft-ink); font: 650 16px var(--craft-font); font-variant-numeric: tabular-nums; }

@media (max-width: 500px) {
  .work-card-body { padding: 10px; }
}
</style>
