import React, { useState } from 'react';
import { ExternalLink, Lock, Send } from 'lucide-react';
import { Badge } from './CommonUi';

// 买家与创作者共用的会话及通知界面。
export function MessageView({
  activeTab,
  conversations,
  notifications,
  selectedConv,
  setSelectedConvId,
  setConversations,
  setNotifications,
  setSelectedOrderId,
  setActiveTab,
  setSelectedDemandId,
  activeRole,
}) {
  return (
    <>
      {/* ================= 视图 4：站内实时消息中心（4.8） ================= */}
      {activeTab === 'messages' && (
        <MessageCenterView
          conversations={conversations}
          notifications={notifications}
          selectedConv={selectedConv}
          onSelectConv={(id) => {
            setSelectedConvId(id);
            setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
          }}
          onMarkNotifRead={(id) =>
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
          }
          onSendMessage={(convId, text) => {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId
                  ? {
                      ...c,
                      lastTime: '刚刚',
                      messages: [...c.messages, { id: `m-${Date.now()}`, sender: 'ME', time: '刚刚', text }]
                    }
                  : c
              )
            );
          }}
          onJumpRef={(conv) => {
            if (conv.refType === 'ORDER') {
              setSelectedOrderId(conv.refId);
              setActiveTab('orders');
            } else {
              setSelectedDemandId(conv.refId);
              setActiveTab(activeRole === 'CR' ? 'cr-hall' : 'demands');
            }
          }}
        />
      )}
    </>
  );
}

function MessageCenterView({ conversations, notifications, selectedConv, onSelectConv, onMarkNotifRead, onSendMessage, onJumpRef }) {
  const [subTab, setSubTab] = useState('CONV'); // CONV | NOTIF
  const [input, setInput] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || selectedConv.archived) return;
    onSendMessage(selectedConv.id, input.trim());
    setInput('');
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
      {/* 左侧列表 */}
      <div className="lg:col-span-4 border-r border-zinc-100 flex flex-col">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-2">
          <button
            onClick={() => setSubTab('CONV')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              subTab === 'CONV' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            交易会话 ({conversations.length})
          </button>
          <button
            onClick={() => setSubTab('NOTIF')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              subTab === 'NOTIF' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            系统通知 ({notifications.filter((n) => !n.read).length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
          {subTab === 'CONV'
            ? conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSelectConv(c.id)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedConv?.id === c.id ? 'bg-zinc-50' : 'hover:bg-zinc-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                      {c.peerName}
                      {c.archived && <Lock className="w-3 h-3 text-zinc-400" />}
                    </span>
                    <span className="text-[11px] text-zinc-400">{c.lastTime}</span>
                  </div>
                  <div className="text-[11px] text-amber-700 truncate mb-1">
                    [{c.refStatus}] {c.refTitle}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-zinc-500 truncate">{c.messages[c.messages.length - 1]?.text}</p>
                    {c.unread > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-600 text-white rounded-full">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              ))
            : notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => onMarkNotifRead(n.id)}
                  className={`p-4 cursor-pointer transition-colors ${!n.read ? 'bg-amber-50/40' : 'hover:bg-zinc-50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge tone={!n.read ? 'amber' : 'neutral'}>{n.type}</Badge>
                    <span className="text-[11px] text-zinc-400">{n.time}</span>
                  </div>
                  <div className="text-xs font-semibold text-zinc-900 mt-1">{n.title}</div>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{n.content}</p>
                </div>
              ))}
        </div>
      </div>

      {/* 右侧聊天窗口 */}
      <div className="lg:col-span-8 flex flex-col bg-[#FAFAFB]">
        {selectedConv ? (
          <>
            {/* 会话顶栏：关联业务卡片 */}
            <div className="bg-white px-6 py-4 border-b border-zinc-100 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-zinc-900">{selectedConv.peerName}</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  关联{selectedConv.refType === 'ORDER' ? '订单' : '需求'}：{selectedConv.refTitle}（{selectedConv.refStatus}）
                </div>
              </div>
              <button
                onClick={() => onJumpRef(selectedConv)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 flex items-center gap-1"
              >
                查看详情 <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* 订单结束后提示（B-20） */}
            {selectedConv.refType === 'ORDER' && selectedConv.refStatus === '已完成' && (
              <div className="bg-zinc-100 px-6 py-2 text-[11px] text-zinc-600 border-b border-zinc-200/70">
                提示：订单已结束，双方仍可继续沟通和补充证据；付款、制作节点及已结束的退款申请窗口不会重新开放。
              </div>
            )}

            {/* 消息流 */}
            <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[420px]">
              {selectedConv.messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender === 'ME' ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-zinc-400 mb-1">{m.time}</span>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      m.sender === 'ME'
                        ? 'bg-zinc-900 text-white rounded-tr-sm'
                        : 'bg-white border border-zinc-200/80 text-zinc-800 rounded-tl-sm'
                    }`}
                  >
                    {m.nodeRef && (
                      <div className="mb-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-200/60 text-amber-800 text-[11px] font-medium">
                        引用进度：{m.nodeRef}
                      </div>
                    )}
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* 输入栏或归档只读提示（B-12） */}
            <div className="bg-white p-4 border-t border-zinc-100">
              {selectedConv.archived ? (
                <div className="py-2.5 px-4 rounded-xl bg-zinc-100 text-xs text-zinc-500 text-center flex items-center justify-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  你与对方未形成订单且需求已关闭/过期，或你未中标，会话已归档，仅可查看历史消息。
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex items-center gap-2.5">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="输入消息（1—500 字，60 秒最多 20 条，自动过滤站外引流）..."
                    className="flex-1 px-4 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:border-zinc-900"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-xl flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> 发送
                  </button>
                </form>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
