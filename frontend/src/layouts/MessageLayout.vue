<script setup lang="ts">
import { computed } from 'vue'
import WorkLayout from './WorkLayout.vue'
import AdminLayout from './AdminLayout.vue'
import MessageCenterTabs from '@/components/MessageCenterTabs.vue'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/craftflow-messages.css'

defineProps<{ adminTitle?: string }>()

// 前台消息使用同一套页签，管理员的消息入口沿用后台布局。
const auth = useAuthStore()
const isAdmin = computed(() => auth.session?.roles.includes('ADMIN') ?? false)
</script>

<template>
  <component
    :is="isAdmin ? AdminLayout : WorkLayout"
    :title="isAdmin ? (adminTitle ?? '系统通知') : undefined"
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
