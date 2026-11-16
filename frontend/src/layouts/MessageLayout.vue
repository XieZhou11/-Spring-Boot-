<script setup lang="ts">
import WorkLayout from './WorkLayout.vue'
import AdminLayout from './AdminLayout.vue'
import MessageCenterTabs from '@/components/MessageCenterTabs.vue'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/custom-request.css'

// 消息是独立业务工作区；管理员的系统通知沿用后台外壳。
const auth = useAuthStore()
</script>

<template>
  <component
    :is="auth.session?.roles.includes('ADMIN') ? AdminLayout : WorkLayout"
    :title="auth.session?.roles.includes('ADMIN') ? '系统通知' : undefined"
  >
    <header
      v-if="!auth.session?.roles.includes('ADMIN')"
      class="message-page-heading"
    >
      <h1>消息中心</h1>
    </header>
    <MessageCenterTabs />
    <slot />
  </component>
</template>
