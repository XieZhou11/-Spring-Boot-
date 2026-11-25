import React from 'react';
import { Award, Check, MapPin, MessageSquare, Truck } from 'lucide-react';
import { Badge, ORDER_STATUS_MAP } from './CommonUi';

// 买家与创作者共用的订单及履约界面。
export function OrderView({
  activeTab,
  activeRole,
  orders,
  selectedOrder,
  setSelectedOrderId,
  handleSimulatePay,
  handleStartProduction,
  setModal,
  handleConfirmReceive,
  handleShowcaseAuth,
  setActiveTab,
  showToast,
}) {
  return (
    <>
      {/* ================= 视图 3：订单与定制进度可视化（买卖双端复用，权限动态区分） ================= */}
      {activeTab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左侧订单列表 */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-zinc-900">
                {activeRole === 'CR' ? '接单与履约列表' : '我的订单'} ({orders.length})
              </h2>
              <span className="text-xs text-zinc-400">现货/定制分流</span>
            </div>
            {orders.map((o) => {
              const st = ORDER_STATUS_MAP[o.status];
              const doneCount = o.nodes.filter((n) => n.status === 'CHECKED' || n.status === 'SKIPPED').length;
              const isSelected = selectedOrder?.id === o.id;
              return (
                <div
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white border-zinc-900 shadow-sm ring-1 ring-zinc-900/5'
                      : 'bg-white border-zinc-200/80 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={o.type === 'CUSTOM' ? 'amber' : 'neutral'}>
                        {o.type === 'CUSTOM' ? '定制单' : '现货直购'}
                      </Badge>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <span className="text-sm font-semibold text-zinc-900">¥{o.amount}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 line-clamp-1">{o.title}</h3>
                  <div className="mt-2.5 flex items-center justify-between text-xs text-zinc-500">
                    <span>{activeRole === 'CR' ? `买家：${o.buyerName}` : `创作者：${o.creatorName}`}</span>
                    {o.type === 'CUSTOM' && (
                      <span className="font-medium text-zinc-700">进度 {doneCount}/5</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 右侧订单详情与五节点时间轴 */}
          {selectedOrder && (
            <div className="lg:col-span-8 space-y-5">
              {/* 订单概要与关键操作栏 */}
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge tone={selectedOrder.type === 'CUSTOM' ? 'amber' : 'neutral'}>
                        {selectedOrder.type === 'CUSTOM' ? '定制订单 CUSTOM' : '现货直购 STOCK'}
                      </Badge>
                      <Badge tone={ORDER_STATUS_MAP[selectedOrder.status].tone}>
                        {ORDER_STATUS_MAP[selectedOrder.status].label}
                      </Badge>
                      <span className="text-xs text-zinc-400">{selectedOrder.id}</span>
                    </div>
                    <h1 className="text-lg font-semibold text-zinc-900">{selectedOrder.title}</h1>
                  </div>

                  {/* 依据身份与订单状态展示动作按钮 */}
                  <div className="flex flex-wrap items-center gap-2">
                    {activeRole === 'BU' && selectedOrder.status === 'PENDING_PAY' && (
                      <button
                        onClick={() => handleSimulatePay(selectedOrder)}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg"
                      >
                        模拟支付 ¥{selectedOrder.amount}
                      </button>
                    )}
                    {activeRole === 'CR' && selectedOrder.type === 'CUSTOM' && selectedOrder.status === 'PAID' && (
                      <button
                        onClick={() => handleStartProduction(selectedOrder.id)}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg"
                      >
                        确认开工（解锁备料节点）
                      </button>
                    )}
                    {activeRole === 'CR' && selectedOrder.type === 'STOCK' && selectedOrder.status === 'PENDING_SHIP' && (
                      <button
                        onClick={() => setModal({ type: 'SHIP_STOCK', payload: selectedOrder })}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg"
                      >
                        填写运单号发货
                      </button>
                    )}
                    {activeRole === 'BU' && selectedOrder.status === 'SHIPPED' && (
                      <button
                        onClick={() => handleConfirmReceive(selectedOrder.id)}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg"
                      >
                        确认收货
                      </button>
                    )}
                    {activeRole === 'BU' && selectedOrder.status === 'COMPLETED' && !selectedOrder.reviewed && (
                      <button
                        onClick={() => setModal({ type: 'REVIEW_ORDER', payload: selectedOrder })}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg"
                      >
                        评价本次交易
                      </button>
                    )}
                    {activeRole === 'BU' && ['PAID', 'IN_PRODUCTION', 'PENDING_SHIP', 'SHIPPED', 'COMPLETED'].includes(selectedOrder.status) && (
                      <button
                        onClick={() => setModal({ type: 'APPLY_REFUND', payload: selectedOrder })}
                        className="px-3.5 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium rounded-lg"
                      >
                        申请全额退款
                      </button>
                    )}
                  </div>
                </div>

                {/* 金额与履约快照 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-zinc-100 text-xs">
                  <div>
                    <div className="text-zinc-400">实付 / 成交金额</div>
                    <div className="text-base font-semibold text-zinc-900 mt-0.5">¥{selectedOrder.amount.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">约定发货截止</div>
                    <div className="font-semibold text-zinc-800 mt-1">{selectedOrder.expectedShipDate}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">运单号</div>
                    <div className="font-mono font-medium text-zinc-800 mt-1">{selectedOrder.trackingNo || '尚未发货'}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">模拟结算状态</div>
                    <div className="font-medium text-zinc-800 mt-1">
                      {selectedOrder.settlementStatus === 'PENDING' ? '待结算（完成后满7天）' : selectedOrder.settlementStatus === 'SETTLED' ? '已结算' : '未产生'}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-zinc-500 bg-zinc-50 rounded-xl p-3.5 border border-zinc-100 flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-zinc-700">收货地址快照（建单锁定）：</span>
                    {selectedOrder.addressSnapshot}
                  </div>
                </div>

                {/* 定制成品公开授权横幅（4.2.6） */}
                {selectedOrder.type === 'CUSTOM' && selectedOrder.status === 'COMPLETED' && (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                        <Award className="w-4 h-4" />
                        定制成品公开展示授权
                      </div>
                      <p className="text-amber-800/90">
                        {selectedOrder.showcaseAuth.status === 'NONE' && '订单已完成，创作者可申请将该定制成品整理为公开作品案例（不含买家收货与聊天信息）。'}
                        {selectedOrder.showcaseAuth.status === 'PENDING' && '创作者已申请公开本次成品案例，等待订单买家通过按钮明确回复（未回复不视为同意）。'}
                        {selectedOrder.showcaseAuth.status === 'APPROVED' && '买家已同意公开本次成品案例！创作者可手动整理作品提交审核（须关闭现货销售）。'}
                        {selectedOrder.showcaseAuth.status === 'REJECTED' && '买家不同意公开本次成品案例，不能发布该订单的关联作品。'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeRole === 'CR' && selectedOrder.showcaseAuth.status === 'NONE' && (
                        <button
                          onClick={() => handleShowcaseAuth(selectedOrder.id, 'PENDING')}
                          className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800"
                        >
                          申请公开成品案例
                        </button>
                      )}
                      {activeRole === 'BU' && selectedOrder.showcaseAuth.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleShowcaseAuth(selectedOrder.id, 'REJECTED')}
                            className="px-3 py-1.5 bg-white border border-zinc-300 text-zinc-700 text-xs font-medium rounded-lg hover:bg-zinc-50"
                          >
                            不同意
                          </button>
                          <button
                            onClick={() => handleShowcaseAuth(selectedOrder.id, 'APPROVED')}
                            className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800"
                          >
                            同意公开
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 定制进度可视化时间轴（仅定制订单展示，现货不展示） */}
              {selectedOrder.type === 'CUSTOM' ? (
                <div className="bg-white rounded-2xl border border-zinc-200/80 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900">定制制作进度可视化</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        固定五节点顺序打卡 · 初始参考计划固定展示实际偏差 · 仅「打样打版」允许跳过
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-semibold text-zinc-900">
                        {selectedOrder.nodes.filter((n) => n.status === 'CHECKED' || n.status === 'SKIPPED').length}/5
                      </span>
                      <span className="text-xs text-zinc-400 ml-1">节点已完成</span>
                    </div>
                  </div>

                  {/* 横向步骤条 */}
                  <div className="grid grid-cols-5 gap-2 mb-7">
                    {selectedOrder.nodes.map((node, idx) => {
                      const done = node.status === 'CHECKED' || node.status === 'SKIPPED';
                      const active = node.status === 'UNLOCKED';
                      return (
                        <div key={node.key} className="space-y-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              done ? 'bg-emerald-600' : active ? 'bg-amber-500' : 'bg-zinc-200'
                            }`}
                          />
                          <div className="flex items-center justify-between text-[11px]">
                            <span className={`font-medium ${done || active ? 'text-zinc-900' : 'text-zinc-400'}`}>
                              {idx + 1}. {node.name}
                            </span>
                            <span className="text-zinc-400">{node.ratio}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 纵向详细时间轴 */}
                  <div className="space-y-4">
                    {selectedOrder.nodes.map((node, idx) => {
                      const isDone = node.status === 'CHECKED';
                      const isSkipped = node.status === 'SKIPPED';
                      const isUnlocked = node.status === 'UNLOCKED';
                      return (
                        <div
                          key={node.key}
                          className={`rounded-xl border p-4 transition-all ${
                            isUnlocked
                              ? 'border-amber-300 bg-amber-50/30'
                              : isDone || isSkipped
                              ? 'border-zinc-200/80 bg-white'
                              : 'border-zinc-100 bg-zinc-50/60 opacity-75'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                  isDone
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : isSkipped
                                    ? 'bg-zinc-200 text-zinc-600'
                                    : isUnlocked
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-zinc-200 text-zinc-500'
                                }`}
                              >
                                {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                              </div>
                              <span className="text-sm font-semibold text-zinc-900">{node.name}</span>
                              <span className="text-xs text-zinc-400">参考计划：{node.plannedDate}</span>
                              {node.deviation && (
                                <Badge tone={node.deviation.includes('超期') ? 'rose' : node.deviation.includes('跳过') ? 'neutral' : 'emerald'}>
                                  {node.deviation}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {activeRole === 'BU' && (isDone || isUnlocked) && (
                                <button
                                  onClick={() => {
                                    setActiveTab('messages');
                                    showToast(`已携带「节点 ${idx + 1} · ${node.name}」引用跳转订单会话`, 'info');
                                  }}
                                  className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" /> 讨论此进度
                                </button>
                              )}
                              {activeRole === 'CR' && isUnlocked && (
                                <button
                                  onClick={() => setModal({ type: 'NODE_CHECKIN', payload: { order: selectedOrder, node, nodeIndex: idx } })}
                                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg"
                                >
                                  {idx === 4 ? '打卡并填写运单号发货' : '图文打卡'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 打卡内容或跳过原因 */}
                          {isDone && (
                            <div className="mt-3 pl-8 space-y-2">
                              <p className="text-xs text-zinc-700 leading-relaxed">{node.note}</p>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-12 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] text-zinc-400">
                                  实拍图 1
                                </div>
                                <div className="w-16 h-12 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] text-zinc-400">
                                  实拍图 2
                                </div>
                                <span className="text-[11px] text-zinc-400 ml-2">提交于 {node.actualTime}</span>
                              </div>
                              {node.supplements?.map((sp, i) => (
                                <div key={i} className="text-xs bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-zinc-600">
                                  <span className="text-zinc-400 mr-2">[追加 {sp.time}]</span>
                                  {sp.text}
                                </div>
                              ))}
                            </div>
                          )}
                          {isSkipped && (
                            <div className="mt-2.5 pl-8 text-xs text-zinc-500">
                              <span className="font-medium text-zinc-600">跳过原因：</span>
                              {node.skipReason}（{node.actualTime}）
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">现货直购履约通道</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      依据平台规则，现货订单无需再次制作，不生成制作进度节点。支付后直接进入待发货，创作者须在 48 小时内填写运单号发货。
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
