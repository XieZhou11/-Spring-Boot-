<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthField from '@/components/AuthField.vue'
import VerificationCodeButton from '@/components/VerificationCodeButton.vue'
import { resetPassword } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useAuthForm } from '@/composables/useAuthForm'
import { normalizeEmail, validateCode, validateEmail, validatePassword } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const form = reactive({ email: '', verificationCode: '', newPassword: '' })
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
  sentNotice.value = '验证码已发送，请查收最新邮件。5 分钟内有效，使用后即失效。'
}

async function submit() {
  if (submitting.value) return
  if (
    !(await validate({
      email: validateEmail(form.email),
      verificationCode: validateCode(form.verificationCode),
      newPassword: validatePassword(form.newPassword),
    }))
  )
    return
  submitting.value = true
  try {
    await resetPassword({
      email: normalizeEmail(form.email),
      verificationCode: form.verificationCode,
      newPassword: form.newPassword,
    })
    auth.clearSession()
    form.newPassword = ''
    form.verificationCode = ''
    await router.replace({ path: '/login', query: { ...redirectQuery.value, notice: 'reset' } })
  } catch (error) {
    showError(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <h1>设置新的登录密码</h1>
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
      placeholder="请输入已注册的 QQ / 163 邮箱"
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
      v-model="form.newPassword"
      label="新密码"
      type="password"
      autocomplete="new-password"
      hint="8—20 位，包含字母和数字，不能有空格。"
      :error="errors.newPassword"
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
      {{ submitting ? '正在重置…' : '重置密码' }}
    </button>
  </form>
</template>
