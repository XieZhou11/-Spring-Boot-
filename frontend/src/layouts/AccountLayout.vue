<script setup lang="ts">
import BusinessHeader from '@/components/BusinessHeader.vue'
import '@/assets/styles/account.css'
import '@/assets/styles/work.css'

defineProps<{ title: string; subtitle: string; number: string }>()
</script>

<template>
  <div class="member-page account-page">
    <BusinessHeader />
    <main class="account-shell">
      <aside class="account-sidebar">
        <p class="eyebrow">
          MY SHIZUO
        </p>
        <h2>个人中心</h2>
        <nav aria-label="个人中心">
          <RouterLink
            to="/account/profile"
            active-class="active"
          ><span>01</span> 个人资料 <i aria-hidden="true">↗</i></RouterLink>
          <RouterLink
            to="/account/addresses"
            active-class="active"
          ><span>02</span> 收货地址 <i aria-hidden="true">↗</i></RouterLink>
          <RouterLink
            to="/account/creator-certification"
            active-class="active"
          ><span>03</span> 创作者入驻 <i aria-hidden="true">↗</i></RouterLink>
          <RouterLink
            to="/account/notifications"
            active-class="active"
          ><span>04</span> 系统通知 <i aria-hidden="true">↗</i></RouterLink>
          <RouterLink
            to="/account/favorites"
            active-class="active"
          ><span>05</span> 收藏作品 <i aria-hidden="true">↗</i></RouterLink>
          <RouterLink
            to="/account/following"
            active-class="active"
          ><span>06</span> 关注创作者 <i aria-hidden="true">↗</i></RouterLink>
        </nav>
        <p class="sidebar-note">
          每一份用心，<br>都有它的归处。
        </p>
        <div
          class="sidebar-stitch"
          aria-hidden="true"
        >
          ✳
        </div>
      </aside>
      <section class="account-content">
        <div class="account-heading">
          <div>
            <p class="eyebrow">
              A LITTLE MORE ABOUT YOU · {{ number }}
            </p><h1>{{ title }}</h1><p>{{ subtitle }}</p>
          </div>
          <span
            class="account-mark"
            aria-hidden="true"
          >拾</span>
        </div>
        <slot />
      </section>
    </main>
    <footer class="site-footer">
      <span>拾作 SHIZUO</span><span>好手艺，值得被看见。</span>
    </footer>
  </div>
</template>
