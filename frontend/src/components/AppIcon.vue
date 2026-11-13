<script setup lang="ts">
/** 认证页面共用的线性图标，不依赖外部字体或网络资源。 */
defineProps<{ name: 'mail' | 'lock' | 'user' | 'code' | 'arrow' | 'check' | 'leaf' | 'logout' }>()
const paths = {
  mail: 'M3 5h18v14H3z M3 6l9 7 9-7',
  lock: 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2 M17 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  code: 'M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z M8 12l3 3 5-6',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  check: 'M5 12l4 4L19 6',
  leaf: 'M20 3C9 2 3 8 6 15s15 6 14-12z M4 21L16 8',
  logout: 'M9 3H4v18h5 M13 7l5 5-5 5 M8 12h12',
}
</script>

<template>
  <svg
    class="app-icon"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name]" />
  </svg>
</template>
