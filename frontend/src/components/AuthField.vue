<script setup lang="ts">
import { ref, useId } from 'vue'

/** 标签、提示、错误及密码可见性使用统一的可访问语义。 */
withDefaults(
  defineProps<{
    label: string
    type?: 'text' | 'email' | 'password'
    autocomplete?: string
    placeholder?: string
    error?: string
    hint?: string
    disabled?: boolean
    inputmode?: 'text' | 'email' | 'numeric'
    maxlength?: number
  }>(),
  {
    type: 'text',
    error: '',
    hint: '',
    disabled: false,
    autocomplete: undefined,
    placeholder: undefined,
    inputmode: undefined,
    maxlength: undefined,
  },
)
const value = defineModel<string>({ required: true })
const id = useId()
const visible = ref(false)
</script>

<template>
  <div class="craft-auth__field">
    <label :for="id">{{ label }}</label>
    <div class="craft-auth__field-row">
      <div class="craft-auth__input">
        <input
          :id="id"
          v-model="value"
          :type="type === 'password' && visible ? 'text' : type"
          :autocomplete="autocomplete"
          :placeholder="placeholder"
          :disabled="disabled"
          :inputmode="inputmode"
          :maxlength="maxlength"
          :aria-invalid="Boolean(error)"
          :aria-describedby="error || hint ? `${id}-help` : undefined"
          :spellcheck="false"
          :autocapitalize="type === 'email' ? 'none' : undefined"
        >
        <button
          v-if="type === 'password'"
          type="button"
          class="craft-auth__visibility"
          :aria-label="visible ? `隐藏${label}` : `显示${label}`"
          :aria-pressed="visible"
          :disabled="disabled"
          @click="visible = !visible"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
            <circle
              cx="12"
              cy="12"
              r="3"
            />
            <path
              v-if="visible"
              d="M3 3l18 18"
            />
          </svg>
        </button>
      </div>
      <slot name="suffix" />
    </div>
    <p
      v-if="error || hint"
      :id="`${id}-help`"
      class="craft-auth__field-help"
      :class="{ 'field-error': error }"
    >
      {{ error || hint }}
    </p>
  </div>
</template>
