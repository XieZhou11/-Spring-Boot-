<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CreatorLayout from '@/layouts/CreatorLayout.vue'
import AppIcon from '@/components/AppIcon.vue'
import WorkImage from '@/components/WorkImage.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { deleteWork, getManagedWorks, getPublicationQuota, offlineWork, withdrawWork } from '@/api/work'
import type { PublicationQuotaVO, WorkStatus, WorkVO } from '@/types/work'
import { priceLabel, workStatusLabels } from '@/utils/work'
import { formatTime } from '@/utils/creator'
import '@/assets/styles/craftflow-publication.css'
const rows = ref<WorkVO[]>([])
const quota = ref<PublicationQuotaVO>()
const status = ref<WorkStatus | ''>('')
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const busy = ref('')
const error = ref('')
let revision = 0
async function load(next = page.value) {
  const current = ++revision; page.value = next; loading.value = true; error.value = ''
  try {
    const [result, available] = await Promise.all([getManagedWorks({ status: status.value, page: next }), getPublicationQuota()])
    if (current !== revision) return
    // 当前页清空后退回最后一页，避免删除或撤回后停在空页。
    const lastPage = Math.max(1, Math.ceil(result.total / result.size))
    if (next > lastPage) {
      await load(lastPage)
      return
    }
    rows.value = result.items
    total.value = result.total
    quota.value = available
  } catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '作品读取失败' }
  finally { if (current === revision) loading.value = false }
}
/** 库存记录独立于销售开关，关闭直购后仍显示已锁定或已售出。 */
function stockLabel(work: WorkVO) {
  if (work.stockStatus === 'RESERVED') return '已锁定'
  if (work.stockStatus === 'SOLD_OUT') return '已售出'
  if (!work.saleEnabled) return '未开启'
  if (work.purchasable) return '可购买'
  return '已开启'
}

/** 列表动作携带所见版本，失败时提供手动核验入口。 */
async function action(work: WorkVO, type: 'delete' | 'withdraw' | 'offline') {
  if (busy.value) return
  if (!window.confirm(type === 'delete' ? '确定删除这份草稿？' : type === 'withdraw' ? '撤回后可继续修改，确定撤回？' : '下架后将停止公开展示，确定下架？')) return
  busy.value = work.id; error.value = ''
  try {
    if (type === 'delete') await deleteWork(work.id, work.version)
    else if (type === 'withdraw') await withdrawWork(work.id, work.version)
    else await offlineWork(work.id, work.version)
    await load()
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '操作结果未知，请刷新列表核验' }
  finally { busy.value = '' }
}
onMounted(() => { void load(); window.addEventListener('work-updated', refresh) })
function refresh() { void load() }
onBeforeUnmount(() => { revision++; window.removeEventListener('work-updated', refresh) })
</script>
<template>
  <CreatorLayout presentation="craftflow">
    <section class="cf-publication cf-publication-card">
      <header class="cf-publication-heading">
        <div>
          <h1>我的作品</h1>
          <p v-if="quota">
            今日首次提交 <strong>{{ quota.used }} / {{ quota.limit }}</strong> 件，保存草稿和同一作品重提不计入额度。
          </p>
        </div>
        <RouterLink
          class="button-primary"
          to="/creator/works/new"
        >
          <AppIcon name="plus" /> 发布新作品
        </RouterLink>
      </header>
      <div
        v-if="quota && !quota.canPublish"
        class="cf-publication-warning"
      >
        {{ quota.reason }}
      </div>
      <nav
        class="cf-publication-filters"
        aria-label="作品状态"
      >
        <button
          type="button"
          :aria-pressed="!status"
          @click="status = ''; load(1)"
        >
          全部作品
        </button>
        <button
          v-for="(label, key) in workStatusLabels"
          :key="key"
          type="button"
          :aria-pressed="status === key"
          @click="status = key; load(1)"
        >
          {{ label }}
        </button>
      </nav>
      <p
        v-if="error"
        class="form-alert"
        role="alert"
      >
        {{ error }}
        <button
          class="inline-button"
          type="button"
          @click="load()"
        >
          刷新核验
        </button>
      </p>
      <p
        v-if="loading"
        class="cf-publication-state"
        role="status"
      >
        正在读取作品…
      </p>
      <p
        v-else-if="!rows.length && !error"
        class="cf-publication-state"
      >
        {{ status ? '当前状态下暂无作品' : '你还没有作品' }}
      </p>
      <div
        v-else-if="rows.length"
        class="cf-publication-table-wrap"
        role="region"
        aria-label="我的作品列表"
        tabindex="0"
      >
        <table class="cf-publication-table">
          <thead>
            <tr>
              <th scope="col">
                作品
              </th>
              <th scope="col">
                品类
              </th>
              <th scope="col">
                现货销售
              </th>
              <th scope="col">
                接受定制
              </th>
              <th scope="col">
                审核状态
              </th>
              <th scope="col">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="work in rows"
              :key="work.id"
              class="managed-work-row cf-publication-row"
            >
              <td>
                <div class="cf-publication-work">
                  <WorkImage
                    v-if="work.mainImageIds[0]"
                    :image-id="work.mainImageIds[0]"
                    :initial="work.coverImage"
                    :label="work.title ? `${work.title}封面` : '草稿封面'"
                  />
                  <span
                    v-else
                    class="cf-publication-cover-empty"
                    aria-hidden="true"
                  ><AppIcon name="image" /></span>
                  <div>
                    <strong>{{ work.title || '未命名草稿' }}</strong>
                    <small>更新于 {{ formatTime(work.updatedAt) }}</small>
                  </div>
                </div>
              </td>
              <td>{{ work.categoryPath.join(' / ') || '未选择' }}</td>
              <td>
                <strong v-if="work.saleEnabled && work.stockPrice">¥{{ priceLabel(work.stockPrice) }}</strong>
                <small>{{ stockLabel(work) }}</small>
              </td>
              <td>
                <span
                  v-if="work.customEnabled"
                  class="work-status PENDING"
                >{{ work.customReferenceDays ? `${work.customReferenceDays} 个自然日` : '待填写周期' }}</span>
                <small v-else>未开启</small>
              </td>
              <td>
                <span
                  class="work-status"
                  :class="work.reviewStatus"
                >{{ workStatusLabels[work.reviewStatus] }}</span>
                <small
                  v-if="work.reviewReason"
                  class="field-error"
                >{{ work.reviewReason }}</small>
              </td>
              <td>
                <div class="cf-publication-row-actions">
                  <RouterLink
                    class="inline-button"
                    :to="`/creator/works/${work.id}/edit`"
                  >
                    {{ work.reviewStatus === 'PENDING' ? '查看材料' : work.reviewStatus === 'ONLINE' ? '编辑与交易设置' : '编辑作品' }}
                  </RouterLink>
                  <RouterLink
                    v-if="work.reviewStatus === 'ONLINE'"
                    :to="`/works/${work.id}`"
                    class="inline-button"
                  >
                    查看公开页
                  </RouterLink>
                  <button
                    v-if="work.reviewStatus === 'DRAFT'"
                    class="inline-button"
                    type="button"
                    :disabled="Boolean(busy)"
                    @click="action(work, 'delete')"
                  >
                    删除草稿
                  </button>
                  <button
                    v-if="work.reviewStatus === 'PENDING'"
                    class="inline-button"
                    type="button"
                    :disabled="Boolean(busy)"
                    @click="action(work, 'withdraw')"
                  >
                    撤回审核
                  </button>
                  <button
                    v-if="work.reviewStatus === 'ONLINE'"
                    class="inline-button"
                    type="button"
                    :disabled="Boolean(busy)"
                    @click="action(work, 'offline')"
                  >
                    下架
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <WorkPagination
        :page="page"
        :total="total"
        :loading="loading"
        @change="load"
      />
    </section>
  </CreatorLayout>
</template>
