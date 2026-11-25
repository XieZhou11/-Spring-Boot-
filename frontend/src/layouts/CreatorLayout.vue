<script setup lang="ts">
import WorkLayout from './WorkLayout.vue'
</script>

<template>
  <WorkLayout>
    <div class="creator-workspace">
      <aside class="work-studio-sidebar">
        <h2>创作者工作台</h2>
        <nav aria-label="创作者工作台">
          <RouterLink
            to="/creator/works"
            active-class="active"
          >我的作品</RouterLink>
          <RouterLink
            to="/requests"
            exact-active-class="active"
          >需求大厅</RouterLink>
          <RouterLink
            to="/creator/invitations"
            active-class="active"
          >收到的邀约</RouterLink>
          <RouterLink
            to="/creator/quotes"
            active-class="active"
          >我的报价</RouterLink>
          <RouterLink
            to="/creator/income"
            active-class="active"
          >收入记录</RouterLink>
          <RouterLink to="/orders?side=CREATOR">承接的订单</RouterLink>
          <RouterLink to="/messages/conversations">需求沟通</RouterLink>
          <RouterLink to="/account/creator-certification">认证资料</RouterLink>
        </nav>
      </aside>
      <section class="creator-workspace-content">
        <slot />
      </section>
    </div>
  </WorkLayout>
</template>

<style scoped>
/* 工作台样式跟随布局，直接打开详情也可加载完整导航。 */
.creator-workspace {
  display: grid;
  grid-template-columns: 192px minmax(0, 1fr);
  align-items: start;
  gap: 24px;
}
.creator-workspace-content { min-width: 0; }
.work-studio-sidebar {
  padding: 16px 12px;
  border: 1px solid var(--craft-border);
  border-radius: 14px;
  background: var(--craft-surface);
}
.work-studio-sidebar h2 {
  margin: 0 8px 12px;
  color: var(--craft-ink);
  font: 650 15px/1.5 var(--craft-font);
}
.work-studio-sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
}
.work-studio-sidebar nav a {
  padding: 9px 10px;
  border-radius: 8px;
  color: var(--craft-muted);
}
.work-studio-sidebar nav a:hover {
  background: #f4f4f5;
  color: var(--craft-ink);
}
.work-studio-sidebar nav a.active {
  background: var(--craft-primary);
  color: var(--craft-surface);
}
.work-studio-sidebar a:focus-visible {
  outline: 2px solid #a15c08;
  outline-offset: 2px;
}
@media (max-width: 920px) {
  .creator-workspace { grid-template-columns: 1fr; gap: 14px; }
  .work-studio-sidebar nav { flex-direction: row; flex-wrap: wrap; }
}
@media (max-width: 720px) {
  .work-studio-sidebar nav a { font-size: 11px; }
}
</style>
