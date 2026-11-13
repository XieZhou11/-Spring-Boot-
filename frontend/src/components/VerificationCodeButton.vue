<script setup lang="ts">
import { ref, watch } from 'vue'
import { sendVerificationCode } from '@/api/auth'
import { normalizeEmail, validateEmail } from '@/utils/auth'

const props = defineProps<{ email: string; disabled?: boolean }>()
const emit = defineEmits<{
  error: [message: string]
  sent: [email: string]
  invalidEmail: [message: string]
  sending: []
}>()
const sending = ref(false)
const sent = ref(false)
watch(
  () => props.email,
  () => {
    sent.value = false
  },
)

/** 只有 SMTP 发送和落库成功才展示已发送，按钮锁防止重复点击。 */
async function send() {
  if (sending.value || props.disabled) return
  const error = validateEmail(props.email)
  if (error) {
    emit('invalidEmail', error)
    return
  }
  const email = normalizeEmail(props.email)
  sending.value = true
  sent.value = false
  emit('sending')
  emit('error', '')
  try {
    await sendVerificationCode(email)
    // 邮箱字段在发送期间仍可修改，避免把旧邮箱的结果显示给新邮箱。
    if (normalizeEmail(props.email) === email) {
      sent.value = true
      emit('sent', email)
    }
  } catch (error) {
    emit('error', error instanceof Error ? error.message : '发送失败，请稍后重试')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <button
    type="button"
    class="code-button"
    :disabled="sending || disabled"
    :aria-busy="sending"
    @click="send"
  >
    {{ sending ? '发送中…' : sent ? '重新发送' : '发送验证码' }}
  </button>
</template>
