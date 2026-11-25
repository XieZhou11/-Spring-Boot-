import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Badge } from './CommonUi';
import {
  AddressConfirmModal,
  CreateDemandModal,
  NodeCheckinModal,
  PublishWorkModal,
  ReviewOrderModal,
  SimpleInputModal,
  SubmitQuoteModal,
} from './ModalForms';

// 跨角色的业务弹窗、二次确认和全局提示。
export function Overlays({
  modal,
  addresses,
  setModal,
  handleBuyStock,
  handleAwardQuote,
  categories,
  setDemands,
  setSelectedDemandId,
  setSelectedWorkId,
  setActiveTab,
  showToast,
  handleNodeAction,
  setOrders,
  setRefunds,
  setWorks,
  setAudits,
  setAddresses,
  confirmDialog,
  setConfirmDialog,
  toast,
}) {
  return (
    <>
      {/* ========================================================================
          8. 各类业务弹窗（下单、定标、发布需求、提交报价、节点打卡、发布作品等）
         ======================================================================== */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {modal.type === 'BUY_STOCK' && (
              <AddressConfirmModal
                title="确认现货直购订单"
                subtitle={`${modal.payload.title} · 实付金额 ¥${modal.payload.stockPrice}`}
                note="下单后将锁定该件单品现货，请在 24 小时内完成支付，支付后直接进入待发货。"
                addresses={addresses}
                confirmText={`提交订单 ¥${modal.payload.stockPrice}`}
                onClose={() => setModal(null)}
                onConfirm={(addrId) => handleBuyStock(modal.payload, addrId)}
              />
            )}

            {modal.type === 'AWARD_QUOTE' && (
              <AddressConfirmModal
                title="定标确认与收货地址"
                subtitle={`选定「${modal.payload.quote.creatorName}」· 实付 ¥${modal.payload.quote.price} · 工期 ${modal.payload.quote.days} 天`}
                note="确认选择此方案并生成订单？其他有效报价将落选且不可更换中标方案，请在 24 小时内完成支付。"
                addresses={addresses}
                confirmText="确认定标并生成待付款订单"
                onClose={() => setModal(null)}
                onConfirm={(addrId) => handleAwardQuote(modal.payload.demand, modal.payload.quote, addrId)}
              />
            )}

            {modal.type === 'CREATE_DEMAND' && (
              <CreateDemandModal
                initialPayload={modal.payload}
                categories={categories}
                onClose={() => setModal(null)}
                onSubmit={(newDemand) => {
                  setDemands((prev) => [newDemand, ...prev]);
                  setSelectedDemandId(newDemand.id);
                  setModal(null);
                  setSelectedWorkId(null);
                  setActiveTab('demands');
                  showToast(newDemand.scope === 'DIRECTED' ? `已向「${newDemand.invitedCreatorName}」发起定向定制需求` : '定制需求已发布至公开大厅，正文与范围已锁定');
                }}
              />
            )}

            {modal.type === 'SUBMIT_QUOTE' && (
              <SubmitQuoteModal
                demand={modal.payload}
                onClose={() => setModal(null)}
                onSubmit={(quoteData) => {
                  setDemands((prev) =>
                    prev.map((d) =>
                      d.id === modal.payload.id
                        ? { ...d, status: 'QUOTING', quotes: [quoteData, ...d.quotes] }
                        : d
                    )
                  );
                  setModal(null);
                  showToast('报价方案已提交，有效期 7 天，已实时通知买家');
                }}
              />
            )}

            {modal.type === 'NODE_CHECKIN' && (
              <NodeCheckinModal
                order={modal.payload.order}
                node={modal.payload.node}
                nodeIndex={modal.payload.nodeIndex}
                onClose={() => setModal(null)}
                onSubmit={(data) => handleNodeAction(modal.payload.order.id, modal.payload.nodeIndex, data)}
              />
            )}

            {modal.type === 'SHIP_STOCK' && (
              <SimpleInputModal
                title="现货订单发货"
                label="物流运单号（8—30 位字母数字）"
                placeholder="例如：SF148920384712"
                confirmText="确认发货"
                onClose={() => setModal(null)}
                onSubmit={(val) => {
                  setOrders((prev) =>
                    prev.map((o) =>
                      o.id === modal.payload.id
                        ? { ...o, status: 'SHIPPED', trackingNo: val, shippedAt: '2026-11-23 10:55' }
                        : o
                    )
                  );
                  setModal(null);
                  showToast('已记录发货时间并通知买家，7 天无售后自动确认收货');
                }}
              />
            )}

            {modal.type === 'APPLY_REFUND' && (
              <SimpleInputModal
                title="申请全额退款"
                label="退款原因与详细说明（20—500 字）"
                placeholder="请说明退款原因，提交后订单将进入「售后中」并直接由管理员审核..."
                textarea
                confirmText="提交退款申请"
                onClose={() => setModal(null)}
                onSubmit={(val) => {
                  setOrders((prev) =>
                    prev.map((o) =>
                      o.id === modal.payload.id
                        ? { ...o, statusBeforeAfterSale: o.status, status: 'AFTER_SALE' }
                        : o
                    )
                  );
                  setRefunds((prev) => [
                    {
                      id: `RF-${Date.now()}`,
                      orderId: modal.payload.id,
                      orderTitle: modal.payload.title,
                      buyerName: modal.payload.buyerName,
                      creatorName: modal.payload.creatorName,
                      amount: modal.payload.amount,
                      prevStatus: modal.payload.status,
                      reason: '买家主动申请全额退款',
                      description: val,
                      returnVerified: false,
                      returnTrackingNo: '待协商核实',
                      submittedAt: '2026-11-23 11:00',
                      status: 'WAIT_ADMIN'
                    },
                    ...prev
                  ]);
                  setModal(null);
                  showToast('退款申请已提交，等待管理员审核；双方可随时补充证据');
                }}
              />
            )}

            {modal.type === 'REVIEW_ORDER' && (
              <ReviewOrderModal
                order={modal.payload}
                onClose={() => setModal(null)}
                onSubmit={() => {
                  setOrders((prev) => prev.map((o) => (o.id === modal.payload.id ? { ...o, reviewed: true } : o)));
                  setModal(null);
                  showToast('感谢您的评价！已计入创作者口碑统计');
                }}
              />
            )}

            {modal.type === 'PUBLISH_WORK' && (
              <PublishWorkModal
                categories={categories}
                onClose={() => setModal(null)}
                onSubmit={(newWork) => {
                  setWorks((prev) => [newWork, ...prev]);
                  setAudits((prev) => [
                    {
                      id: `AUD-WK-${Date.now()}`,
                      kind: 'WORK',
                      title: newWork.title,
                      author: newWork.authorName,
                      category: `${newWork.categoryL1} → ${newWork.categoryL2}`,
                      sellStock: newWork.sellStock,
                      acceptCustom: newWork.acceptCustom,
                      customDays: newWork.customDays,
                      sourceOrderId: '原创日常发布',
                      submittedAt: '刚刚',
                      status: 'PENDING'
                    },
                    ...prev
                  ]);
                  setModal(null);
                  showToast('作品已提交审核队列（可在「管理后台 → 审核中心」查看）');
                }}
              />
            )}

            {modal.type === 'PROFILE' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-zinc-900">个人资料与收货地址</h3>
                  <button onClick={() => setModal(null)} className="p-1 text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 text-xs space-y-1.5">
                  <div className="flex justify-between"><span className="text-zinc-400">当前账号</span><span className="font-medium text-zinc-800">linqingqian@163.com</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">创作者认证状态</span><Badge tone="emerald">已认证（双身份可用）</Badge></div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-700 mb-2">收货地址列表（{addresses.length}/10 · 保留唯一默认地址）</div>
                  <div className="space-y-2">
                    {addresses.map((a) => (
                      <div key={a.id} className="p-3 rounded-xl border border-zinc-200/80 text-xs flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-zinc-900 flex items-center gap-2">
                            {a.recipient} {a.phone}
                            {a.isDefault && <Badge tone="dark">默认</Badge>}
                          </div>
                          <div className="text-zinc-500 mt-1">{a.region} {a.detail}</div>
                        </div>
                        {!a.isDefault && (
                          <button
                            onClick={() => {
                              setAddresses((prev) => prev.map((item) => ({ ...item, isDefault: item.id === a.id })));
                              showToast('已设为默认收货地址');
                            }}
                            className="text-amber-700 hover:underline shrink-0"
                          >
                            设为默认
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 全局关键操作二次确认弹窗（严格遵循第 7 章确认文案） */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-zinc-900">{confirmDialog.title}</h3>
            <p className="text-sm text-zinc-600 leading-relaxed">{confirmDialog.content}</p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              >
                取消
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 text-xs font-medium rounded-lg text-white ${
                  confirmDialog.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-zinc-900 hover:bg-zinc-800'
                }`}
              >
                {confirmDialog.confirmText || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全局轻提示 Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-medium animate-fade-in">
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </>
  );
}
