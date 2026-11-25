<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthField from '@/components/AuthField.vue'
import { useAuthStore } from '@/stores/auth'
import { useAuthForm } from '@/composables/useAuthForm'
import { normalizeEmail, safeRedirect, validateEmail, validatePassword } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const form = reactive({ email: '', password: '' })
const { errors, message, submitting, validate, showError } = useAuthForm()
const notice = computed(() => {
  if (route.query.notice === 'registered') return '注册成功，欢迎加入匠心集。请登录你的账号。'
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
    <h1>欢迎回到匠心集</h1>
    <p
      v-if="notice"
      class="craft-auth__feedback"
      role="status"
    >
      {{ notice }}
    </p>
    <form
      class="craft-auth__form"
      novalidate
      :aria-busy="submitting"
      @submit.prevent="submit"
    >
      <AuthField
        v-model="form.email"
        label="邮箱地址"
        type="email"
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
        autocomplete="current-password"
        placeholder="请输入密码"
        :error="errors.password"
        :disabled="submitting"
      />
      <p
        v-if="message"
        class="craft-auth__feedback"
        role="alert"
      >
        {{ message }}
      </p>
      <button
        class="craft-auth__submit"
        type="submit"
        :disabled="submitting"
      >
        {{ submitting ? '正在登录…' : '登录' }}
      </button>
      <p class="craft-auth__note">
        登录状态保留 7 天
      </p>
    </form>
  </AuthLayout>
</template>
