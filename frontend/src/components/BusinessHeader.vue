<script setup lang="ts">
import { computed, ref } from 'vue'
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
const admin = computed(() => !!auth.session?.roles.includes('ADMIN'))
const creator = computed(() => !!auth.session?.roles.includes('CREATOR'))
const discover = computed(() => admin.value ? '/discover' : '/')
const onPlaza = computed(() => route.path === '/' || route.path === '/discover')
const workSection = computed(() => onPlaza.value || route.path.startsWith('/works/') || route.path.startsWith('/creators/'))
const publishingWork = computed(() => creator.value && auth.session?.activeRole === 'CREATOR')

/** 广场已有完整搜索表单，其他页面可从页头直接开始搜索。 */
function search() {
  const value = keyword.value.trim()
  void router.push({ path: discover.value, query: value ? { keyword: value } : {} })
}

/** 网络失败保留当前身份，服务端退出成功后才离开业务页。 */
async function signOut() {
  leaving.value = true
  error.value = ''
  try {
    await auth.signOut()
    await router.replace('/login')
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : '退出失败，请重试'
  } finally {
    leaving.value = false
  }
}
</script>

<template>
  <header class="craft-header">
    <div class="craft-header-inner">
      <BrandLogo :to="discover" />
      <nav
        class="primary-navigation"
        aria-label="主导航"
      >
        <RouterLink
          :to="discover"
          :class="{ active: workSection }"
        ><AppIcon name="grid" />发现作品</RouterLink>
        <RouterLink
          v-if="!admin"
          to="/my-requests"
          :class="{ active: route.path.startsWith('/my-requests') }"
        >我的需求</RouterLink>
        <RouterLink
          v-if="!admin"
          to="/orders"
          :class="{ active: route.path.startsWith('/orders') }"
        >我的订单</RouterLink>
        <RouterLink
          v-if="creator && !admin"
          to="/requests"
          :class="{ active: route.path === '/requests' }"
        >需求大厅</RouterLink>
        <RouterLink
          v-if="creator && !admin"
          to="/creator/works"
          :class="{ active: route.path.startsWith('/creator/') }"
        >创作者工作台</RouterLink>
        <RouterLink
          v-if="admin"
          to="/admin/dashboard"
        >管理后台</RouterLink>
      </nav>
      <form
        v-if="!onPlaza"
        class="craft-header-search"
        role="search"
        @submit.prevent="search"
      >
        <input
          v-model="keyword"
          type="search"
          aria-label="搜索作品"
          placeholder="搜索作品"
          maxlength="100"
        >
        <button
          type="submit"
          aria-label="搜索"
        >
          <AppIcon name="search" />
        </button>
      </form>
      <div class="craft-header-account">
        <RouterLink
          v-if="onPlaza && !admin"
          :to="publishingWork ? '/creator/works/new' : '/my-requests/new'"
          class="craft-publish"
        >
          <AppIcon name="plus" />{{ publishingWork ? '发布作品' : '发布定制需求' }}
        </RouterLink>
        <SessionTools />
        <RouterLink
          to="/account/profile"
          class="current-account"
          :aria-label="`${auth.session?.nickname || '当前账号'} · 个人中心`"
        >
          <span
            class="account-initial"
            aria-hidden="true"
          >{{ Array.from(auth.session?.nickname || '')[0] }}</span>
          <span class="account-nickname">{{ auth.session?.nickname }}</span>
        </RouterLink>
        <button
          type="button"
          class="craft-logout"
          :disabled="leaving"
          :aria-label="leaving ? '正在退出' : '退出登录'"
          :title="leaving ? '正在退出' : '退出登录'"
          @click="signOut"
        >
          <AppIcon name="logout" />
        </button>
      </div>
      <p
        v-if="error"
        class="field-error craft-header-error"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
  </header>
</template>
