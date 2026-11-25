<script setup lang="ts">
import { useRoute } from 'vue-router'
import RequestCollection from '@/components/RequestCollection.vue'
import CreatorLayout from '@/layouts/CreatorLayout.vue'
import WorkLayout from '@/layouts/WorkLayout.vue'
import { requestListPaths } from '@/utils/customRequest'
import '@/assets/styles/craftflow-publication.css'

defineProps<{ scope: keyof typeof requestListPaths }>()
const route = useRoute()
</script>

<template>
  <WorkLayout
    v-if="scope === 'mine'"
  >
    <div class="cf-request-workspace">
      <RequestCollection
        scope="mine"
        :location="route.fullPath"
      />
      <section
        class="cf-request-main"
        aria-label="需求详情"
      >
        <div class="cf-request-state">
          选择一条需求查看详情
        </div>
      </section>
    </div>
  </WorkLayout>
  <CreatorLayout
    v-else
  >
    <RequestCollection
      :scope="scope"
      :location="route.fullPath"
    />
  </CreatorLayout>
</template>
