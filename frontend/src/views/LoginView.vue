<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthField from '@/components/AuthField.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useAuthForm } from '@/composables/useAuthForm'
import { normalizeEmail, safeRedirect, validateEmail, validatePassword } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const form = reactive({ email: '', password: '' })
const { errors, message, submitting, validate, showError } = useAuthForm()
const redirectQuery = computed(() =>
  typeof route.query.redirect === 'string' ? { redirect: route.query.redirect } : {},
)
const notice = computed(() => {
  if (route.query.notice === 'registered') return '注册成功，欢迎加入拾作。请登录你的账号。'
  if (route.query.notice === 'reset') return '密码已重置，请使用新密码登录。'
  if (route.query.reason === 'expired') return '登录状态已失效，请重新登录。'
  if (route.query.reason === 'connection') return '暂时无法连接服务，请稍后重试。'
  return ''
})

/** 登录成功只使用服务端会话信息，回跳前再次约束站内地址。 */
async function submit() {
  if (submitting.value) return
  if (
    !(await validate({
      email: validateEmail(form.email),
      password: validatePassword(form.password),
    }))
  )
    return
  submitting.value = true
  try {
    await auth.signIn({ email: normalizeEmail(form.email), password: form.password })
    form.password = ''
    const target = safeRedirect(route.query.redirect)
    await router.replace(router.resolve(target).meta.requiresAuth ? target : '/')
  } catch (error) {
    showError(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <div class="auth-form-content">
      <nav
        class="auth-tabs"
        aria-label="账号入口"
      >
        <RouterLink
          :to="{ path: '/login', query: redirectQuery }"
          class="active"
          aria-current="page"
        >登录</RouterLink>
        <RouterLink :to="{ path: '/register', query: redirectQuery }">注册</RouterLink>
      </nav>
      <div class="form-heading">
        <p class="eyebrow">
          WELCOME BACK
        </p>
        <h1>欢迎回到拾作</h1>
        <p>登录账号，继续你的手作之旅。</p>
      </div>
      <p
        v-if="notice"
        class="form-notice"
        role="status"
      >
        {{ notice }}
      </p>
      <form
        class="auth-form"
        novalidate
        :aria-busy="submitting"
        @submit.prevent="submit"
      >
        <AuthField
          v-model="form.email"
          label="邮箱地址"
          type="email"
          icon="mail"
          autocomplete="username"
          inputmode="email"
          placeholder="请输入 QQ / 163 邮箱"
          :error="errors.email"
          :disabled="submitting"
        />
        <AuthField
          v-model="form.password"
          label="密码"
          type="password"
          icon="lock"
          autocomplete="current-password"
          placeholder="请输入密码"
          :error="errors.password"
          :disabled="submitting"
        />
        <div class="form-options">
          <span>登录状态保留 7 天</span><RouterLink :to="{ path: '/forgot-password', query: redirectQuery }">忘记密码？</RouterLink>
        </div>
        <p
          v-if="message"
          class="form-alert"
          role="alert"
        >
          {{ message }}
        </p>
        <button
          class="button-primary submit-button"
          type="submit"
          :disabled="submitting"
        >
          {{ submitting ? '正在登录…' : '登录' }}<AppIcon
            v-if="!submitting"
            name="arrow"
          />
        </button>
      </form>
      <p class="form-switch">
        还没有账号？<RouterLink :to="{ path: '/register', query: redirectQuery }">立即注册 <span aria-hidden="true">↗</span></RouterLink>
      </p>
      <div class="form-footnote">
        <AppIcon name="code" /><span>认真对待每一份创作，也守护你的账号。</span>
      </div>
    </div>
  </AuthLayout>
</template>
