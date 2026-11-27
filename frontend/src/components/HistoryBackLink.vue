<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, type RouteLocationRaw, type RouteLocationResolved } from 'vue-router'
import { useHistoryReturn } from '@/composables/useHistoryReturn'

const props = defineProps<{
  fallback: RouteLocationRaw
  accept: (location: RouteLocationResolved) => boolean
}>()

const router = useRouter()
const { source } = useHistoryReturn()
const destination = computed(() => source(props.accept)?.fullPath ?? props.fallback)

/** 普通点击返回实际历史，修饰键与右键菜单仍可打开对应的业务页。 */
function activate(event: MouseEvent, navigate: (event: MouseEvent) => unknown) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
  if (!source(props.accept)) {
    void navigate(event)
    return
  }
  event.preventDefault()
  router.back()
}
</script>

<template>
  <RouterLink
    v-slot="{ href, navigate }"
    :to="destination"
    replace
    custom
  >
    <a
      :href="href"
      @click="activate($event, navigate)"
    ><slot /></a>
  </RouterLink>
</template>
