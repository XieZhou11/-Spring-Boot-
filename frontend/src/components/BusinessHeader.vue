<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandLogo from './BrandLogo.vue'
import SessionTools from './SessionTools.vue'
import AppIcon from './AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/navigation.css'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
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
    <nav
      class="primary-navigation"
      aria-label="主导航"
    >
      <RouterLink
        :to="auth.session?.roles.includes('ADMIN') ? '/discover' : '/'"
        :class="{ active: route.path === '/' || route.path === '/discover' || route.path.startsWith('/works/') || route.path.startsWith('/creators/') }"
      >发现作品</RouterLink>
      <RouterLink
        v-if="!auth.session?.roles.includes('ADMIN')"
        to="/my-requests"
        active-class="active"
      >我的需求</RouterLink>
      <RouterLink
        v-if="!auth.session?.roles.includes('ADMIN')"
        to="/orders"
        active-class="active"
      >我的订单</RouterLink>
      <RouterLink
        v-if="auth.session?.roles.includes('CREATOR') && !auth.session.roles.includes('ADMIN')"
        to="/requests"
        :class="{ active: route.path === '/requests' }"
      >需求大厅</RouterLink>
      <RouterLink
        v-if="auth.session?.roles.includes('CREATOR') && !auth.session.roles.includes('ADMIN')"
        to="/creator/works"
        :class="{ active: route.path.startsWith('/creator/') }"
      >创作者工作台</RouterLink>
      <RouterLink
        v-if="auth.session?.roles.includes('ADMIN')"
        to="/admin/works"
      >管理后台</RouterLink>
    </nav>
    <form
      class="header-search"
      role="search"
      @submit.prevent="router.push({ path: auth.session?.roles.includes('ADMIN') ? '/discover' : '/', query: keyword.trim() ? { keyword: keyword.trim() } : {} })"
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
        <AppIcon name="search" />
      </button>
    </form>
    <div class="header-account">
      <SessionTools />
      <RouterLink
        to="/account/profile"
        class="current-account"
      ><span
        class="account-initial"
        aria-hidden="true"
      >{{ auth.session?.nickname?.slice(0, 1) }}</span><span>{{ auth.session?.nickname }} · 个人中心</span></RouterLink>
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
