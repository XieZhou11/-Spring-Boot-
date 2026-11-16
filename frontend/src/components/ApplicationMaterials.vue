<script setup lang="ts">
import { computed } from 'vue'
import type { ApplicationVO } from '@/types/creator'
import PrivateApplicationImage from '@/components/PrivateApplicationImage.vue'
import { applicationStatusLabels, formatTime } from '@/utils/creator'

const props = defineProps<{ application: ApplicationVO; previous?: ApplicationVO | null }>()
/** 比较只读取服务端两次申请，保留原始材料和历史结论。 */
const fields = computed(() => {
  const a = props.application
  const p = props.previous
  return [
    { label: '申请人姓名', value: a.realName, old: p?.realName },
    { label: '联系电话', value: a.contactPhone, old: p?.contactPhone },
    { label: '所在地', value: `${a.province} / ${a.city} / ${a.district}`, old: p ? `${p.province} / ${p.city} / ${p.district}` : undefined },
    { label: '主品类', value: a.categories.map(c => c.name).join('、'), old: p?.categories.map(c => c.name).join('、') },
    { label: '从业年限', value: `${a.experienceYears} 年`, old: p ? `${p.experienceYears} 年` : undefined },
    { label: '个人介绍', value: a.introduction, old: p?.introduction },
    { label: '支付宝账号', value: a.alipayAccount, old: p?.alipayAccount },
    { label: '收款人姓名', value: a.payeeName, old: p?.payeeName },
    { label: '补充说明', value: a.supportingDescription || '未提供', old: p ? p.supportingDescription || '未提供' : undefined },
  ]
})
const imagesChanged = computed(() => props.previous && JSON.stringify(props.application.originalWorks.map(w => [w.finishedImageIds, w.processImageIds])) !== JSON.stringify(props.previous.originalWorks.map(w => [w.finishedImageIds, w.processImageIds])))
</script>

<template>
  <div class="application-materials">
    <div class="material-summary">
      <span
        class="status-pill"
        :data-status="application.status"
      >{{ applicationStatusLabels[application.status] }}</span><span>申请编号 {{ application.id }}</span><span>提交于 {{ formatTime(application.submittedAt) }}</span>
    </div>
    <div
      v-if="application.reviewReason"
      class="review-note"
    >
      <strong>审核意见</strong><p>{{ application.reviewReason }}</p><small>{{ formatTime(application.reviewedAt) }}</small>
    </div>
    <p
      v-if="application.withdrawnAt"
      class="field-help"
    >
      撤回于 {{ formatTime(application.withdrawnAt) }}
    </p>
    <p
      v-if="previous"
      class="comparison-note"
    >
      与上次申请 #{{ previous.id }} 比较 · 上次{{ applicationStatusLabels[previous.status] }}<span v-if="previous.reviewReason">：{{ previous.reviewReason }}</span>
    </p>
    <dl class="material-fields">
      <div
        v-for="field in fields"
        :key="field.label"
        :class="{ changed: previous && field.old !== field.value }"
      >
        <dt>
          {{ field.label }} <span
            v-if="previous && field.old !== field.value"
            class="changed-label"
          >已变更</span>
        </dt><dd>{{ field.value }}</dd><dd
          v-if="previous && field.old !== field.value"
          class="previous-value"
        >
          上次：{{ field.old }}
        </dd>
      </div>
    </dl>
    <div class="section-caption">
      <span>原创作品 · {{ application.originalWorks.length }} 件</span><small>PRIVATE PORTFOLIO</small>
    </div>
    <p
      v-if="previous"
      class="comparison-note"
    >
      {{ imagesChanged ? '作品图片已变更，下方保留本次及上次原图供核对。' : '作品图片与上次一致。' }}
    </p>
    <section
      v-for="(work, index) in application.originalWorks"
      :key="index"
      class="material-work"
      :aria-label="`作品 ${index + 1}`"
    >
      <h3>作品 {{ String(index + 1).padStart(2, '0') }}</h3>
      <div class="work-images">
        <PrivateApplicationImage
          v-for="(id, i) in work.finishedImageIds"
          :key="id"
          :image-id="id"
          :label="`作品${index + 1}成品图${i + 1}`"
        /><PrivateApplicationImage
          v-for="(id, i) in work.processImageIds"
          :key="id"
          :image-id="id"
          :label="`作品${index + 1}过程图${i + 1}`"
        />
      </div>
    </section>
    <details
      v-if="previous && imagesChanged"
      class="previous-images"
    >
      <summary>查看上次作品图片</summary><section
        v-for="(work, index) in previous.originalWorks"
        :key="index"
        class="material-work"
      >
        <h3>上次作品 {{ index + 1 }}</h3><div class="work-images">
          <PrivateApplicationImage
            v-for="(id, i) in work.finishedImageIds"
            :key="id"
            :image-id="id"
            :label="`上次作品${index + 1}成品图${i + 1}`"
          /><PrivateApplicationImage
            v-for="(id, i) in work.processImageIds"
            :key="id"
            :image-id="id"
            :label="`上次作品${index + 1}过程图${i + 1}`"
          />
        </div>
      </section>
    </details>
  </div>
</template>
