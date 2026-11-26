<script setup lang="ts">
/** 保留原生日期时间输入格式，起点和终点可独立填写。 */
defineProps<{ label: string }>()
const from = defineModel<string>('from', { required: true })
const to = defineModel<string>('to', { required: true })
</script>

<template>
  <fieldset class="admin-date-range">
    <legend>{{ label }}</legend>
    <div class="admin-date-fields">
      <div class="admin-date-control">
        <input
          v-model="from"
          type="datetime-local"
          :aria-label="`${label}从`"
        >
        <span
          v-if="!from"
          class="admin-date-placeholder"
          aria-hidden="true"
        >开始时间</span>
      </div>
      <span
        class="admin-date-separator"
        aria-hidden="true"
      >至</span>
      <div class="admin-date-control">
        <input
          v-model="to"
          type="datetime-local"
          :aria-label="`${label}至`"
        >
        <span
          v-if="!to"
          class="admin-date-placeholder"
          aria-hidden="true"
        >结束时间</span>
      </div>
    </div>
  </fieldset>
</template>

<style scoped>
.admin-date-range {
  container-type: inline-size;
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--craft-muted);
  font-size: 12px;
  font-weight: 600;
}
.admin-date-range legend { margin-bottom: 4px; padding: 0; }
.admin-date-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}
.admin-date-control { position: relative; min-width: 0; }
.admin-date-control > input {
  width: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid var(--craft-border);
  border-radius: 8px;
  background: var(--craft-surface);
  color: var(--craft-ink);
  font: inherit;
}
.admin-date-placeholder { display: none; }

/* 未填写时显示中文提示，聚焦后使用浏览器原生日期分段和日历。 */
@supports selector(input::-webkit-datetime-edit) {
  .admin-date-control:not(:focus-within):has(.admin-date-placeholder) input::-webkit-datetime-edit {
    color: transparent;
  }
  .admin-date-control:not(:focus-within) .admin-date-placeholder {
    position: absolute;
    inset-inline: 9px 28px;
    top: 50%;
    display: block;
    font-weight: 400;
    white-space: nowrap;
    pointer-events: none;
    transform: translateY(-50%);
  }
}

/* 用筛选区的实际宽度处理窄队列和折叠后的主内容区。 */
@container (max-width: 265px) {
  .admin-date-fields { grid-template-columns: minmax(0, 1fr); }
  .admin-date-separator { display: none; }
}
</style>
