<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthField from '@/components/AuthField.vue'
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
})
const { errors, message, submitting, validate, showError } = useAuthForm()
const sentNotice = ref('')
const sendError = ref('')
const redirectQuery = computed(() =>
  typeof route.query.redirect === 'string' ? { redirect: route.query.redirect } : {},
)
watch(
  () => normalizeEmail(form.email),
  () => {
    sentNotice.value = ''
    sendError.value = ''
    form.verificationCode = ''
    errors.verificationCode = ''
    errors.email = ''
  },
)

function codeSent() {
  errors.email = ''
  message.value = ''
  sendError.value = ''
  form.verificationCode = ''
  errors.verificationCode = ''
  sentNotice.value = '验证码已发送，5 分钟内有效；再次发送后，旧验证码将失效。'
}

/** 使用邮箱验证码完成注册，成功后返回登录页。 */
async function submit() {
  if (submitting.value) return
  if (
    !(await validate({
      nickname: validateNickname(form.nickname),
      email: validateEmail(form.email),
      verificationCode: validateCode(form.verificationCode),
      password: validatePassword(form.password),
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
  <h1>创建匠心集账号</h1>
  <form
    class="craft-auth__form"
    novalidate
    :aria-busy="submitting"
    @submit.prevent="submit"
  >
    <AuthField
      v-model="form.nickname"
      label="昵称"
      autocomplete="nickname"
      placeholder="请输入 2—8 字昵称"
      :error="errors.nickname"
      :disabled="submitting"
    />
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
      v-model="form.verificationCode"
      label="邮箱验证码"
      autocomplete="one-time-code"
      inputmode="numeric"
      placeholder="请输入 6 位数字"
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
          @error="sendError = $event"
          @sent="codeSent"
        />
      </template>
    </AuthField>
    <p
      v-if="sentNotice"
      class="craft-auth__feedback"
      role="status"
    >
      {{ sentNotice }}
    </p>
    <AuthField
      v-model="form.password"
      label="密码"
      type="password"
      autocomplete="new-password"
      hint="8—20 位，包含字母和数字，不能有空格。"
      :error="errors.password"
      :disabled="submitting"
    />
    <p
      v-if="message || sendError"
      class="craft-auth__feedback"
      role="alert"
    >
      {{ sendError || message }}
    </p>
    <button
      class="craft-auth__submit"
      type="submit"
      :disabled="submitting"
    >
      {{ submitting ? '正在创建账号…' : '注册账号' }}
    </button>
  </form>
</template>
