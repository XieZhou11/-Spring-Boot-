<script setup lang="ts">
import { computed, ref } from 'vue'
import { getProfile } from '@/api/account'
import { useAuthStore } from '@/stores/auth'
import { imageRenewalDelay } from '@/utils/imageExpiry'
import type { ConversationVO } from '@/types/customRequest'

/** 聊天身份头像：本人头像取个人资料短时签名，对方头像取会话 VO；签名到期自动重读。 */
const props = defineProps<{
  conversation: ConversationVO
  mine: boolean
  label: string
}>()
const auth = useAuthStore()
const mineUrl = ref(''); const mineBroken = ref(false); const otherBroken = ref(false)
let mineRevision = 0; let mineTimer: ReturnType<typeof setTimeout> | undefined

async function refreshMine() {
  const current = ++mineRevision; mineBroken.value = false
  if (!auth.session) { mineUrl.value = ''; return }
  try {
    const profile = await getProfile()
    if (current !== mineRevision) return
    mineUrl.value = profile.avatarUrl || ''
    const delay = imageRenewalDelay(profile.avatarExpiresAt)
    clearTimeout(mineTimer)
    if (delay !== undefined && profile.avatarUrl) mineTimer = setTimeout(() => void refreshMine(), delay)
  } catch { if (current === mineRevision) mineUrl.value = '' }
}
if (props.mine) void refreshMine()

const otherUrl = computed(() => (props.conversation.otherAvatarUrl && !otherBroken.value) ? props.conversation.otherAvatarUrl : '')
const url = computed(() => props.mine ? mineUrl.value : otherUrl.value)
const broken = computed(() => props.mine ? mineBroken.value : otherBroken.value)
const initial = computed(() => (props.mine ? auth.session?.nickname : props.conversation.otherNickname || '客')?.trim().charAt(0) || '客')
</script>
<template>
  <img
    v-if="url && !broken"
    class="chat-avatar"
    :src="url"
    :alt="label"
    referrerpolicy="no-referrer"
    @error="mine ? (mineBroken = true) : (otherBroken = true)"
  >
  <span
    v-else
    class="chat-avatar chat-avatar-fallback"
    aria-hidden="true"
  >{{ initial }}</span>
</template>
