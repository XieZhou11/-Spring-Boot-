<script setup lang="ts">
import { nextTick, ref, useId, watch, watchEffect } from 'vue'
import ElCascader from 'element-plus/es/components/cascader/index'
import type { CascaderOption } from 'element-plus/es/components/cascader-panel/src/types'
import 'element-plus/es/components/cascader/style/css'
import { regionData } from 'element-china-area-data'
import AccountField from '@/components/AccountField.vue'

// 转为组件的开放选项类型，保留地区包原始数据与三级结构。
const options: CascaderOption[] = regionData.map(function toOption(item): CascaderOption {
  return { value: item.value, label: item.label, children: item.children?.map(toOption) }
})

const props = defineProps<{ errors: Record<string, string>; disabled?: boolean }>()
const province = defineModel<string>('province', { required: true })
const city = defineModel<string>('city', { required: true })
const district = defineModel<string>('district', { required: true })
const manual = ref(false)
const selected = ref<string[]>([])
const cascaderElement = ref<HTMLElement>()
const id = useId()

// 当前组件版本不向内部输入透传 aria 属性；在本组件边界补齐标签和错误关联。
watchEffect(() => {
  const input = cascaderElement.value?.querySelector('input')
  if (!input) return
  input.id = id
  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-label', '所在地区')
  input.setAttribute('aria-haspopup', 'tree')
  input.setAttribute('aria-expanded', 'false')
  input.setAttribute('aria-describedby', `${id}-help`)
  input.setAttribute('aria-invalid', String(Boolean(props.errors.province || props.errors.city || props.errors.district)))
})

async function onVisibleChange(visible: boolean) {
  await nextTick()
  cascaderElement.value?.querySelector('input')?.setAttribute('aria-expanded', String(visible))
}

/** 表单存地区名称；回填时查找本地编码，未覆盖地区自动进入手动补全。 */
watch([province, city, district], ([p, c, d]) => {
  const pNode = regionData.find((item) => item.label === p)
  const cNode = pNode?.children?.find((item) => item.label === c)
  const dNode = cNode?.children?.find((item) => item.label === d)
  selected.value = pNode && cNode && dNode ? [pNode.value, cNode.value, dNode.value] : []
  if ((p || c || d) && !dNode) manual.value = true
}, { immediate: true })

function choose(values: unknown) {
  if (!Array.isArray(values) || values.length !== 3) return
  const p = regionData.find((item) => item.value === values[0])
  const c = p?.children?.find((item) => item.value === values[1])
  const d = c?.children?.find((item) => item.value === values[2])
  if (p && c && d) {
    province.value = p.label
    city.value = c.label
    district.value = d.label
  }
}
</script>

<template>
  <fieldset class="region-fieldset">
    <legend>所在地区</legend>
    <div
      v-if="!manual"
      ref="cascaderElement"
      class="account-field"
      :class="{ 'has-error': props.errors.province || props.errors.city || props.errors.district }"
    >
      <ElCascader
        :id="id"
        v-model="selected"
        :options="options"
        :disabled="disabled"
        placeholder="请选择省 / 市 / 区"
        popper-class="cf-address-region-popper"
        aria-label="所在地区"
        :aria-invalid="Boolean(props.errors.province || props.errors.city || props.errors.district)"
        :aria-describedby="`${id}-help`"
        :props="{ expandTrigger: 'click' }"
        @change="choose"
        @visible-change="onVisibleChange"
      />
      <p
        :id="`${id}-help`"
        class="field-help"
        :class="{ 'field-error': props.errors.province || props.errors.city || props.errors.district }"
      >
        {{ props.errors.province || props.errors.city || props.errors.district || '从省到区逐级选择；没有找到的地区可手动填写。' }}
      </p>
    </div>
    <label class="account-checkbox region-toggle"><input
      v-model="manual"
      type="checkbox"
      :disabled="disabled"
    >手动填写省市区</label>
    <div
      v-if="manual"
      class="manual-region"
    >
      <AccountField
        v-model="province"
        label="省 / 自治区 / 直辖市"
        :error="props.errors.province"
        :disabled="disabled"
      />
      <AccountField
        v-model="city"
        label="市"
        :error="props.errors.city"
        :disabled="disabled"
      />
      <AccountField
        v-model="district"
        label="区 / 县"
        :error="props.errors.district"
        :disabled="disabled"
      />
    </div>
  </fieldset>
</template>
