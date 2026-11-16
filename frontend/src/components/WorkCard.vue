<script setup lang="ts">
import WorkImage from './WorkImage.vue'
import type { WorkVO } from '@/types/work'
import { priceLabel } from '@/utils/work'
defineProps<{ work: WorkVO }>()
</script>
<template>
  <article class="work-card">
    <RouterLink
      :to="`/works/${work.id}`"
      class="work-card-photo"
      :aria-label="`查看${work.title}`"
    ><WorkImage
      v-if="work.mainImageIds[0]"
      :image-id="work.mainImageIds[0]"
      :initial="work.coverImage"
      :label="work.title"
    /><span
      v-if="work.customizable"
      class="work-card-tag"
    >接受定制</span></RouterLink>
    <div class="work-card-body">
      <p class="work-category">
        {{ work.categoryPath.join(' / ') }}
      </p><h3><RouterLink :to="`/works/${work.id}`">{{ work.title }}</RouterLink></h3><RouterLink
        :to="`/creators/${work.creatorId}`"
        class="work-author"
      >{{ work.creatorNickname }} <span aria-hidden="true">↗</span></RouterLink><div class="work-card-bottom">
        <strong
          v-if="work.purchasable"
          class="work-price"
        >¥ {{ priceLabel(work.stockPrice) }}</strong><span
          v-else
          class="muted"
        >{{ work.stockStatus === 'SOLD_OUT' ? '现货已售出' : work.customizable ? '同类定制' : '作品展示' }}</span><span
          v-if="work.customizable"
          class="muted"
        >约 {{ work.customReferenceDays }} 天</span>
      </div>
    </div>
  </article>
</template>
