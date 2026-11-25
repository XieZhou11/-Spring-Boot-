import React from 'react';
import { Plus } from 'lucide-react';
import { Badge } from './CommonUi';

// 创作者的需求大厅、作品管理与收入结算。
export function CreatorViews({
  activeRole,
  activeTab,
  creatorPausedSelf,
  setCreatorPausedSelf,
  showToast,
  demands,
  setConfirmDialog,
  setDemands,
  setModal,
  works,
  setWorks,
  orders,
}) {
  return (
    <>
      {/* ================= 视图 5：创作者工作台 - 需求大厅（4.3.2） ================= */}
      {activeRole === 'CR' && activeTab === 'cr-hall' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">创作者需求大厅</h1>
              <p className="text-xs text-zinc-500 mt-1">
                当前认证主品类：<span className="font-medium text-zinc-800">皮具、木作</span> · 今日已提交报价 2/20 次
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200">
                <span className="text-zinc-600">接单状态：</span>
                <span className={`font-semibold ${creatorPausedSelf ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {creatorPausedSelf ? '已暂停接单' : '正常接单中'}
                </span>
                <button
                  onClick={() => {
                    setCreatorPausedSelf(!creatorPausedSelf);
                    showToast(creatorPausedSelf ? '已恢复接单权限' : '已主动暂停接单（不影响已有订单履约）', 'info');
                  }}
                  className="ml-2 underline text-zinc-700 hover:text-zinc-900"
                >
                  {creatorPausedSelf ? '恢复接单' : '暂停接单'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {demands.map((d) => {
              const activeQuotes = d.quotes.filter((q) => q.status === 'ACTIVE').length;
              const myQuote = d.quotes.find((q) => q.creatorId === 'cr-1');
              return (
                <div key={d.id} className="bg-white rounded-2xl border border-zinc-200/80 p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={d.scope === 'DIRECTED' ? 'amber' : 'blue'}>
                          {d.scope === 'DIRECTED' ? '定向邀约' : '公开需求'}
                        </Badge>
                        <Badge tone="neutral">{d.categoryL1} → {d.categoryL2}</Badge>
                      </div>
                      <span className="text-xs text-zinc-400">期望发货：{d.expectedShipDate}</span>
                    </div>
                    <h3 className="text-base font-semibold text-zinc-900">{d.title}</h3>
                    <p className="text-xs text-zinc-600 mt-2 line-clamp-2 leading-relaxed">{d.description}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                      <span>预算：<strong className="text-zinc-900">¥{d.budgetMin}—¥{d.budgetMax}</strong></span>
                      <span>规格：{d.spec}</span>
                    </div>
                  </div>

                  <div className="pt-3.5 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      当前有效报价名额：<strong className="text-zinc-900">{activeQuotes}/5</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      {myQuote && myQuote.status === 'ACTIVE' ? (
                        <>
                          <Badge tone="emerald">已报价 ¥{myQuote.price}</Badge>
                          <button
                            onClick={() =>
                              setConfirmDialog({
                                title: '撤回报价确认',
                                content: '撤回后原报价立即失效，买家不能再选中，是否继续？',
                                confirmText: '确认撤回',
                                danger: true,
                                onConfirm: () => {
                                  setDemands((prev) =>
                                    prev.map((item) =>
                                      item.id === d.id
                                        ? {
                                            ...item,
                                            quotes: item.quotes.map((q) => (q.id === myQuote.id ? { ...q, status: 'EXPIRED' } : q))
                                          }
                                        : item
                                    )
                                  );
                                  setConfirmDialog(null);
                                  showToast('报价已撤回，定标前可重新提交');
                                }
                              })
                            }
                            className="px-3 py-1.5 text-xs border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50"
                          >
                            撤回报价
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={creatorPausedSelf || d.status === 'AWARDED' || d.status === 'CLOSED'}
                          onClick={() => setModal({ type: 'SUBMIT_QUOTE', payload: d })}
                          className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          提交报价方案
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 视图 6：创作者工作台 - 作品管理（4.2.1） ================= */}
      {activeRole === 'CR' && activeTab === 'cr-works' && (
        <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">我的作品管理</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                调整交易开关、现货价格或定制参考周期即时生效；修改图文内容将重新进入上架审核。今日首次发布 1/5。
              </p>
            </div>
            <button
              onClick={() => setModal({ type: 'PUBLISH_WORK' })}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> 发布新作品
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-400 bg-zinc-50/70">
                  <th className="py-3 px-6 font-medium">作品标题</th>
                  <th className="py-3 px-4 font-medium">品类</th>
                  <th className="py-3 px-4 font-medium">现货销售（单件）</th>
                  <th className="py-3 px-4 font-medium">接受定制</th>
                  <th className="py-3 px-4 font-medium">审核状态</th>
                  <th className="py-3 px-6 font-medium text-right">快捷操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {works.slice(0, 3).map((w) => (
                  <tr key={w.id} className="hover:bg-zinc-50/60">
                    <td className="py-4 px-6 font-medium text-zinc-900">{w.title}</td>
                    <td className="py-4 px-4 text-xs text-zinc-500">{w.categoryL1} → {w.categoryL2}</td>
                    <td className="py-4 px-4 text-xs">
                      {w.sellStock ? (
                        <span className="font-medium text-zinc-800">
                          ¥{w.stockPrice} · {w.stockStatus === 'AVAILABLE' ? '可购买' : w.stockStatus === 'RESERVED' ? '已锁定' : '已售出'}
                        </span>
                      ) : (
                        <span className="text-zinc-400">未开启</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-xs">
                      {w.acceptCustom ? <Badge tone="amber">开启 · {w.customDays}天</Badge> : <span className="text-zinc-400">未开启</span>}
                    </td>
                    <td className="py-4 px-4">
                      <Badge tone="emerald">已上架</Badge>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => {
                          setWorks((prev) =>
                            prev.map((item) => (item.id === w.id ? { ...item, acceptCustom: !item.acceptCustom, customDays: item.customDays || 15 } : item))
                          );
                          showToast('交易开关已即时更新，保持已上架状态');
                        }}
                        className="text-xs font-medium text-amber-700 hover:underline"
                      >
                        {w.acceptCustom ? '关闭定制入口' : '开启定制入口'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= 视图 7：创作者工作台 - 收入与模拟结算（4.5.5） ================= */}
      {activeRole === 'CR' && activeTab === 'cr-finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6">
              <div className="text-xs text-zinc-500">待结算金额（履约中及7天售后窗口内）</div>
              <div className="text-2xl font-semibold text-zinc-900 mt-2">¥2,680.00</div>
              <div className="text-[11px] text-zinc-400 mt-1">应结算金额 = 买家实付金额</div>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6">
              <div className="text-xs text-zinc-500">累计已模拟结算金额</div>
              <div className="text-2xl font-semibold text-emerald-700 mt-2">¥14,820.00</div>
              <div className="text-[11px] text-zinc-400 mt-1">订单原完成时间满 7 天且无售后自动生成流水</div>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6">
              <div className="text-xs text-zinc-500 flex items-center justify-between">
                <span>已审核收款账户（只读）</span>
                <Badge tone="emerald">已核对</Badge>
              </div>
              <div className="text-base font-semibold text-zinc-900 mt-2.5">chen***@163.com</div>
              <div className="text-[11px] text-zinc-400 mt-1">支付宝 · 收款人：陈*生（系统不设余额钱包与提现）</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 text-sm font-semibold text-zinc-900">模拟结算明细记录</div>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-400 bg-zinc-50/70">
                  <th className="py-3 px-6 font-medium">关联订单号</th>
                  <th className="py-3 px-4 font-medium">订单标题</th>
                  <th className="py-3 px-4 font-medium">买家实付</th>
                  <th className="py-3 px-4 font-medium">应结算金额</th>
                  <th className="py-3 px-4 font-medium">收款账户快照</th>
                  <th className="py-3 px-6 font-medium text-right">结算状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {orders.filter((o) => o.paidAt).map((o) => (
                  <tr key={o.id}>
                    <td className="py-4 px-6 font-mono text-zinc-700">{o.id}</td>
                    <td className="py-4 px-4 font-medium text-zinc-900">{o.title}</td>
                    <td className="py-4 px-4">¥{o.amount.toFixed(2)}</td>
                    <td className="py-4 px-4 font-semibold text-zinc-900">¥{o.amount.toFixed(2)}</td>
                    <td className="py-4 px-4 text-zinc-500">{o.payoutAccountSnapshot}</td>
                    <td className="py-4 px-6 text-right">
                      <Badge tone={o.settlementStatus === 'SETTLED' ? 'emerald' : 'amber'}>
                        {o.settlementStatus === 'SETTLED' ? '已结算' : '待结算'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
