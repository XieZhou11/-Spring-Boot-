<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthField from '@/components/AuthField.vue'
import AppIcon from '@/components/AppIcon.vue'
import VerificationCodeButton from '@/components/VerificationCodeButton.vue'
import { register } from '@/api/auth'
import { useAuthForm } from '@/composables/useAuthForm'
import {
  normalizeEmail,
  validateCode,
  validateEmail,
  validateNickname,
  validatePassword,
} from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const form = reactive({
  nickname: '',
  email: '',
  verificationCode: '',
  password: '',
  confirmPassword: '',
})
const { errors, message, submitting, validate, showError } = useAuthForm()
const sentNotice = ref('')
const redirectQuery = computed(() =>
  typeof route.query.redirect === 'string' ? { redirect: route.query.redirect } : {},
)
watch(
  () => form.email,
  () => {
    sentNotice.value = ''
    errors.email = ''
  },
)

function codeSent() {
  errors.email = ''
  message.value = ''
  sentNotice.value = '验证码已发送，5 分钟内有效；再次发送后，旧验证码将失效。'
}

/** 确认密码只用于前端一致性检查，注册成功后按需求返回登录。 */
async function submit() {
  if (submitting.value) return
  if (
    !(await validate({
      nickname: validateNickname(form.nickname),
      email: validateEmail(form.email),
      verificationCode: validateCode(form.verificationCode),
      password: validatePassword(form.password),
      confirmPassword: !form.confirmPassword
        ? '请再次输入密码'
        : form.password !== form.confirmPassword
          ? '两次输入的密码不一致'
          : '',
    }))
  )
    return
  submitting.value = true
  try {
    await register({
      nickname: form.nickname.trim(),
      email: normalizeEmail(form.email),
      verificationCode: form.verificationCode,
      password: form.password,
    })
    form.password = ''
    form.confirmPassword = ''
    form.verificationCode = ''
    await router.replace({
      path: '/login',
      query: { ...redirectQuery.value, notice: 'registered' },
    })
  } catch (error) {
    showError(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <div class="auth-form-content registration-content">
      <nav
        class="auth-tabs"
        aria-label="账号入口"
      >
        <RouterLink :to="{ path: '/login', query: redirectQuery }">登录</RouterLink>
        <RouterLink
          :to="{ path: '/register', query: redirectQuery }"
          class="active"
          aria-current="page"
        >注册</RouterLink>
      </nav>
      <div class="form-heading">
        <p class="eyebrow">
          A LITTLE CRAFT, A NEW BEGINNING
        </p>
        <h1>在拾作，遇见手作之美</h1>
        <p>从一个账号开始，收藏你的喜欢。</p>
      </div>
      <form
        class="auth-form"
        novalidate
        :aria-busy="submitting"
        @submit.prevent="submit"
      >
        <AuthField
          v-model="form.nickname"
          label="昵称"
          icon="user"
          autocomplete="nickname"
          placeholder="给自己起个名字，2—8 字"
          :error="errors.nickname"
          :disabled="submitting"
        />
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
          v-model="form.verificationCode"
          label="邮箱验证码"
          icon="code"
          autocomplete="one-time-code"
          inputmode="numeric"
          placeholder="请输入六位验证码"
          :maxlength="6"
          :error="errors.verificationCode"
          :disabled="submitting"
        >
          <template #suffix>
            <VerificationCodeButton
              :email="form.email"
              :disabled="submitting"
              @sending="sentNotice = ''"
              @invalid-email="errors.email = $event"
              @error="message = $event"
              @sent="codeSent"
            />
          </template>
        </AuthField>
        <p
          v-if="sentNotice"
          class="inline-notice"
          role="status"
        >
          {{ sentNotice }}
        </p>
        <AuthField
          v-model="form.password"
          label="密码"
          type="password"
          icon="lock"
          autocomplete="new-password"
          placeholder="8—20 位，包含字母和数字"
          :error="errors.password"
          :disabled="submitting"
        />
        <AuthField
          v-model="form.confirmPassword"
          label="确认密码"
          type="password"
          icon="lock"
          autocomplete="new-password"
          placeholder="请再次输入密码"
          :error="errors.confirmPassword"
          :disabled="submitting"
        />
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
          {{ submitting ? '正在创建账号…' : '注册账号' }}<AppIcon
            v-if="!submitting"
            name="arrow"
          />
        </button>
      </form>
      <p class="form-switch">
        已经有账号？<RouterLink :to="{ path: '/login', query: redirectQuery }">去登录 <span aria-hidden="true">↗</span></RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>
