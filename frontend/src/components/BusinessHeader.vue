<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BrandLogo from './BrandLogo.vue'
import SessionTools from './SessionTools.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const keyword = ref('')
const leaving = ref(false)
const error = ref('')
/** 网络失败保留当前身份，服务端退出成功后才离开业务页。 */
async function signOut() {
  leaving.value = true
  error.value = ''
  try { await auth.signOut(); await router.replace('/login') }
  catch (failure) { error.value = failure instanceof Error ? failure.message : '退出失败，请重试' }
  finally { leaving.value = false }
}
</script>

<template>
  <header class="site-header business-header">
    <BrandLogo />
    <form
      class="header-search"
      role="search"
      @submit.prevent="router.push({ path: '/', query: keyword.trim() ? { keyword: keyword.trim() } : {} })"
    >
      <input
        v-model="keyword"
        type="search"
        aria-label="搜索作品"
        placeholder="寻找一件心动的手作"
      >
      <button
        type="submit"
        aria-label="搜索"
      >
        ⌕
      </button>
    </form>
    <div class="header-account">
      <SessionTools />
      <RouterLink
        to="/account/profile"
        class="current-account"
      >{{ auth.session?.nickname }} · 个人中心</RouterLink>
      <button
        class="inline-button"
        :disabled="leaving"
        @click="signOut"
      >
        {{ leaving ? '正在退出…' : '退出登录' }}
      </button>
    </div>
    <p
      v-if="error"
      class="field-error"
      role="alert"
    >
      {{ error }}
    </p>
  </header>
</template>
