<script setup lang="ts">
defineProps<{ page: number; total: number; size?: number; loading?: boolean; label?: string }>()
const emit = defineEmits<{ change: [page: number] }>()
</script>
<template>
  <nav
    v-if="total > (size || 20)"
    class="pagination"
    :aria-label="label || '作品分页'"
  >
    <button
      class="button-secondary"
      :disabled="loading || page <= 1"
      @click="emit('change', page - 1)"
    >
      上一页
    </button><span>第 {{ page }} 页 · 共 {{ total }} 条</span><button
      class="button-secondary"
      :disabled="loading || page * (size || 20) >= total"
      @click="emit('change', page + 1)"
    >
      下一页
    </button>
  </nav>
</template>
