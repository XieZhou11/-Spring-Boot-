<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getAdminUser, getAdminUsers, setAdminBusinessPause } from '@/api/admin'
import type { AdminUserDetailVO, AdminUserVO } from '@/types/admin'

const rows=ref<AdminUserVO[]>([]);const detail=ref<AdminUserDetailVO>();const selected=ref('');const email=ref('');const nickname=ref('');const certificationStatus=ref('ALL');const page=ref(1);const total=ref(0);const busy=ref(false);const error=ref('');const notice=ref('')
const certification:Record<string,string>={NONE:'未申请',PENDING:'待审核',APPROVED:'已认证',REJECTED:'未通过'}
const paused=(value:boolean|number)=>value===true||value===1
async function load(next=1){page.value=next;busy.value=true;error.value='';try{const result=await getAdminUsers({email:email.value.trim(),nickname:nickname.value.trim(),certificationStatus:certificationStatus.value,page:next});rows.value=result.items;total.value=result.total;if(selected.value){const found=rows.value.find(r=>String(r.userId)===selected.value);if(found)await select(found)}}catch(e){error.value=e instanceof Error?e.message:'用户列表读取失败'}finally{busy.value=false}}
async function select(user:AdminUserVO){selected.value=String(user.userId);try{detail.value=await getAdminUser(selected.value)}catch(e){error.value=e instanceof Error?e.message:'用户详情读取失败'}}
async function togglePause(){if(!detail.value)return;const user=detail.value.user;const next=!paused(user.adminBusinessPaused);const reason=window.prompt(next?'填写暂停新业务的原因':'填写人工恢复原因');if(reason===null)return;if(!reason.trim()){error.value='请填写操作原因';return}const recovery=next?window.prompt('填写恢复该账号新业务的条件'):null;if(next&&(recovery===null||!recovery.trim())){error.value='请填写恢复条件';return}if(!window.confirm(next?'确认暂停该账号的新业务？':'确认恢复该账号的新业务？'))return;busy.value=true;error.value='';notice.value='';try{await setAdminBusinessPause(String(user.userId),next,reason.trim(),recovery?.trim());notice.value=next?'已暂停该账号的新业务':'已人工恢复该账号的新业务';await load(page.value);const refreshed=rows.value.find(r=>String(r.userId)===String(user.userId));if(refreshed)await select(refreshed)}catch(e){error.value=e instanceof Error?e.message:'账号状态更新失败'}finally{busy.value=false}}
onMounted(()=>void load())
</script>

<template>
  <AdminLayout title="用户管理" subtitle="查询账号、查看关联业务并按原因处置新业务资格。">
    <form class="request-filters" @submit.prevent="load(1)">
      <label>邮箱<input v-model="email" type="email" maxlength="254" placeholder="按邮箱包含匹配"></label>
      <label>昵称<input v-model="nickname" maxlength="8" placeholder="按昵称包含匹配"></label>
      <label>认证状态<select v-model="certificationStatus"><option value="ALL">全部</option><option value="NONE">未申请</option><option value="PENDING">待审核</option><option value="APPROVED">已认证</option><option value="REJECTED">未通过</option></select></label>
      <button class="button-secondary" :disabled="busy">查询用户</button>
    </form>
    <p v-if="error" class="form-alert" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <div class="user-admin-grid">
      <section class="user-list"><h2>账号（{{ total }}）</h2><p v-if="busy&&!rows.length" role="status">正在读取…</p><button v-for="row in rows" :key="row.userId" class="user-row" :class="{active:selected===String(row.userId)}" @click="select(row)"><strong>{{ row.nickname }}</strong><span>{{ row.email }}</span><small>{{ certification[row.certificationStatus] || row.certificationStatus }} · {{ paused(row.adminBusinessPaused)?'业务暂停':'可开展新业务' }}</small></button><p v-if="!rows.length&&!busy">没有匹配用户。</p><WorkPagination :page="page" :total="total" :loading="busy" @change="load"></WorkPagination></section>
      <section v-if="detail" class="user-detail">
        <header><div><h2>{{ detail.user.nickname }}</h2><p>{{ detail.user.email }} · {{ certification[detail.user.certificationStatus] || detail.user.certificationStatus }}</p></div><button class="button-secondary" :disabled="busy" @click="togglePause">{{ paused(detail.user.adminBusinessPaused)?'人工恢复新业务':'暂停新业务' }}</button></header>
        <div class="pause-status"><p>后台暂停：<strong>{{ paused(detail.user.adminBusinessPaused)?'已暂停':'未暂停' }}</strong></p><p>创作者本人暂停接单：<strong>{{ paused(detail.user.creatorPaused)?'已暂停':'未暂停' }}</strong></p><small>两种状态独立；恢复后台业务不会覆盖本人暂停接单选择。</small></div>
        <div class="related-counts"><span>作品 {{ detail.workCount }}</span><span>需求 {{ detail.requestCount }}</span><span>订单 {{ detail.orderCount }}</span></div>
        <h3>最近作品</h3><ul><li v-for="item in detail.works" :key="String(item.id)">{{ item.title || '未命名作品' }} · {{ item.status }}</li><li v-if="!detail.works.length">暂无作品</li></ul>
        <h3>最近需求</h3><ul><li v-for="item in detail.requests" :key="String(item.id)">{{ item.title || '未命名需求' }} · {{ item.status }}</li><li v-if="!detail.requests.length">暂无需求</li></ul>
        <h3>最近订单</h3><ul><li v-for="item in detail.orders" :key="String(item.id)">{{ item.orderNo }} · {{ item.orderType }} · {{ item.status }} · ¥{{ item.amount }}</li><li v-if="!detail.orders.length">暂无订单</li></ul>
        <h3>暂停与恢复记录</h3><ul><li v-for="(item,index) in detail.pauseHistory" :key="index">{{ item.action }} · {{ item.beforeStatus }} → {{ item.afterStatus }} · {{ item.reason || '本人操作' }}<span v-if="item.recoveryCondition"> · 恢复条件：{{ item.recoveryCondition }}</span> · {{ item.createdAt }}</li><li v-if="!detail.pauseHistory.length">暂无记录</li></ul>
      </section><section v-else class="user-detail user-empty"><h2>选择一个账号</h2><p>查看关联业务及暂停状态。</p></section>
    </div>
  </AdminLayout>
</template>

<style scoped>
.user-admin-grid{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(0,1.5fr);gap:18px;align-items:start}.user-list,.user-detail{background:#fff;border:1px solid #e7e2d8;border-radius:12px;padding:18px}.user-list h2,.user-detail h2{margin:0 0 12px}.user-row{width:100%;display:grid;gap:5px;text-align:left;border:1px solid #ece8e0;background:#fff;border-radius:8px;padding:11px;margin:7px 0;cursor:pointer}.user-row.active{border-color:#68765d;background:#f7f7f2}.user-row span,.user-row small,.user-detail header p,.pause-status small{color:#74766f}.user-detail header{display:flex;justify-content:space-between;gap:12px;align-items:center}.pause-status{background:#f6f5ef;padding:12px 16px;border-radius:8px}.pause-status p{margin:4px 0}.related-counts{display:flex;gap:16px;margin:16px 0;font-weight:600}.user-detail h3{font-size:15px;margin:16px 0 6px}.user-detail ul{margin:0;padding-left:20px}.user-empty{min-height:260px}@media(max-width:850px){.user-admin-grid{grid-template-columns:1fr}}
</style>
