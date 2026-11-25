<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import BrandLogo from '@/components/BrandLogo.vue'
import '@/assets/styles/auth.css'

const route = useRoute()
const router = useRouter()
const tabs = [
  { path: '/login', label: '邮箱登录' },
  { path: '/register', label: '新用户注册' },
  { path: '/forgot-password', label: '找回密码' },
]
const features = ['现货单件管理', '最多 5 位创作者的报价对比', '备料至发货的五节点进度']

// 从深链接进入时，认证页签都保留登录后应返回的目标。
const redirectQuery = computed(() =>
  typeof route.query.redirect === 'string' ? { redirect: route.query.redirect } : {},
)
const loginPath = computed(() => router.resolve({ path: '/login', query: redirectQuery.value }).fullPath)
</script>

<template>
  <main class="craft-auth">
    <div class="craft-auth__card">
      <aside class="craft-auth__intro">
        <div>
          <BrandLogo :to="loginPath" />
          <p class="craft-auth__statement">
            让每一件手工定制，<br>从灵感到交付都清晰可见。
          </p>
        </div>
        <ul class="craft-auth__features">
          <li
            v-for="feature in features"
            :key="feature"
          >
            <AppIcon name="check" />{{ feature }}
          </li>
        </ul>
      </aside>

      <section class="craft-auth__panel">
        <div class="craft-auth__content">
          <nav
            class="craft-auth__tabs"
            aria-label="账号入口"
          >
            <RouterLink
              v-for="tab in tabs"
              :key="tab.path"
              :to="{ path: tab.path, query: redirectQuery }"
            >
              {{ tab.label }}
            </RouterLink>
          </nav>
          <slot />
        </div>
      </section>
    </div>
  </main>
</template>
