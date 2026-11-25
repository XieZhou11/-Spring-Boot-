<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AppIcon from '@/components/AppIcon.vue'
import AccountField from '@/components/AccountField.vue'
import { getCategories, saveCategory } from '@/api/creator'
import type { CategoryVO } from '@/types/creator'
import { useAuthForm } from '@/composables/useAuthForm'

const categories = ref<CategoryVO[]>([])
const loading = ref(true)
const loadError = ref('')
const editor = ref<HTMLDialogElement>()
const editingId = ref<string>()
const parentId = ref('')
const name = ref('')
const sortOrder = ref('0')
const enabled = ref(true)
const notice = ref('')
const { errors, message, submitting, validate, showError } = useAuthForm()

async function load() {
  loading.value = true
  loadError.value = ''
  try { categories.value = await getCategories(true) }
  catch (failure) { loadError.value = failure instanceof Error ? failure.message : '品类读取失败' }
  finally { loading.value = false }
}

/** 编辑不能更改父级，避免已有作品和认证的品类关系被迁移。 */
function openEditor(category?: CategoryVO, parent?: string) {
  editingId.value = category?.id
  parentId.value = category?.parentId || parent || ''
  name.value = category?.name || ''
  sortOrder.value = String(category?.sortOrder || 0)
  enabled.value = category?.enabled ?? true
  message.value = ''
  Object.keys(errors).forEach(key => delete errors[key])
  editor.value?.showModal()
}

async function save() {
  if (submitting.value) return
  if (!(await validate({ name: name.value.trim() ? '' : '请填写品类名称', sortOrder: /^-?\d+$/.test(sortOrder.value) && Number.isInteger(Number(sortOrder.value)) && Number(sortOrder.value) >= -2_147_483_648 && Number(sortOrder.value) <= 2_147_483_647 ? '' : '排序需为有效整数' }))) return
  submitting.value = true
  try {
    await saveCategory({ name: name.value.trim(), sortOrder: Number(sortOrder.value), enabled: enabled.value, ...(!editingId.value ? { parentId: parentId.value || null } : {}) }, editingId.value)
    editor.value?.close()
    notice.value = '品类已保存'
    await load()
  } catch (failure) { showError(failure) }
  finally { submitting.value = false }
}
onMounted(() => void load())
</script>

<template>
  <AdminLayout
    title="手作品类管理"
    presentation="craftflow"
  >
    <template #actions>
      <div class="category-actions">
        <button
          type="button"
          class="button-secondary"
          :disabled="loading"
          @click="load"
        >
          刷新
        </button>
        <button
          type="button"
          class="button-primary"
          :disabled="loading"
          @click="openEditor()"
        >
          <AppIcon name="plus" /> 新增一级品类
        </button>
      </div>
    </template>
    <p
      v-if="notice"
      class="success-note"
      role="status"
    >
      ✓ {{ notice }}
    </p><p
      v-if="loading"
      class="account-loading"
      role="status"
    >
      正在读取品类…
    </p><p
      v-else-if="loadError"
      class="form-alert"
      role="alert"
    >
      {{ loadError }}
    </p><div
      v-else-if="!categories.length"
      class="creator-empty"
    >
      <h2>暂无品类</h2><p>创建一级品类后，可在其下新增二级品类。</p>
    </div>
    <div
      v-else
      class="category-tree"
    >
      <article
        v-for="category in categories"
        :key="category.id"
        class="category-branch"
      >
        <header>
          <div>
            <h2>
              {{ category.name }} <span
                class="status-pill"
                :data-status="category.enabled ? 'APPROVED' : 'WITHDRAWN'"
              >{{ category.enabled ? '启用' : '停用' }}</span>
            </h2>
            <p class="category-order">
              排序 {{ category.sortOrder }}
            </p>
          </div><div class="category-actions">
            <button
              class="inline-button"
              @click="openEditor(category)"
            >
              编辑一级品类
            </button><button
              class="button-secondary"
              @click="openEditor(undefined, category.id)"
            >
              <AppIcon name="plus" /> 新增二级品类
            </button>
          </div>
        </header><p
          v-if="!category.enabled"
          class="field-help"
        >
          父品类已停用，所属二级品类不会出现在用户可选品类中。
        </p><div
          v-if="category.children.length"
          class="category-children"
        >
          <div
            v-for="child in category.children"
            :key="child.id"
          >
            <span>{{ child.name }}</span><span class="category-order">排序 {{ child.sortOrder }}</span><span
              class="status-pill"
              :data-status="child.enabled ? 'APPROVED' : 'WITHDRAWN'"
            >{{ child.enabled ? '启用' : '停用' }}</span><button
              class="inline-button"
              :aria-label="`编辑${child.name}`"
              @click="openEditor(child)"
            >
              编辑
            </button>
          </div>
        </div><p
          v-else
          class="field-help"
        >
          暂无二级品类。
        </p>
      </article>
    </div>
    <dialog
      ref="editor"
      class="delete-dialog category-dialog"
      aria-labelledby="category-editor-title"
      @cancel="submitting && $event.preventDefault()"
    >
      <h2 id="category-editor-title">
        {{ editingId ? '编辑品类' : parentId ? '新增二级品类' : '新增一级品类' }}
      </h2><form
        novalidate
        @submit.prevent="save"
      >
        <div class="account-field">
          <label for="category-parent">所属层级</label><select
            id="category-parent"
            v-model="parentId"
            :disabled="!!editingId || submitting"
          >
            <option value="">
              一级主品类
            </option><option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }} / 二级品类
            </option>
          </select><p
            v-if="editingId"
            class="field-help"
          >
            保存后不能更改所属层级。
          </p>
        </div><AccountField
          v-model="name"
          label="品类名称"
          :error="errors.name"
          :disabled="submitting"
        /><AccountField
          v-model="sortOrder"
          label="展示排序"
          hint="按数字从小到大展示"
          :error="errors.sortOrder"
          :disabled="submitting"
        /><label class="account-checkbox"><input
          v-model="enabled"
          type="checkbox"
          :disabled="submitting"
        >启用品类</label><p class="privacy-note">
          停用品类后不再供新的选择使用。历史申请材料仍保留原品类引用。
        </p><p
          v-if="message"
          class="form-alert"
          role="alert"
        >
          {{ message }}
        </p><div class="dialog-actions">
          <button
            class="button-secondary"
            type="button"
            :disabled="submitting"
            @click="editor?.close()"
          >
            取消
          </button><button
            class="button-primary"
            :disabled="submitting"
          >
            {{ submitting ? '正在保存…' : '保存品类' }}
          </button>
        </div>
      </form>
    </dialog>
  </AdminLayout>
</template>
