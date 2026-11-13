<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import AccountLayout from '@/layouts/AccountLayout.vue'
import AccountField from '@/components/AccountField.vue'
import AddressRegion from '@/components/AddressRegion.vue'
import { deleteAddress, getAddresses, saveAddress, setDefaultAddress } from '@/api/account'
import { useAuthForm } from '@/composables/useAuthForm'
import type { AddressDTO, AddressVO } from '@/types/account'

const addresses = ref<AddressVO[]>([])
const loading = ref(true)
const loadError = ref('')
const listError = ref('')
const notice = ref('')
const editorOpen = ref(false)
const editingId = ref<string>()
const editingDefault = ref(false)
const busyId = ref('')
const deletion = ref<AddressVO>()
const deletionDialog = ref<HTMLDialogElement>()
const editor = ref<HTMLElement>()
const { errors, message, submitting, validate, showError } = useAuthForm()
const blank = (): AddressDTO => ({ recipientName: '', phone: '', province: '', city: '', district: '', detailAddress: '', isDefault: false })
const form = reactive<AddressDTO>(blank())

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    addresses.value = await getAddresses()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '地址读取失败，请重试'
  } finally {
    loading.value = false
  }
}

async function edit(address?: AddressVO) {
  if (submitting.value || busyId.value) return
  editingId.value = address?.id
  editingDefault.value = address?.isDefault || false
  Object.assign(form, address || blank())
  await validate({})
  notice.value = ''
  editorOpen.value = true
  await nextTick()
  editor.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  editor.value?.querySelector('input')?.focus()
}

/** 保存成功后重读默认排序；读取失败单独提示，避免用户误以为保存未发生。 */
async function refreshList() {
  try {
    addresses.value = await getAddresses()
    const current = addresses.value.find((address) => address.id === editingId.value)
    if (editorOpen.value && current) {
      editingDefault.value = current.isDefault
      if (current.isDefault) form.isDefault = true
    }
  } catch {
    listError.value = '操作已保存，但列表刷新失败，请重新读取地址。'
  }
}

async function save() {
  if (submitting.value) return
  const required = (value: string, name: string, max: number) => !value.trim() ? `请填写${name}` : Array.from(value.trim()).length > max ? `${name}最多 ${max} 字` : ''
  if (!(await validate({
    recipientName: required(form.recipientName, '收件人', 50),
    phone: /^1[3-9]\d{9}$/.test(form.phone.trim()) ? '' : '请输入正确的 11 位手机号',
    province: required(form.province, '省份', 50),
    city: required(form.city, '城市', 50),
    district: required(form.district, '区县', 50),
    detailAddress: required(form.detailAddress, '详细地址', 255),
  }))) return
  submitting.value = true
  listError.value = ''
  try {
    // 明确挑选请求字段，编辑时不把返回编号或额外字段发回服务端。
    await saveAddress({ recipientName: form.recipientName.trim(), phone: form.phone.trim(), province: form.province.trim(), city: form.city.trim(), district: form.district.trim(), detailAddress: form.detailAddress.trim(), isDefault: form.isDefault }, editingId.value)
    editorOpen.value = false
    notice.value = '地址已保存'
    await refreshList()
  } catch (error) {
    showError(error)
  } finally {
    submitting.value = false
  }
}

async function makeDefault(address: AddressVO) {
  if (busyId.value || submitting.value) return
  busyId.value = address.id
  listError.value = ''
  notice.value = ''
  try {
    await setDefaultAddress(address.id)
    notice.value = '默认地址已更新'
    await refreshList()
  } catch (error) {
    listError.value = error instanceof Error ? error.message : '默认地址设置失败，请重试'
  } finally {
    busyId.value = ''
  }
}

function confirmDeletion(address: AddressVO) {
  deletion.value = address
  deletionDialog.value?.showModal()
}

/** 使用原生模态确认框，支持键盘取消、焦点限制并保留失败后的地址。 */
async function remove() {
  if (!deletion.value || busyId.value) return
  busyId.value = deletion.value.id
  listError.value = ''
  notice.value = ''
  try {
    await deleteAddress(deletion.value.id)
    if (editingId.value === deletion.value.id) editorOpen.value = false
    deletionDialog.value?.close()
    deletion.value = undefined
    notice.value = '地址已删除'
    await refreshList()
  } catch (error) {
    listError.value = error instanceof Error ? error.message : '地址删除失败，请重试'
    deletionDialog.value?.close()
  } finally {
    busyId.value = ''
  }
}

onMounted(() => void load())
</script>

<template>
  <AccountLayout
    title="收货地址"
    subtitle="为心爱的手作，留一个妥帖的收件处。"
    number="02"
  >
    <p
      v-if="loading"
      class="account-loading"
      role="status"
    >
      正在读取地址…
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
      </p><button
        class="button-secondary"
        @click="load"
      >
        重新读取
      </button>
    </div>
    <template v-else>
      <div class="address-toolbar">
        <p>已保存 <strong>{{ addresses.length }}</strong> / 10 个地址</p>
        <button
          class="button-primary"
          :disabled="addresses.length >= 10 || Boolean(busyId) || submitting"
          @click="edit()"
        >
          新增地址 <span aria-hidden="true">＋</span>
        </button>
      </div>
      <p
        v-if="addresses.length >= 10"
        class="field-help address-limit"
      >
        地址已达上限，可编辑或删除现有地址。
      </p>
      <p
        v-if="listError"
        class="form-alert"
        role="alert"
      >
        {{ listError }} <button
          class="inline-button"
          @click="load"
        >
          重新读取
        </button>
      </p>
      <p
        v-if="notice"
        class="form-notice"
        role="status"
      >
        {{ notice }}
      </p>
      <div
        v-if="!addresses.length && !editorOpen"
        class="address-empty"
      >
        <span aria-hidden="true">⌂</span><h2>手作的下一站，从这里开始</h2><p>还没有收货地址。第一条地址会自动设为默认。</p>
      </div>
      <div class="address-list">
        <article
          v-for="address in addresses"
          :key="address.id"
          class="address-card"
          :class="{ 'is-default': address.isDefault }"
        >
          <div class="address-card-top">
            <h2>{{ address.recipientName }}</h2><span class="address-phone">{{ address.phone }}</span><span
              v-if="address.isDefault"
              class="default-badge"
            >默认地址</span>
          </div>
          <p class="address-location">
            {{ address.province }} {{ address.city }} {{ address.district }}
          </p>
          <p class="address-detail">
            {{ address.detailAddress }}
          </p>
          <div class="address-actions">
            <button
              v-if="!address.isDefault"
              class="inline-button"
              :disabled="Boolean(busyId) || submitting"
              @click="makeDefault(address)"
            >
              设为默认
            </button>
            <span
              v-else
              class="default-note"
            >优先使用此地址</span>
            <div>
              <button
                class="inline-button"
                :disabled="Boolean(busyId) || submitting"
                @click="edit(address)"
              >
                编辑
              </button><button
                class="inline-button delete-button"
                :disabled="Boolean(busyId) || submitting"
                @click="confirmDeletion(address)"
              >
                删除
              </button>
            </div>
          </div>
        </article>
      </div>
      <section
        v-if="editorOpen"
        ref="editor"
        class="address-editor"
        :aria-label="editingId ? '编辑地址' : '新增地址'"
      >
        <div class="section-caption">
          <span>{{ editingId ? '编辑地址' : '新增地址' }}</span><small>A PLACE FOR SOMETHING SPECIAL</small>
        </div>
        <form
          novalidate
          :aria-busy="submitting"
          @submit.prevent="save"
        >
          <div class="address-contact">
            <AccountField
              v-model="form.recipientName"
              label="收件人"
              autocomplete="name"
              :error="errors.recipientName"
              :disabled="submitting"
            /><AccountField
              v-model="form.phone"
              label="手机号"
              inputmode="tel"
              autocomplete="tel"
              :error="errors.phone"
              :disabled="submitting"
            />
          </div>
          <AddressRegion
            :key="editingId || 'new'"
            v-model:province="form.province"
            v-model:city="form.city"
            v-model:district="form.district"
            :errors="errors"
            :disabled="submitting"
          />
          <AccountField
            v-model="form.detailAddress"
            label="详细地址"
            multiline
            autocomplete="street-address"
            hint="填写街道、门牌号等，最多 255 字"
            :error="errors.detailAddress"
            :disabled="submitting"
          />
          <label class="account-checkbox"><input
            v-model="form.isDefault"
            type="checkbox"
            :disabled="submitting || editingDefault"
          >设为默认地址</label>
          <p class="field-help">
            {{ editingDefault ? '当前默认地址不能单独取消；可在其他地址上设置新的默认地址。' : '第一条地址会自动设为默认；删除默认地址后，自动选用最近新增的地址。' }}
          </p>
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
              {{ submitting ? '正在保存…' : '保存地址' }} <span aria-hidden="true">↗</span>
            </button><button
              class="button-secondary"
              type="button"
              :disabled="submitting"
              @click="editorOpen = false"
            >
              取消
            </button>
          </div>
        </form>
      </section>
      <dialog
        ref="deletionDialog"
        class="delete-dialog"
        aria-labelledby="delete-title"
        :closedby="busyId ? 'none' : 'closerequest'"
        @cancel="busyId && $event.preventDefault()"
      >
        <p class="eyebrow">
          A SMALL CONFIRMATION
        </p><h2 id="delete-title">
          确认删除这个地址？
        </h2><p>收件人：{{ deletion?.recipientName }}</p><p>{{ deletion?.isDefault && addresses.length > 1 ? '删除后，最近新增的剩余地址会自动成为默认地址。' : '删除后可重新添加地址。' }}</p>
        <div>
          <button
            class="button-secondary"
            :disabled="Boolean(busyId)"
            @click="deletionDialog?.close()"
          >
            取消
          </button><button
            class="button-primary"
            :disabled="Boolean(busyId)"
            @click="remove"
          >
            {{ busyId ? '正在删除…' : '确认删除' }}
          </button>
        </div>
      </dialog>
    </template>
  </AccountLayout>
</template>
