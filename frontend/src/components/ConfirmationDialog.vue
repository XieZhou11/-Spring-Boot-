<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { activeConfirmation, finishConfirmation } from '@/composables/useConfirmation'

const dialog = ref<HTMLDialogElement>()
const cancelButton = ref<HTMLButtonElement>()
const title = useId()
const description = useId()

watch(activeConfirmation, request => {
  if (!dialog.value) return
  if (!request) {
    dialog.value.close()
    return
  }
  dialog.value.showModal()
  cancelButton.value?.focus()
}, { flush: 'post' })

/** 关闭顶层对话框后再归还焦点，保留浏览器原生焦点约束。 */
function complete(confirmed: boolean) {
  dialog.value?.close()
  finishConfirmation(confirmed)
}
</script>

<template>
  <dialog
    ref="dialog"
    class="craft-confirmation"
    :aria-labelledby="title"
    :aria-describedby="description"
    @cancel.prevent="complete(false)"
  >
    <template v-if="activeConfirmation">
      <h2 :id="title">
        {{ activeConfirmation.title }}
      </h2>
      <p :id="description">
        {{ activeConfirmation.message }}
      </p>
      <div class="craft-confirmation__actions">
        <button
          ref="cancelButton"
          type="button"
          class="button-secondary"
          @click="complete(false)"
        >
          取消
        </button>
        <button
          type="button"
          class="button-primary"
          @click="complete(true)"
        >
          {{ activeConfirmation.confirmLabel }}
        </button>
      </div>
    </template>
  </dialog>
</template>

<style scoped>
.craft-confirmation {
  box-sizing: border-box;
  width: min(440px, calc(100% - 32px));
  max-height: calc(100% - 32px);
  padding: 24px;
  overflow: auto;
  border: 1px solid var(--craft-border);
  border-radius: 14px;
  background: var(--craft-surface);
  color: var(--craft-ink);
  font-family: var(--craft-font);
  box-shadow: 0 16px 48px #18181b35;
}
.craft-confirmation::backdrop { background: #18181b66; }
.craft-confirmation h2 { margin: 0 0 8px; font: 650 20px/1.45 var(--craft-font); }
.craft-confirmation p { margin: 0; overflow-wrap: anywhere; }
.craft-confirmation__actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
</style>
