<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { getAdminDashboard } from '@/api/admin'
import type { AdminDashboardVO } from '@/types/admin'

const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
const from = ref(day()); const to = ref(day()); const data = ref<AdminDashboardVO>(); const error = ref(''); const loading = ref(false)
const workLabels: Record<string,string> = { DRAFT:'草稿', PENDING:'待审核', ONLINE:'已上架', REJECTED:'已驳回', OFFLINE:'已下架' }
const requestLabels: Record<string,string> = { DRAFT:'草稿', OPEN:'开放中', QUOTING:'报价中', AWARDED:'已定标', IN_TRADE:'交易中', COMPLETED:'已完成', CLOSED:'已关闭', EXPIRED:'已过期' }
const todoLabels: Record<string,string> = { creatorApplications:'入驻审核', works:'作品审核', reports:'待处理举报', refunds:'待处理售后' }
async function load(){ loading.value=true;error.value='';try{data.value=await getAdminDashboard({from:from.value,to:to.value})}catch(e){error.value=e instanceof Error?e.message:'看板读取失败'}finally{loading.value=false} }
onMounted(()=>void load())
</script>

<template>
  <AdminLayout title="数据看板" subtitle="平台业务与模拟资金实时汇总。">
    <form class="request-filters" @submit.prevent="load">
      <label>新增统计起始日<input v-model="from" type="date" required></label>
      <label>新增统计结束日<input v-model="to" type="date" required></label>
      <button class="button-secondary" :disabled="loading">{{ loading ? '正在更新…' : '更新看板' }}</button>
    </form>
    <p v-if="error" class="form-alert" role="alert">{{ error }}</p>
    <template v-if="data">
      <p class="dashboard-updated">新增统计：{{ data.from }} 至 {{ data.to }} · 更新于 {{ new Date(data.updatedAt).toLocaleString('zh-CN') }}</p>
      <section class="dashboard-cards" aria-label="平台总览">
        <article><span>用户总数</span><strong>{{ data.userTotal }}</strong><small>所选期间新增 {{ data.newUsers }}</small></article>
        <article><span>认证创作者</span><strong>{{ data.certifiedCreators }}</strong><small>所选期间新增 {{ data.newCertifiedCreators }}</small></article>
        <article><span>模拟支付</span><strong>¥ {{ data.paymentAmount }}</strong><small>成功支付流水累计</small></article>
        <article><span>模拟退款</span><strong>¥ {{ data.refundAmount }}</strong><small>成功全额退款累计</small></article>
        <article><span>待结算金额</span><strong>¥ {{ data.pendingSettlementAmount }}</strong><small>当前待结算</small></article>
        <article><span>已结算金额</span><strong>¥ {{ data.settledAmount }}</strong><small>成功模拟结算累计</small></article>
      </section>
      <section class="dashboard-columns">
        <article class="dashboard-panel"><h2>作品（{{ Object.values(data.works).reduce((a,b)=>a+b,0) }}）</h2><dl><div v-for="(count,key) in data.works" :key="key"><dt>{{ workLabels[key] || key }}</dt><dd>{{ count }}</dd></div></dl></article>
        <article class="dashboard-panel"><h2>定制需求（{{ Object.values(data.requests).reduce((a,b)=>a+b,0) }}）</h2><dl><div v-for="(count,key) in data.requests" :key="key"><dt>{{ requestLabels[key] || key }}</dt><dd>{{ count }}</dd></div></dl></article>
        <article class="dashboard-panel"><h2>订单（{{ Object.values(data.orders).reduce((a,b)=>a+b,0) }}）</h2><dl><div v-for="(count,key) in data.orders" :key="key"><dt>{{ key.replace(':',' · ') }}</dt><dd>{{ count }}</dd></div></dl></article>
        <article class="dashboard-panel"><h2>待办（{{ data.todos.total || 0 }}）</h2><dl><div v-for="(count,key) in data.todos" :key="key"><dt>{{ todoLabels[key] || (key==='total'?'总计':key) }}</dt><dd>{{ count }}</dd></div></dl></article>
      </section>
    </template>
  </AdminLayout>
</template>

<style scoped>
.dashboard-updated{color:#777;margin:18px 0}.dashboard-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.dashboard-cards article,.dashboard-panel{background:#fff;border:1px solid #e7e2d8;border-radius:12px;padding:18px}.dashboard-cards article{display:grid;gap:8px}.dashboard-cards span,.dashboard-cards small{color:#74766f}.dashboard-cards strong{font-size:26px}.dashboard-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.dashboard-panel h2{font-size:17px;margin:0 0 14px}.dashboard-panel dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0}.dashboard-panel dl div{display:flex;justify-content:space-between;gap:12px}.dashboard-panel dt{color:#71756e}.dashboard-panel dd{margin:0;font-weight:600}@media(max-width:850px){.dashboard-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.dashboard-cards,.dashboard-columns{grid-template-columns:1fr}}
</style>
