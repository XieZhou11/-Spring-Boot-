<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AccountLayout from '@/layouts/AccountLayout.vue'
import AccountField from '@/components/AccountField.vue'
import { getProfile, updateProfile, uploadAvatar } from '@/api/account'
import { useAuthForm } from '@/composables/useAuthForm'
import { useAuthStore } from '@/stores/auth'
import { validateNickname } from '@/utils/auth'
import { ApiError } from '@/utils/request'
import type { ProfileVO } from '@/types/account'

const auth = useAuthStore()
const form = reactive({ nickname: '', bio: '' })
const email = ref('')
const loading = ref(true)
const loadError = ref('')
const saved = ref('')
const avatarUrl = ref<string | null>(null)
const avatarExpiresAt = ref<string | null>(null)
const avatarError = ref('')
const avatarNotice = ref('')
const avatarUploading = ref(false)
const selectedAvatarPreview = ref('')
const avatarBroken = ref(false)
const avatarRefreshing = ref(false)
const initials = computed(() => Array.from(form.nickname.trim())[0] || '拾')
const { errors, message, submitting, validate, showError } = useAuthForm()
let expiryTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false
let avatarRevision = 0

/** 本地预览只表达待上传文件，始终与当前绑定头像分开；及时释放浏览器对象地址。 */
function clearAvatarPreview() {
  if (selectedAvatarPreview.value) URL.revokeObjectURL(selectedAvatarPreview.value)
  selectedAvatarPreview.value = ''
}

/** 签名刷新和头像上传仅更新头像，不能覆盖用户尚未保存的昵称、简介。 */
function applyAvatar(profile: ProfileVO) {
  if (disposed) return
  avatarUrl.value = profile.avatarUrl
  avatarExpiresAt.value = profile.avatarExpiresAt
  avatarBroken.value = false
  clearTimeout(expiryTimer)
  const expires = profile.avatarExpiresAt ? Date.parse(profile.avatarExpiresAt) : NaN
  if (profile.avatarUrl && Number.isFinite(expires)) {
    expiryTimer = setTimeout(() => void refreshAvatar(), Math.min(Math.max(expires - Date.now() - 30_000, 1_000), 2_147_000_000))
  }
}

async function refreshAvatar() {
  if (disposed || avatarRefreshing.value || avatarUploading.value) return
  avatarRefreshing.value = true
  const revision = avatarRevision
  try {
    const profile = await getProfile()
    // 新上传开始后，旧续签响应不能把新头像覆盖回去。
    if (revision === avatarRevision) applyAvatar(profile)
  } catch {
    // 访问地址失效时提供文字头像；不影响当前表单输入或资料保存。
    if (!disposed && revision === avatarRevision) avatarBroken.value = true
  } finally {
    avatarRefreshing.value = false
    if (revision !== avatarRevision && avatarExpiresAt.value && Date.parse(avatarExpiresAt.value) - Date.now() <= 30_000) void refreshAvatar()
  }
}

function checkAvatarExpiry() {
  if (avatarExpiresAt.value && Date.parse(avatarExpiresAt.value) <= Date.now()) void refreshAvatar()
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const profile = await getProfile()
    if (disposed) return
    Object.assign(form, { nickname: profile.nickname, bio: profile.bio || '' })
    email.value = profile.email
    applyAvatar(profile)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '资料读取失败，请重试'
  } finally {
    loading.value = false
  }
}

async function save() {
  if (submitting.value) return
  saved.value = ''
  if (!(await validate({ nickname: validateNickname(form.nickname), bio: Array.from(form.bio).length > 200 ? '个人简介最多 200 字' : '' }))) return
  submitting.value = true
  try {
    const profile = await updateProfile({ nickname: form.nickname.trim(), bio: form.bio })
    if (disposed) return
    Object.assign(form, { nickname: profile.nickname, bio: profile.bio || '' })
    if (auth.session) auth.session.nickname = profile.nickname
    saved.value = '资料已保存'
  } catch (error) {
    showError(error)
  } finally {
    submitting.value = false
  }
}

/** 不提前替换图片；服务器成功绑定新头像后才更新显示，失败保留原头像。 */
async function selectAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || avatarUploading.value) return
  avatarError.value = ''
  avatarNotice.value = ''
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    avatarError.value = '请选择 JPEG 或 PNG 格式的头像'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    avatarError.value = '头像大小不能超过 2 MiB'
    return
  }
  avatarRevision++
  clearAvatarPreview()
  selectedAvatarPreview.value = URL.createObjectURL(file)
  avatarUploading.value = true
  try {
    applyAvatar(await uploadAvatar(file))
    avatarNotice.value = '头像已更新'
  } catch (error) {
    if (error instanceof ApiError && (error.status === 0 || error.code === 50321)) {
      // 响应丢失时服务端可能已经保存，重新读取当前头像而不推断上传成功或失败。
      try {
        applyAvatar(await getProfile())
        avatarError.value = '暂时无法确认上传结果，已刷新当前头像，请稍后刷新核对'
      } catch {
        avatarError.value = '暂时无法确认上传结果，请稍后刷新核对'
      }
      return
    }
    avatarError.value = error instanceof ApiError && error.status === 503
      ? '头像上传暂时不可用，请稍后重试'
      : error instanceof Error ? error.message : '头像上传失败，请重试'
  } finally {
    clearAvatarPreview()
    avatarUploading.value = false
    // 上传期间错过的续签计时应补上，失败后仍可继续使用原头像。
    if (avatarExpiresAt.value && Date.parse(avatarExpiresAt.value) - Date.now() <= 30_000) void refreshAvatar()
  }
}

onMounted(() => {
  void load()
  window.addEventListener('focus', checkAvatarExpiry)
})
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(expiryTimer)
  clearAvatarPreview()
  window.removeEventListener('focus', checkAvatarExpiry)
})
</script>

<template>
  <AccountLayout
    title="个人资料"
    subtitle="认真介绍自己，也是一件有温度的小事。"
    number="01"
  >
    <p
      v-if="loading"
      class="account-loading"
      role="status"
    >
      正在读取资料…
    </p>
    <div
      v-else-if="loadError"
      class="account-load-error"
    >
      <p
        class="form-alert"
        role="alert"
      >
        {{ loadError }}
      </p>
      <button
        class="button-secondary"
        @click="load"
      >
        重新读取
      </button>
    </div>
    <template v-else>
      <section
        class="avatar-section"
        aria-label="头像"
      >
        <div class="profile-avatar">
          <img
            v-if="avatarUrl && !avatarBroken"
            :src="avatarUrl"
            alt="当前头像"
            referrerpolicy="no-referrer"
            @error="avatarBroken = true"
          >
          <span
            v-else
            aria-label="默认文字头像"
          >{{ initials }}</span>
        </div>
        <div class="avatar-copy">
          <h2>给相遇，一个熟悉的模样</h2>
          <p>JPEG / PNG 图片，大小不超过 2 MiB</p>
          <label
            class="button-secondary avatar-upload"
            :class="{ 'is-disabled': avatarUploading }"
          >
            {{ avatarUploading ? '正在上传…' : '更换头像' }}
            <input
              class="visually-hidden"
              type="file"
              accept="image/jpeg,image/png"
              aria-label="选择头像文件"
              :disabled="avatarUploading"
              @change="selectAvatar"
            >
          </label>
          <p
            v-if="avatarError"
            class="avatar-feedback field-error"
            role="alert"
          >
            {{ avatarError }}
          </p>
          <p
            v-if="avatarNotice"
            class="avatar-feedback"
            role="status"
          >
            {{ avatarNotice }}
          </p>
          <p
            v-if="avatarBroken"
            class="field-help"
          >
            头像暂时无法显示，可稍后刷新页面。
          </p>
        </div>
        <figure
          v-if="selectedAvatarPreview"
          class="avatar-selected-preview"
        >
          <img
            :src="selectedAvatarPreview"
            alt="所选头像预览"
          >
          <figcaption>所选图片 · 上传中</figcaption>
        </figure>
      </section>
      <form
        class="profile-form"
        novalidate
        :aria-busy="submitting"
        @submit.prevent="save"
      >
        <div class="section-caption">
          <span>基本信息</span><small>YOUR EVERYDAY SIGNATURE</small>
        </div>
        <AccountField
          v-model="form.nickname"
          label="昵称"
          autocomplete="nickname"
          hint="2—8 字，让大家记住你"
          :error="errors.nickname"
          :disabled="submitting"
        />
        <AccountField
          v-model="email"
          label="邮箱地址"
          readonly
          hint="登录邮箱，暂不支持修改"
        />
        <RouterLink
          class="text-link"
          to="/forgot-password"
        >
          重新设置密码 ↗
        </RouterLink>
        <AccountField
          v-model="form.bio"
          label="个人简介"
          multiline
          :hint="`${Array.from(form.bio).length} / 200 字 · 可以留白，也可以分享你的手作故事`"
          :error="errors.bio"
          :disabled="submitting"
        />
        <p
          v-if="message"
          class="form-alert"
          role="alert"
        >
          {{ message }}
        </p>
        <div class="account-form-footer">
          <button
            class="button-primary"
            :disabled="submitting"
          >
            {{ submitting ? '正在保存…' : '保存资料' }} <span aria-hidden="true">↗</span>
          </button>
          <p
            v-if="saved"
            class="save-success"
            role="status"
          >
            ✓ {{ saved }}
          </p>
          <p v-else>
            让每一处改变，都恰如其分。
          </p>
        </div>
      </form>
    </template>
  </AccountLayout>
</template>
