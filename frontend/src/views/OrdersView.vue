<script setup lang="ts">
import OrderCollection from '@/components/OrderCollection.vue'
import WorkLayout from '@/layouts/WorkLayout.vue'
</script>

<template>
  <WorkLayout presentation="craftflow">
    <div class="craftflow-order-workspace">
      <OrderCollection />
      <div class="craftflow-order-empty-selection">
        选择一笔订单查看详情
      </div>
    </div>
  </WorkLayout>
</template>
