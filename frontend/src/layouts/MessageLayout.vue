<script setup lang="ts">
import { computed } from 'vue'
import WorkLayout from './WorkLayout.vue'
import AdminLayout from './AdminLayout.vue'
import MessageCenterTabs from '@/components/MessageCenterTabs.vue'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/craftflow-messages.css'

// 消息是独立业务工作区；管理员的系统通知沿用后台外壳。
const auth = useAuthStore()
const isAdmin = computed(() => auth.session?.roles.includes('ADMIN') ?? false)
</script>

<template>
  <component
    :is="isAdmin ? AdminLayout : WorkLayout"
    :title="isAdmin ? '系统通知' : undefined"
    presentation="craftflow"
  >
    <div class="craft-messages">
      <header
        v-if="!isAdmin"
        class="message-page-heading"
      >
        <h1>消息中心</h1>
      </header>
      <MessageCenterTabs v-if="!isAdmin" />
      <slot />
    </div>
  </component>
</template>
