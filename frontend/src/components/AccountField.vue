<script setup lang="ts">
import { useId } from 'vue'

/** 个人中心字段统一关联标签、错误与说明，失败后保留原输入。 */
defineProps<{
  label: string
  error?: string
  hint?: string
  readonly?: boolean
  disabled?: boolean
  multiline?: boolean
  inputmode?: 'text' | 'tel'
  autocomplete?: string
}>()
const value = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div
    class="account-field"
    :class="{ 'has-error': error }"
  >
    <label :for="id">{{ label }}</label>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="value"
      rows="5"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error || hint ? `${id}-help` : undefined"
    />
    <input
      v-else
      :id="id"
      v-model="value"
      :readonly="readonly"
      :disabled="disabled"
      :inputmode="inputmode"
      :autocomplete="autocomplete"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error || hint ? `${id}-help` : undefined"
    >
    <p
      v-if="error || hint"
      :id="`${id}-help`"
      class="field-help"
      :class="{ 'field-error': error }"
    >
      {{ error || hint }}
    </p>
  </div>
</template>
