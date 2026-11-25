<script setup lang="ts">
import BusinessHeader from '@/components/BusinessHeader.vue'
import AdminLayout from './AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/account.css'
import '@/assets/styles/work.css'
import '@/assets/styles/craftflow-account.css'

defineProps<{ title: string; subtitle?: string; number?: string }>()
const auth = useAuthStore()
</script>

<template>
  <AdminLayout
    v-if="auth.session?.roles.includes('ADMIN')"
    :title="title"
  >
    <div class="craft-account-panel">
      <slot />
    </div>
  </AdminLayout>
  <div
    v-else
    class="member-page account-page craft-account"
  >
    <BusinessHeader />
    <main class="account-shell">
      <aside class="account-sidebar">
        <h2>个人中心</h2>
        <nav aria-label="个人中心">
          <RouterLink
            to="/account/profile"
            active-class="active"
          >个人资料</RouterLink>
          <RouterLink
            to="/account/addresses"
            active-class="active"
          >收货地址</RouterLink>
          <RouterLink
            to="/account/creator-certification"
            active-class="active"
          >创作者入驻</RouterLink>
          <RouterLink
            to="/account/favorites"
            active-class="active"
          >收藏作品</RouterLink>
          <RouterLink
            to="/account/following"
            active-class="active"
          >关注创作者</RouterLink>
        </nav>
      </aside>
      <section class="account-content">
        <header class="account-heading">
          <h1>{{ title }}</h1>
        </header>
        <div class="craft-account-panel">
          <slot />
        </div>
      </section>
    </main>
    <footer class="site-footer">
      <span>匠心集 CraftFlow</span>
    </footer>
  </div>
</template>
