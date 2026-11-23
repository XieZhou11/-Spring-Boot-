<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getAdminOrder, getAdminOrders } from '@/api/admin'
import type { AdminOrderDetailVO, AdminOrderVO } from '@/types/admin'
import { formatTime } from '@/utils/creator'

const rows=ref<AdminOrderVO[]>([]);const detail=ref<AdminOrderDetailVO>();const total=ref(0);const page=ref(1);const orderNo=ref('');const status=ref('ALL');const orderType=ref('ALL');const createdFrom=ref('');const createdTo=ref('');const minAmount=ref('');const maxAmount=ref('');const loading=ref(false);const error=ref('')
const statusLabels:Record<string,string>={PENDING_PAY:'待付款',PAID:'待开工',IN_PRODUCTION:'制作中',PENDING_SHIP:'待发货',SHIPPED:'已发货',COMPLETED:'已完成',AFTER_SALE:'售后中',REFUNDED:'已退款',CANCELLED:'已取消'}
async function load(next=1){page.value=next;loading.value=true;error.value='';try{const result=await getAdminOrders({orderNo:orderNo.value.trim()||undefined,status:status.value,orderType:orderType.value,createdFrom:createdFrom.value||undefined,createdTo:createdTo.value||undefined,minAmount:minAmount.value||undefined,maxAmount:maxAmount.value||undefined,page:next});rows.value=result.items;total.value=result.total}catch(e){error.value=e instanceof Error?e.message:'订单查询失败'}finally{loading.value=false}}
async function showDetail(row:AdminOrderVO){loading.value=true;error.value='';try{detail.value=await getAdminOrder(row.orderId)}catch(e){error.value=e instanceof Error?e.message:'订单详情读取失败'}finally{loading.value=false}}
onMounted(()=>void load())
</script>

<template>
  <AdminLayout title="订单查询" subtitle="跨现货与定制订单检索，售后订单优先显示。">
    <form class="request-filters order-filters" @submit.prevent="load(1)">
      <label>订单编号<input v-model="orderNo" maxlength="32" placeholder="包含匹配"></label>
      <label>订单类型<select v-model="orderType"><option value="ALL">全部类型</option><option value="STOCK">现货</option><option value="CUSTOM">定制</option></select></label>
      <label>订单状态<select v-model="status"><option value="ALL">全部状态</option><option v-for="(label,key) in statusLabels" :key="key" :value="key">{{ label }}</option></select></label>
      <label>创建时间从<input v-model="createdFrom" type="datetime-local"></label><label>至<input v-model="createdTo" type="datetime-local"></label>
      <label>金额从<input v-model="minAmount" type="number" min="0" step="0.01"></label><label>至<input v-model="maxAmount" type="number" min="0" step="0.01"></label>
      <button class="button-secondary" :disabled="loading">查询订单</button>
    </form>
    <p v-if="error" class="form-alert" role="alert">{{ error }}</p>
    <p v-if="loading&&!rows.length" role="status">正在读取订单…</p>
    <div v-else-if="!rows.length&&!error" class="creator-empty"><h2>没有匹配订单</h2><p>调整筛选条件后重新查询。</p></div>
    <ul v-else class="admin-orders-list"><li v-for="row in rows" :key="row.orderId"><div class="order-row-heading"><strong>{{ row.orderNo }}</strong><span class="status-pill">{{ statusLabels[row.status] || row.status }}</span><span>{{ row.orderType==='STOCK'?'现货':'定制' }}</span><button class="button-secondary" @click="showDetail(row)">查看详情</button></div><p>{{ row.title }} · ¥{{ row.amount }}</p><dl><div><dt>买家</dt><dd>{{ row.buyerNickname }}（{{ row.buyerId }}）</dd></div><div><dt>创作者</dt><dd>{{ row.creatorNickname }}（{{ row.creatorId }}）</dd></div><div><dt>创建时间</dt><dd>{{ formatTime(row.createdAt) }}</dd></div></dl></li></ul>
    <section v-if="detail" class="order-detail"><header><h2>订单详情 · {{ detail.order.orderNo }}</h2><button class="button-secondary" @click="detail=undefined">收起</button></header><h3>约定与履约</h3><pre>{{ JSON.stringify(detail.order.agreementSnapshot,null,2) }}</pre><p>收货快照：{{ JSON.stringify(detail.order.addressSnapshot) }}</p><p>运单：{{ detail.order.trackingNo || '未发货' }} · 发货时间：{{ detail.order.shippedAt || '—' }}</p><h3>资金流水</h3><ul><li v-for="(flow,index) in detail.fundFlows" :key="index">{{ flow.type }} · ¥{{ flow.amount }} · {{ flow.occurredAt }}</li><li v-if="!detail.fundFlows.length">暂无成功流水</li></ul><h3>会话记录</h3><ul><li v-for="(message,index) in detail.messages" :key="index">{{ message.createdAt }} · {{ message.senderId }}：{{ message.content || '图片消息' }}</li><li v-if="!detail.messages.length">暂无关联会话消息</li></ul><h3>制作记录</h3><div v-for="node in detail.order.progressNodes" :key="node.id"><strong>{{ node.nodeCode }} · {{ node.status }}</strong><ul><li v-for="(record,index) in node.records" :key="index">{{ record.recordType }} · {{ record.createdAt }} · {{ record.content || record.skipReason || '—' }}</li></ul></div></section>
    <WorkPagination :page="page" :total="total" :loading="loading" @change="load"></WorkPagination>
  </AdminLayout>
</template>

<style scoped>
.order-filters{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));align-items:end}.admin-orders-list{list-style:none;padding:0;margin:18px 0;display:grid;gap:10px}.admin-orders-list li{background:#fff;border:1px solid #e7e2d8;border-radius:10px;padding:15px 18px}.order-row-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.admin-orders-list p{margin:10px 0}.admin-orders-list dl{display:flex;gap:24px;flex-wrap:wrap;margin:0}.admin-orders-list dl div{display:flex;gap:6px}.admin-orders-list dt{color:#777}.admin-orders-list dd{margin:0}@media(max-width:900px){.order-filters{grid-template-columns:repeat(2,minmax(120px,1fr))}}@media(max-width:560px){.order-filters{grid-template-columns:1fr}}
.order-detail{background:#fff;border:1px solid #e7e2d8;border-radius:10px;padding:18px;margin:20px 0}.order-detail header{display:flex;justify-content:space-between;align-items:center}.order-detail pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f5ef;padding:12px;border-radius:8px}.order-detail li{margin:6px 0}
</style>
