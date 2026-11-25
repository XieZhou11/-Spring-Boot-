<script setup lang="ts">
import AppIcon from './AppIcon.vue'

/** 前台管理员可指定显式浏览入口，其他账号使用默认首页。 */
withDefaults(defineProps<{ to?: string }>(), { to: '/' })
</script>

<template>
  <RouterLink
    :to="to"
    class="craft-brand"
    aria-label="匠心集首页"
  >
    <span class="brand-mark"><AppIcon name="hammer" /></span>
    <span class="brand-name">匠心集<small>CraftFlow</small></span>
  </RouterLink>
</template>

<style scoped>
.craft-brand {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 10px;
  width: fit-content;
  color: inherit;
  font: 650 15px/1.15 var(--craft-font);
}
.brand-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--craft-primary);
  color: var(--craft-accent);
}
.brand-mark .app-icon { width: 18px; height: 18px; }
.brand-name small {
  display: block;
  margin-top: 3px;
  color: inherit;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.11em;
  opacity: 0.72;
  text-transform: uppercase;
}
.craft-brand:focus-visible { outline: 2px solid #b45309; outline-offset: 3px; }
</style>
