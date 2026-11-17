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
