<script setup lang="ts">
import BusinessHeader from '@/components/BusinessHeader.vue'
import AdminLayout from './AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/account.css'
import '@/assets/styles/work.css'

defineProps<{ title: string; subtitle: string; number: string }>()
const auth = useAuthStore()
</script>

<template>
  <AdminLayout
    v-if="auth.session?.roles.includes('ADMIN')"
    :title="title"
  >
    <slot />
  </AdminLayout>
  <div
    v-else
    class="member-page account-page"
  >
    <BusinessHeader />
    <main class="account-shell">
      <aside class="account-sidebar">
        <h2>个人中心</h2>
        <nav aria-label="个人中心">
          <RouterLink
            to="/account/profile"
            active-class="active"
          ><span>01</span> 个人资料 <i aria-hidden="true">↗</i></RouterLink>
          <RouterLink
            v-if="!auth.session?.roles.includes('ADMIN')"
            to="/account/addresses"
            active-class="active"
          ><span>02</span> 收货地址 <i aria-hidden="true">↗</i></RouterLink>
          <RouterLink
            v-if="!auth.session?.roles.includes('ADMIN')"
            to="/account/creator-certification"
            active-class="active"
          ><span>03</span> 创作者入驻 <i aria-hidden="true">↗</i></RouterLink>
        </nav>
      </aside>
      <section class="account-content">
        <div class="account-heading">
          <div>
            <h1>{{ title }}</h1>
          </div>
        </div>
        <slot />
      </section>
    </main>
    <footer class="site-footer">
      <span>拾作 SHIZUO</span><span>好手艺，值得被看见。</span>
    </footer>
  </div>
</template>
