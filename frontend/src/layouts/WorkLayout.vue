<script setup lang="ts">
import BusinessHeader from '@/components/BusinessHeader.vue'
import '@/assets/styles/account.css'
import '@/assets/styles/work.css'
</script>
<template>
  <div class="member-page work-page">
    <BusinessHeader />
    <main class="work-shell">
      <slot />
    </main>
    <footer class="site-footer">
      <span>拾作 SHIZUO</span><span>好手艺，值得被看见。</span>
    </footer>
  </div>
</template>
