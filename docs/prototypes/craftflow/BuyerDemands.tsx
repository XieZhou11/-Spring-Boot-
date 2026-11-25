import React, { useMemo } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { Badge, DEMAND_STATUS_MAP } from './CommonUi';

// 买家的定制需求与多方报价对比。
export function BuyerDemands({
  activeRole,
  activeTab,
  demands,
  setModal,
  selectedDemand,
  setSelectedDemandId,
  setConfirmDialog,
  setDemands,
  showToast,
  setQuoteSort,
  quoteSort,
  setActiveTab,
}) {
  return (
    <>
      {/* ================= 视图 2：定制需求与多方报价对比（核心特色模块） ================= */}
      {activeRole === 'BU' && activeTab === 'demands' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左侧：我的需求列表 */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-zinc-900">我的定制需求 ({demands.length}/5)</h2>
              <button
                onClick={() => setModal({ type: 'CREATE_DEMAND', payload: { scope: 'PUBLIC' } })}
                className="text-xs font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 新建需求
              </button>
            </div>
            {demands.map((d) => {
              const st = DEMAND_STATUS_MAP[d.status];
              const activeCount = d.quotes.filter((q) => q.status === 'ACTIVE').length;
              const isSelected = selectedDemand?.id === d.id;
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDemandId(d.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white border-zinc-900 shadow-sm ring-1 ring-zinc-900/5'
                      : 'bg-white border-zinc-200/80 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <Badge tone="neutral">{d.scope === 'DIRECTED' ? '定向邀约' : '公开大厅'}</Badge>
                    </div>
                    <span className="text-[11px] text-zinc-400">{d.createdAt.slice(5, 10)}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 line-clamp-2 leading-snug">{d.title}</h3>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                    <span>预算 ¥{d.budgetMin}—¥{d.budgetMax}</span>
                    <span className="font-medium text-zinc-800">
                      {d.scope === 'DIRECTED' ? `指定：${d.invitedCreatorName}` : `有效报价 ${activeCount}/5`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 右侧：需求详情 + 多方报价横向对比表 */}
          {selectedDemand && (
            <div className="lg:col-span-8 space-y-5">
              {/* 需求信息头 */}
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge tone={DEMAND_STATUS_MAP[selectedDemand.status].tone}>
                        {DEMAND_STATUS_MAP[selectedDemand.status].label}
                      </Badge>
                      <span className="text-xs text-zinc-400">{selectedDemand.id}</span>
                      <span className="text-xs text-zinc-400">· {selectedDemand.categoryL1} → {selectedDemand.categoryL2}</span>
                    </div>
                    <h1 className="text-lg font-semibold text-zinc-900">{selectedDemand.title}</h1>
                  </div>
                  {(selectedDemand.status === 'OPEN' || selectedDemand.status === 'QUOTING') && (
                    <button
                      onClick={() =>
                        setConfirmDialog({
                          title: '关闭当前需求',
                          content: '需求发布后正文已锁定。关闭后将停止接收新报价，未成单会话归档只读；您可随时复制新建需求。确认关闭？',
                          confirmText: '确认关闭',
                          danger: true,
                          onConfirm: () => {
                            setDemands((prev) =>
                              prev.map((item) => (item.id === selectedDemand.id ? { ...item, status: 'CLOSED' } : item))
                            );
                            setConfirmDialog(null);
                            showToast('需求已关闭', 'info');
                          }
                        })
                      }
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-600"
                    >
                      关闭需求
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-zinc-100 text-xs">
                  <div>
                    <div className="text-zinc-400">预算区间</div>
                    <div className="font-semibold text-zinc-900 mt-0.5">¥{selectedDemand.budgetMin} — ¥{selectedDemand.budgetMax}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">期望发货日期</div>
                    <div className="font-semibold text-zinc-900 mt-0.5">{selectedDemand.expectedShipDate}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">尺寸规格</div>
                    <div className="font-medium text-zinc-800 mt-0.5 truncate" title={selectedDemand.spec}>{selectedDemand.spec}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">发布范围</div>
                    <div className="font-medium text-zinc-800 mt-0.5">
                      {selectedDemand.scope === 'DIRECTED' ? `定向 · ${selectedDemand.invitedCreatorName}` : '公开需求大厅'}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mt-3 bg-zinc-50 p-3 rounded-lg leading-relaxed">
                  <span className="font-semibold text-zinc-700">需求细节：</span>
                  {selectedDemand.description}
                </p>
              </div>

              {/* 多方报价横向对比表（严格对照表 4-9） */}
              <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                      多方报价横向对比
                      <span className="text-xs font-normal text-zinc-500">
                        （有效报价 {selectedDemand.quotes.filter((q) => q.status === 'ACTIVE').length}/5 · 仅需求买家可见）
                      </span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-zinc-400 mr-1">排序：</span>
                    {[
                      { id: 'PRICE', label: '商品金额' },
                      { id: 'DAYS', label: '工期最短' },
                      { id: 'RATING', label: '平均评分' }
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setQuoteSort(s.id)}
                        className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                          quoteSort === s.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDemand.quotes.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-sm text-zinc-500">暂无有效报价，可继续等待创作者响应（发布满 7 天且无有效报价将自动过期）。</p>
                  </div>
                ) : (
                  <QuoteComparisonTable
                    demand={selectedDemand}
                    sortBy={quoteSort}
                    onSelectQuote={(quote) => setModal({ type: 'AWARD_QUOTE', payload: { demand: selectedDemand, quote } })}
                    onChat={(quote) => {
                      setActiveTab('messages');
                      showToast(`已定位到与「${quote.creatorName}」的需求沟通会话`, 'info');
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function QuoteComparisonTable({ demand, sortBy, onSelectQuote, onChat }) {
  const quotes = useMemo(() => {
    const list = [...demand.quotes];
    if (sortBy === 'PRICE') list.sort((a, b) => a.price - b.price);
    if (sortBy === 'DAYS') list.sort((a, b) => a.days - b.days);
    if (sortBy === 'RATING') list.sort((a, b) => (b.rating || -1) - (a.rating || -1));
    return list;
  }, [demand.quotes, sortBy]);

  const activeQuotes = quotes.filter((q) => q.status === 'ACTIVE');
  const minPrice = activeQuotes.length ? Math.min(...activeQuotes.map((q) => q.price)) : null;
  const minDays = activeQuotes.length ? Math.min(...activeQuotes.map((q) => q.days)) : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[680px]">
        <thead>
          <tr className="bg-zinc-50/70 border-b border-zinc-100 text-xs text-zinc-500">
            <th className="py-3.5 px-5 font-medium w-32">对比维度</th>
            {quotes.map((q) => (
              <th key={q.id} className="py-3.5 px-4 font-semibold text-zinc-900 min-w-[190px]">
                <div className="flex items-center justify-between gap-2">
                  <span>{q.creatorName}</span>
                  {q.status === 'AWARDED' && <Badge tone="emerald">已中标</Badge>}
                  {q.status === 'LOST' && <Badge tone="neutral">未中标</Badge>}
                  {q.status === 'EXPIRED' && <Badge tone="neutral">已失效</Badge>}
                </div>
                <div className="text-[11px] font-normal text-zinc-400 mt-0.5">{q.creatorRegion}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 text-xs">
          {/* 商品成交金额 */}
          <tr>
            <td className="py-3.5 px-5 text-zinc-500 font-medium">商品成交金额</td>
            {quotes.map((q) => (
              <td key={q.id} className="py-3.5 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-zinc-900">¥{q.price}</span>
                  {q.status === 'ACTIVE' && q.price === minPrice && <Badge tone="emerald">最低价</Badge>}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">实付即成交金额</div>
              </td>
            ))}
          </tr>

          {/* 工期与预计发货日 */}
          <tr>
            <td className="py-3.5 px-5 text-zinc-500 font-medium">工期 / 预计发货</td>
            {quotes.map((q) => {
              const isLate = q.estimatedShipDate > demand.expectedShipDate;
              return (
                <td key={q.id} className="py-3.5 px-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-zinc-900">{q.days} 个自然日</span>
                    {q.status === 'ACTIVE' && q.days === minDays && <Badge tone="blue">最短工期</Badge>}
                  </div>
                  <div className={`text-[11px] ${isLate ? 'text-amber-700 font-medium' : 'text-zinc-500'}`}>
                    预计 {q.estimatedShipDate} 发货 {isLate && '（晚于期望）'}
                  </div>
                </td>
              );
            })}
          </tr>

          {/* 创作者口碑 */}
          <tr>
            <td className="py-3.5 px-5 text-zinc-500 font-medium">创作者口碑</td>
            {quotes.map((q) => (
              <td key={q.id} className="py-3.5 px-4">
                <div className="font-semibold text-zinc-900">
                  {q.rating ? `${q.rating} ★` : '暂无评价'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {q.reviewCount} 条评价 · 完成 {q.completedOrders} 单
                </div>
              </td>
            ))}
          </tr>

          {/* 方案说明 */}
          <tr>
            <td className="py-3.5 px-5 text-zinc-500 font-medium align-top">方案与工艺说明</td>
            {quotes.map((q) => (
              <td key={q.id} className="py-3.5 px-4 align-top">
                <p className="text-zinc-700 leading-relaxed">{q.plan}</p>
                {q.materialNote && <p className="text-zinc-400 mt-1.5">{q.materialNote}</p>}
              </td>
            ))}
          </tr>

          {/* 有效期与操作 */}
          <tr>
            <td className="py-4 px-5 text-zinc-500 font-medium">有效期与定标</td>
            {quotes.map((q) => (
              <td key={q.id} className="py-4 px-4 space-y-2.5">
                <div className="text-[11px] text-zinc-400">有效至 {q.validUntil}</div>
                <div className="flex items-center gap-2">
                  {q.status === 'ACTIVE' && demand.status === 'QUOTING' ? (
                    <button
                      onClick={() => onSelectQuote(q)}
                      className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-lg transition-colors"
                    >
                      选定此方案
                    </button>
                  ) : (
                    <button disabled className="flex-1 py-2 bg-zinc-100 text-zinc-400 font-medium rounded-lg cursor-not-allowed">
                      {q.status === 'AWARDED' ? '已中标' : '不可选择'}
                    </button>
                  )}
                  <button
                    onClick={() => onChat(q)}
                    className="p-2 border border-zinc-200 hover:bg-zinc-50 rounded-lg text-zinc-600"
                    title="沟通方案细节"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
