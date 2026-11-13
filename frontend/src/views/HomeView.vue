<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BrandLogo from '@/components/BrandLogo.vue'
import AppIcon from '@/components/AppIcon.vue'
import craftScene from '@/assets/craft-scene.svg'

const auth = useAuthStore()
const router = useRouter()
const leaving = ref(false)
const errorMessage = ref('')

/** 本页提供本人会话及个人中心入口；作品发现随对应功能开发。 */
async function signOut() {
  if (leaving.value) return
  leaving.value = true
  errorMessage.value = ''
  try {
    await auth.signOut()
    await router.replace('/login')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '退出失败，请重试'
  } finally {
    leaving.value = false
  }
}
</script>

<template>
  <div class="member-page">
    <header class="site-header">
      <BrandLogo /><button
        class="button-secondary"
        :disabled="leaving"
        @click="signOut"
      >
        <AppIcon name="logout" />{{ leaving ? '正在退出…' : '退出登录' }}
      </button>
    </header>
    <main
      v-if="auth.session"
      class="member-welcome"
    >
      <div>
        <span class="session-badge"><AppIcon name="check" /> 已登录</span>
        <p class="eyebrow">
          NICE TO SEE YOU HERE
        </p>
        <h1>欢迎，{{ auth.session.nickname }}。</h1>
        <p>很高兴在这里遇见你。<br>让手作，成为生活里特别的一部分。</p>
        <p class="member-email">
          {{ auth.session.email }}
        </p>
        <nav
          class="member-account-links"
          aria-label="我的账号"
        >
          <RouterLink
            class="button-primary"
            to="/account/profile"
          >个人资料</RouterLink>
          <RouterLink
            class="button-secondary"
            to="/account/addresses"
          >收货地址</RouterLink>
        </nav>
        <RouterLink
          class="text-link"
          to="/forgot-password"
        >重新设置密码 <span aria-hidden="true">↗</span></RouterLink>
        <p
          v-if="errorMessage"
          class="form-alert"
          role="alert"
        >
          {{ errorMessage }}
        </p>
      </div>
      <img
        :src="craftScene"
        alt="拾作手工作品插画"
        width="660"
        height="390"
      >
    </main>
    <footer class="site-footer">
      <span>拾作 SHIZUO</span><span>好手艺，值得被看见。</span>
    </footer>
  </div>
</template>
