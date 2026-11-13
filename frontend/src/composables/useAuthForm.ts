import { nextTick, reactive, ref } from 'vue'
import { ApiError } from '@/utils/request'

/** 各表单保留独立业务提交，复用字段错误、焦点提示和提交锁。 */
export function useAuthForm() {
  const errors = reactive<Record<string, string>>({})
  const message = ref('')
  const submitting = ref(false)

  function clearErrors() {
    for (const key of Object.keys(errors)) delete errors[key]
    message.value = ''
  }

  async function validate(fields: Record<string, string>) {
    clearErrors()
    Object.assign(errors, fields)
    const invalid = Object.values(errors).some(Boolean)
    if (invalid) {
      await nextTick()
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    }
    return !invalid
  }

  function showError(error: unknown) {
    message.value = error instanceof Error ? error.message : '操作失败，请稍后重试'
    if (error instanceof ApiError) Object.assign(errors, error.fieldErrors)
  }

  return { errors, message, submitting, validate, showError }
}
