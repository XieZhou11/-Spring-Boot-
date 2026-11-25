<script setup lang="ts">
import BusinessHeader from '@/components/BusinessHeader.vue'
import '@/assets/styles/account.css'
import '@/assets/styles/work.css'
</script>
<template>
  <div class="member-page craft-work-shell">
    <BusinessHeader />
    <main class="work-shell">
      <slot />
    </main>
    <footer class="site-footer">
      <span>匠心集 CraftFlow</span>
    </footer>
  </div>
</template>

<style scoped>
.craft-work-shell {
  background: var(--craft-bg);
  color: var(--craft-ink);
  font-family: var(--craft-font);
}
.craft-work-shell .work-shell {
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 27px 24px 54px;
}
.craft-work-shell .site-footer {
  width: 100%;
  max-width: 1400px;
  padding: 18px 24px;
  margin: 0 auto;
  border-top: 1px solid var(--craft-border);
  color: var(--craft-muted);
}
.craft-work-shell .site-footer span { color: inherit; font: 500 12px var(--craft-font); }
@media (max-width: 600px) {
  .craft-work-shell .work-shell { padding: 20px 16px 36px; }
}
</style>
