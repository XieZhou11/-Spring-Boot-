import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from './CommonUi';

// 管理员的数据看板、审核、售后裁定与用户品类管理。
export function AdminViews({
  activeRole,
  activeTab,
  showToast,
  audits,
  refunds,
  handleAdminAudit,
  handleAdminRefund,
  categories,
  setCategories,
  setConfirmDialog,
}) {
  return (
    <>
      {/* ================= 视图 8：管理后台 - 数据看板（4.9.4） ================= */}
      {activeRole === 'AD' && activeTab === 'ad-dashboard' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">平台运营基础数据看板</h1>
              <p className="text-xs text-zinc-400 mt-0.5">实时聚合统计 · 更新时间：2026-11-23 10:30:00（北京时间）</p>
            </div>
            <button
              onClick={() => showToast('统计数据已刷新')}
              className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 刷新统计
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '注册用户总数', value: '1,284', sub: '双身份账号不重复计数 · 今日 +18' },
              { label: '已认证创作者数', value: '164', sub: '今日新增认证 +3' },
              { label: '模拟支付总金额', value: '¥186,420', sub: '现货 ¥52,100 · 定制 ¥134,320' },
              { label: '待办审核与纠纷', value: audits.filter((a) => a.status === 'PENDING').length + refunds.filter((r) => r.status === 'WAIT_ADMIN').length, sub: '待审核队列 + 待裁定退款', highlight: true }
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-2xl border border-zinc-200/80 p-5">
                <div className="text-xs text-zinc-500">{stat.label}</div>
                <div className={`text-2xl font-semibold mt-2 ${stat.highlight ? 'text-amber-700' : 'text-zinc-900'}`}>
                  {stat.value}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1.5">{stat.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900">模拟资金流水口径</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">成功模拟支付合计</span>
                  <span className="font-semibold text-zinc-900">¥186,420.00</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">全额模拟退款合计</span>
                  <span className="font-semibold text-rose-600">¥4,280.00</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">当前待结算金额</span>
                  <span className="font-semibold text-amber-700">¥28,940.00</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-zinc-500">已模拟结算金额</span>
                  <span className="font-semibold text-emerald-700">¥153,200.00</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200/80 p-5">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">业务对象分布概览</h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 space-y-2">
                  <div className="font-semibold text-zinc-800">作品数（512）</div>
                  <div className="flex justify-between text-zinc-500"><span>已上架</span><span>468</span></div>
                  <div className="flex justify-between text-zinc-500"><span>待审核</span><span>14</span></div>
                  <div className="flex justify-between text-zinc-500"><span>已下架/驳回</span><span>30</span></div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 space-y-2">
                  <div className="font-semibold text-zinc-800">定制需求（218）</div>
                  <div className="flex justify-between text-zinc-500"><span>待响应/报价中</span><span>42</span></div>
                  <div className="flex justify-between text-zinc-500"><span>交易进行中</span><span>65</span></div>
                  <div className="flex justify-between text-zinc-500"><span>已完成</span><span>111</span></div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 space-y-2">
                  <div className="font-semibold text-zinc-800">订单数（315）</div>
                  <div className="flex justify-between text-zinc-500"><span>定制订单</span><span>204</span></div>
                  <div className="flex justify-between text-zinc-500"><span>现货直购</span><span>111</span></div>
                  <div className="flex justify-between text-zinc-500"><span>售后中</span><span>1</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 视图 9：管理后台 - 审核中心（4.9.1） ================= */}
      {activeRole === 'AD' && activeTab === 'ad-audit' && (
        <div className="space-y-4">
          <h1 className="text-lg font-semibold text-zinc-900">审核中心（创作者入驻 & 作品上架）</h1>
          <div className="grid grid-cols-1 gap-4">
            {audits.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl border border-zinc-200/80 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={a.kind === 'CREATOR' ? 'blue' : 'amber'}>
                      {a.kind === 'CREATOR' ? '创作者入驻与收款资料审核' : '作品上架审核'}
                    </Badge>
                    <Badge tone={a.status === 'PENDING' ? 'amber' : a.status === 'APPROVED' ? 'emerald' : 'rose'}>
                      {a.status === 'PENDING' ? '待审核' : a.status === 'APPROVED' ? '已通过' : '已驳回'}
                    </Badge>
                    <span className="text-xs text-zinc-400">提交时间：{a.submittedAt}</span>
                  </div>
                  {a.kind === 'CREATOR' ? (
                    <>
                      <h3 className="text-base font-semibold text-zinc-900">
                        申请人：{a.applicant}（{a.region} · 从业 {a.years} 年）
                      </h3>
                      <p className="text-xs text-zinc-600">{a.intro}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-zinc-500 pt-1">
                        <span>主品类：<strong className="text-zinc-800">{a.categories.join('、')}</strong></span>
                        <span>原创作品：<strong className="text-zinc-800">{a.worksCount} 件（含过程图）</strong></span>
                        <span>收款资料：<strong className="text-zinc-800">{a.payoutAccount}</strong></span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-base font-semibold text-zinc-900">{a.title}</h3>
                      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                        <span>作者：{a.author}</span>
                        <span>品类：{a.category}</span>
                        <span>来源订单：{a.sourceOrderId}（已校验买家授权同意，现货销售已关闭）</span>
                      </div>
                    </>
                  )}
                </div>

                {a.status === 'PENDING' && (
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      onClick={() => handleAdminAudit(a.id, 'REJECTED')}
                      className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium rounded-lg"
                    >
                      驳回并说明原因
                    </button>
                    <button
                      onClick={() => handleAdminAudit(a.id, 'APPROVED')}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg"
                    >
                      审核通过
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 视图 10：管理后台 - 售后与退款裁定（4.9.3） ================= */}
      {activeRole === 'AD' && activeTab === 'ad-refunds' && (
        <div className="space-y-4">
          <h1 className="text-lg font-semibold text-zinc-900">售后与退款纠纷裁定</h1>
          {refunds.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-zinc-200/80 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge tone={r.status === 'WAIT_ADMIN' ? 'rose' : r.status === 'REFUNDED' ? 'emerald' : 'neutral'}>
                    {r.status === 'WAIT_ADMIN' ? '待管理员裁定' : r.status === 'REFUNDED' ? '已全额退款' : '已驳回'}
                  </Badge>
                  <span className="text-xs font-mono text-zinc-500">{r.orderId}</span>
                  <span className="text-xs text-zinc-400">进入售后前状态：已发货</span>
                </div>
                <div className="text-base font-semibold text-zinc-900">申请全额退款：¥{r.amount.toFixed(2)}</div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">{r.orderTitle}</h3>
                <p className="text-xs text-zinc-600 mt-1.5">
                  <span className="font-semibold text-zinc-800">买家（{r.buyerName}）说明：</span>
                  {r.description}
                </p>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
                <span>退货核验：原成品已寄回并核实退回运单号 <strong className="font-mono">{r.returnTrackingNo}</strong></span>
                <Badge tone="emerald">已核实退回</Badge>
              </div>
              {r.status === 'WAIT_ADMIN' && (
                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => handleAdminRefund(r.id, 'REJECTED')}
                    className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium rounded-lg"
                  >
                    驳回申请（恢复原履约状态）
                  </button>
                  <button
                    onClick={() => handleAdminRefund(r.id, 'REFUNDED')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg"
                  >
                    批准全额退款并取消待结算
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ================= 视图 11：管理后台 - 用户与品类管理（4.9.2） ================= */}
      {activeRole === 'AD' && activeTab === 'ad-governance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200/80 p-6 space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">两级品类管理</h2>
            <p className="text-xs text-zinc-500">停用品类后新建作品/需求不可选，历史记录保留原品类引用。</p>
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.id} className="p-4 rounded-xl border border-zinc-200/80 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                      {cat.name}
                      <Badge tone={cat.enabled ? 'emerald' : 'neutral'}>{cat.enabled ? '启用中' : '已停用'}</Badge>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      二级细分：{cat.children.map((c) => c.name).join(' / ')}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, enabled: !c.enabled } : c)));
                      showToast(`已${cat.enabled ? '停用' : '启用'}一级品类「${cat.name}」`, 'info');
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                  >
                    {cat.enabled ? '停用' : '恢复启用'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200/80 p-6 space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">账号业务资格处置</h2>
            <p className="text-xs text-zinc-500">统一暂停新业务不阻止登录及已有订单履约、会话与售后。</p>
            <div className="p-4 rounded-xl border border-zinc-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">木语刻造（认证创作者）</div>
                  <div className="text-xs text-zinc-400">muyu@163.com · 近期存在 1 笔尺寸偏差退款</div>
                </div>
                <Badge tone="emerald">新业务正常</Badge>
              </div>
              <button
                onClick={() =>
                  setConfirmDialog({
                    title: '暂停账号新业务确认',
                    content: '确认暂停该账号的新业务？已有订单付款、履约、会话及售后仍可使用，操作将记录原因并留痕。',
                    confirmText: '确认暂停新业务',
                    danger: true,
                    onConfirm: () => {
                      setConfirmDialog(null);
                      showToast('已暂停该账号新业务权限并通知用户，操作已留痕');
                    }
                  })
                }
                className="w-full py-2 text-xs font-medium rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors"
              >
                统一暂停新业务
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
