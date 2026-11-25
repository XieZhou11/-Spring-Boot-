import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckSquare,
  CreditCard,
  FileText,
  Hammer,
  Inbox,
  LogOut,
  MessageSquare,
  Package,
  Palette,
  Plus,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { AdminViews } from './AdminViews';
import { AuthView } from './AuthView';
import { BuyerDemands } from './BuyerDemands';
import { BuyerWorks } from './BuyerWorks';
import { CreatorViews } from './CreatorViews';
import {
  CATEGORIES,
  INITIAL_ADDRESSES,
  INITIAL_ADMIN_AUDITS,
  INITIAL_CONVERSATIONS,
  INITIAL_DEMANDS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ORDERS,
  INITIAL_REFUNDS,
  INITIAL_WORKS,
} from './DemoData';
import { MessageView } from './MessageView';
import { OrderView } from './OrderView';
import { Overlays } from './Overlays';

// 单一入口负责全局状态及跨角色演示流程。
export default function App() {
  // 认证与身份视图（BU: 买家 | CR: 创作者 | AD: 管理员）
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [authMode, setAuthMode] = useState('LOGIN'); // LOGIN | REGISTER | RESET
  const [activeRole, setActiveRole] = useState('BU');
  const [activeTab, setActiveTab] = useState('plaza');

  // 创作者自身状态（支持主动暂停接单）
  const [creatorPausedSelf, setCreatorPausedSelf] = useState(false);

  // 核心业务数据状态
  const [works, setWorks] = useState(INITIAL_WORKS);
  const [demands, setDemands] = useState(INITIAL_DEMANDS);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [addresses, setAddresses] = useState(INITIAL_ADDRESSES);
  const [conversations, setConversations] = useState(INITIAL_CONVERSATIONS);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [audits, setAudits] = useState(INITIAL_ADMIN_AUDITS);
  const [refunds, setRefunds] = useState(INITIAL_REFUNDS);
  const [categories, setCategories] = useState(CATEGORIES);

  // 选中的详情对象
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [selectedDemandId, setSelectedDemandId] = useState('REQ-20261120-01');
  const [selectedOrderId, setSelectedOrderId] = useState('ORD-20261110-8801');
  const [selectedConvId, setSelectedConvId] = useState('CONV-1');

  // 筛选与排序状态（作品广场）
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCatL1, setFilterCatL1] = useState('全部');
  const [filterTrade, setFilterTrade] = useState('ALL'); // ALL | STOCK | CUSTOM
  const [sortBy, setSortBy] = useState('NEWEST'); // NEWEST | PRICE_ASC | PRICE_DESC

  // 报价对比排序
  const [quoteSort, setQuoteSort] = useState('PRICE'); // PRICE | DAYS | RATING

  // 弹窗状态
  const [modal, setModal] = useState(null); // { type, payload }
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, content, confirmText, danger, onConfirm }
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  // 切换身份时自动切到对应默认页面
  const switchRole = (role) => {
    setActiveRole(role);
    setSelectedWorkId(null);
    if (role === 'BU') setActiveTab('plaza');
    if (role === 'CR') setActiveTab('cr-hall');
    if (role === 'AD') setActiveTab('ad-dashboard');
    const roleLabel = role === 'BU' ? '买家视角' : role === 'CR' ? '创作者工作台' : '管理后台';
    showToast(`已切换至「${roleLabel}」`, 'info');
  };

  // 计算未读消息总数（超过99显示99+）
  const unreadTotal = useMemo(() => {
    const convUnread = conversations.reduce((sum, c) => sum + c.unread, 0);
    const notifUnread = notifications.filter((n) => !n.read).length;
    return convUnread + notifUnread;
  }, [conversations, notifications]);

  // 过滤并排序后的作品列表（严格遵守 4.2.3：纯展示无价格作品不视为 0 元，价格排序排在最后）
  const filteredWorks = useMemo(() => {
    let list = works.filter((w) => w.auditStatus === 'ONLINE');
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((w) => w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q) || w.material.toLowerCase().includes(q));
    }
    if (filterCatL1 !== '全部') {
      list = list.filter((w) => w.categoryL1 === filterCatL1);
    }
    if (filterTrade === 'STOCK') {
      list = list.filter((w) => w.sellStock && w.stockStatus === 'AVAILABLE');
    } else if (filterTrade === 'CUSTOM') {
      list = list.filter((w) => w.acceptCustom);
    }

    const sorted = [...list];
    if (sortBy === 'NEWEST') {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else if (sortBy === 'PRICE_ASC' || sortBy === 'PRICE_DESC') {
      sorted.sort((a, b) => {
        const aPurchasable = a.sellStock && a.stockStatus === 'AVAILABLE' && a.stockPrice != null;
        const bPurchasable = b.sellStock && b.stockStatus === 'AVAILABLE' && b.stockPrice != null;
        if (aPurchasable && !bPurchasable) return -1;
        if (!aPurchasable && bPurchasable) return 1;
        if (!aPurchasable && !bPurchasable) return 0;
        return sortBy === 'PRICE_ASC' ? a.stockPrice - b.stockPrice : b.stockPrice - a.stockPrice;
      });
    }
    return sorted;
  }, [works, searchQuery, filterCatL1, filterTrade, sortBy]);

  // ============================================================================
  // 核心业务操作函数（严格遵循需求说明书规则）
  // ============================================================================

  // 1. 成品直购下单（4.5.1 & 4.2.1 锁定单件现货）
  const handleBuyStock = (work, addressId) => {
    const addr = addresses.find((a) => a.id === addressId) || addresses[0];
    if (!addr) {
      showToast('请先添加收货地址', 'error');
      return;
    }
    const newOrderId = `ORD-20261123-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder = {
      id: newOrderId,
      type: 'STOCK',
      title: `${work.title}（现货直购）`,
      variant: work.variant,
      buyerName: '林清浅',
      creatorId: work.authorId,
      creatorName: work.authorName,
      amount: work.stockPrice,
      status: 'PENDING_PAY',
      statusBeforeAfterSale: null,
      createdAt: '2026-11-23 10:30',
      paidAt: null,
      expectedShipDate: '支付后 48 小时内',
      shippedAt: null,
      trackingNo: null,
      trackingHistory: [],
      completedAt: null,
      addressSnapshot: `${addr.recipient}，${addr.phone}，${addr.region} ${addr.detail}`,
      settlementStatus: 'NONE',
      payoutAccountSnapshot: '已审核收款账户（脱敏）',
      showcaseAuth: null,
      reviewed: false,
      nodes: []
    };

    // 锁定该件单品现货
    setWorks((prev) => prev.map((w) => (w.id === work.id ? { ...w, stockStatus: 'RESERVED' } : w)));
    setOrders((prev) => [newOrder, ...prev]);
    setSelectedOrderId(newOrderId);
    setModal(null);
    setSelectedWorkId(null);
    setActiveTab('orders');
    showToast(`已锁定现货并生成订单 ${newOrderId}，请在 24 小时内完成支付`);
  };

  // 2. 定标并同步生成待付款定制订单（4.4.3 原子性定标）
  const handleAwardQuote = (demand, quote, addressId) => {
    const addr = addresses.find((a) => a.id === addressId) || addresses[0];
    const newOrderId = `ORD-20261123-${Math.floor(1000 + Math.random() * 9000)}`;

    // 更新需求与报价状态（唯一中标，其余落选）
    setDemands((prev) =>
      prev.map((d) => {
        if (d.id !== demand.id) return d;
        return {
          ...d,
          status: 'AWARDED',
          quotes: d.quotes.map((q) => ({
            ...q,
            status: q.id === quote.id ? 'AWARDED' : q.status === 'ACTIVE' ? 'LOST' : q.status
          }))
        };
      })
    );

    // 同步生成唯一待付款定制订单（含 5 个固定节点）
    const newOrder = {
      id: newOrderId,
      type: 'CUSTOM',
      title: `${demand.title}（定制）`,
      variant: demand.categoryL1 === '木作' ? 'wood' : demand.categoryL1 === '陶艺' ? 'ceramic' : 'leather',
      buyerName: '林清浅',
      creatorId: quote.creatorId,
      creatorName: quote.creatorName,
      amount: quote.price,
      status: 'PENDING_PAY',
      statusBeforeAfterSale: null,
      createdAt: '2026-11-23 10:32',
      paidAt: null,
      expectedShipDate: quote.estimatedShipDate,
      shippedAt: null,
      trackingNo: null,
      trackingHistory: [],
      completedAt: null,
      addressSnapshot: `${addr.recipient}，${addr.phone}，${addr.region} ${addr.detail}`,
      settlementStatus: 'NONE',
      payoutAccountSnapshot: '已审核收款账户（脱敏）',
      showcaseAuth: { status: 'NONE', appliedAt: null, repliedAt: null },
      reviewed: false,
      nodes: [
        { key: 'MATERIAL', name: '备料', ratio: '15%', status: 'NOT_STARTED', plannedDate: '支付后计算', actualTime: null, deviation: null, note: '', supplements: [] },
        { key: 'SAMPLE', name: '打样打版', ratio: '20%', status: 'NOT_STARTED', plannedDate: '支付后计算', actualTime: null, deviation: null, note: '', supplements: [] },
        { key: 'MAKING', name: '制作', ratio: '45%', status: 'NOT_STARTED', plannedDate: '支付后计算', actualTime: null, deviation: null, note: '', supplements: [] },
        { key: 'QC', name: '质检', ratio: '10%', status: 'NOT_STARTED', plannedDate: '支付后计算', actualTime: null, deviation: null, note: '', supplements: [] },
        { key: 'SHIPPING', name: '包装发货', ratio: '10%', status: 'NOT_STARTED', plannedDate: '支付后计算', actualTime: null, deviation: null, note: '', supplements: [] },
      ]
    };

    setOrders((prev) => [newOrder, ...prev]);
    setSelectedOrderId(newOrderId);
    setModal(null);
    setActiveTab('orders');
    showToast(`定标成功！已选定「${quote.creatorName}」，同步生成待付款订单 ${newOrderId}`);
  };

  // 3. 模拟支付（4.5.1：现货直达待发货，定制进入待开工并生成待结算记录）
  const handleSimulatePay = (order) => {
    const confirmMsg =
      order.type === 'CUSTOM'
        ? `制作开始后不支持单方无理由退款，确认支付 ¥${order.amount.toFixed(2)} 元？`
        : `支付后直接等待发货，确认支付 ¥${order.amount.toFixed(2)} 元？`;

    setConfirmDialog({
      title: '模拟支付确认',
      content: confirmMsg,
      confirmText: `确认支付 ¥${order.amount.toFixed(2)}`,
      onConfirm: () => {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== order.id) return o;
            const nextStatus = o.type === 'STOCK' ? 'PENDING_SHIP' : 'PAID';
            return {
              ...o,
              status: nextStatus,
              paidAt: '2026-11-23 10:35',
              settlementStatus: 'PENDING',
              nodes:
                o.type === 'CUSTOM'
                  ? o.nodes.map((n, idx) => ({
                      ...n,
                      plannedDate: ['2026-11-26', '2026-11-29', '2026-12-05', '2026-12-07', '2026-12-08'][idx]
                    }))
                  : []
            };
          })
        );
        setConfirmDialog(null);
        showToast(
          order.type === 'STOCK'
            ? '模拟支付成功！现货订单已进入「待发货」状态'
            : '模拟支付成功！定制订单已进入「待开工」，创作者须在 48 小时内确认开工'
        );
      }
    });
  };

  // 4. 创作者确认开工（4.5.2 & 4.6.1 解锁首节点）
  const handleStartProduction = (orderId) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status: 'IN_PRODUCTION',
          nodes: o.nodes.map((n, idx) => (idx === 0 ? { ...n, status: 'UNLOCKED' } : n))
        };
      })
    );
    showToast('已确认开工，首节点「备料」已解锁');
  };

  // 5. 创作者节点打卡 / 跳过打样 / 第五节点同步发货（4.6.2）
  const handleNodeAction = (orderId, nodeIndex, { action, note, trackingNo }) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const updatedNodes = o.nodes.map((n, idx) => {
          if (idx === nodeIndex) {
            if (action === 'SKIP') {
              return { ...n, status: 'SKIPPED', actualTime: '2026-11-23 10:40', deviation: '已跳过', skipReason: note };
            }
            return { ...n, status: 'CHECKED', actualTime: '2026-11-23 10:40', deviation: '按期完成', note };
          }
          if (idx === nodeIndex + 1 && n.status === 'NOT_STARTED') {
            return { ...n, status: 'UNLOCKED' };
          }
          return n;
        });

        let nextOrderStatus = o.status;
        let nextTrackingNo = o.trackingNo;
        let nextShippedAt = o.shippedAt;

        if (nodeIndex === 3) {
          nextOrderStatus = 'PENDING_SHIP'; // 前四节点完成进入待发货
        }
        if (nodeIndex === 4) {
          nextOrderStatus = 'SHIPPED'; // 第五节点图文与运单号同步生效
          nextTrackingNo = trackingNo;
          nextShippedAt = '2026-11-23 10:40';
        }

        return {
          ...o,
          status: nextOrderStatus,
          trackingNo: nextTrackingNo,
          shippedAt: nextShippedAt,
          nodes: updatedNodes
        };
      })
    );
    setModal(null);
    showToast(nodeIndex === 4 ? '包装发货节点与运单号已同步生效，已通知买家' : action === 'SKIP' ? '已跳过「打样打版」并解锁下一节点' : '节点图文打卡成功，已实时通知买家');
  };

  // 6. 买家确认收货
  const handleConfirmReceive = (orderId) => {
    setConfirmDialog({
      title: '确认收货',
      content: '确认已收到手工成品且验收无误？确认后订单将变更为已完成，可在 7 天内发表评价或申请售后。',
      confirmText: '确认收货',
      onConfirm: () => {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: 'COMPLETED', completedAt: '2026-11-23 10:45' } : o))
        );
        setConfirmDialog(null);
        showToast('已确认收货，欢迎在 7 天内为本次定制体验写下评价');
      }
    });
  };

  // 7. 定制成品公开授权（4.2.6）
  const handleShowcaseAuth = (orderId, nextStatus) => {
    const dialogMap = {
      PENDING: {
        title: '申请公开成品案例',
        content: '确认向买家申请公开本次成品案例？只有买家明确同意后，才可整理关联作品并提交审核。',
        confirmText: '发送申请'
      },
      APPROVED: {
        title: '同意公开成品案例',
        content: '确认同意创作者展示本次定制成品？授权不包含你的收货资料和聊天记录。',
        confirmText: '同意公开'
      },
      REJECTED: {
        title: '不同意公开成品案例',
        content: '确认不同意公开本次定制成品案例？确认后创作者将无法发布该订单的关联案例。',
        confirmText: '确认不同意',
        danger: true
      }
    };
    const cfg = dialogMap[nextStatus];
    setConfirmDialog({
      ...cfg,
      onConfirm: () => {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              showcaseAuth: {
                status: nextStatus,
                appliedAt: nextStatus === 'PENDING' ? '2026-11-23 10:50' : o.showcaseAuth.appliedAt,
                repliedAt: nextStatus === 'PENDING' ? null : '2026-11-23 10:52'
              }
            };
          })
        );
        setConfirmDialog(null);
        showToast(
          nextStatus === 'PENDING'
            ? '已向买家发送公开成品案例申请，等待明确回复'
            : nextStatus === 'APPROVED'
            ? '已同意公开，已通知创作者可整理并提交审核'
            : '已回复不同意公开本次成品案例'
        );
      }
    });
  };

  // 8. 管理员审核队列处理
  const handleAdminAudit = (auditId, decision) => {
    setAudits((prev) => prev.map((a) => (a.id === auditId ? { ...a, status: decision } : a)));
    showToast(decision === 'APPROVED' ? '审核已通过，已自动通知申请人并记录操作日志' : '已驳回申请并附带原因通知申请人');
  };

  // 9. 管理员退款裁定
  const handleAdminRefund = (refundId, decision) => {
    setRefunds((prev) => prev.map((r) => (r.id === refundId ? { ...r, status: decision } : r)));
    showToast(
      decision === 'REFUNDED'
        ? '已批准全额退款，系统已同步返还实付金额并取消待结算记录'
        : '已驳回退款申请，订单已恢复原履约状态'
    );
  };

  // ============================================================================
  // 5. 未登录页面（符合 3.1 & 4.1.1：仅支持 QQ/163 邮箱验证码注册登录）
  // ============================================================================
  if (!isLoggedIn) {
    return (
      <AuthView {...{ setAuthMode, authMode, setIsLoggedIn, showToast }} />
    );
  }

  // ============================================================================
  // 6. 导航配置
  // ============================================================================
  const navItems =
    activeRole === 'BU'
      ? [
          { id: 'plaza', label: '作品广场', icon: Sparkles },
          { id: 'demands', label: '定制需求与报价', icon: FileText, badge: demands.filter((d) => d.status === 'QUOTING').length },
          { id: 'orders', label: '我的订单', icon: Package, badge: orders.filter((o) => o.status === 'IN_PRODUCTION' || o.status === 'PENDING_PAY').length },
          { id: 'messages', label: '消息中心', icon: MessageSquare, badge: unreadTotal },
        ]
      : activeRole === 'CR'
      ? [
          { id: 'cr-hall', label: '需求大厅', icon: Inbox },
          { id: 'cr-works', label: '作品管理', icon: Palette },
          { id: 'orders', label: '接单与履约打卡', icon: Hammer },
          { id: 'cr-finance', label: '收入与模拟结算', icon: CreditCard },
          { id: 'messages', label: '消息中心', icon: MessageSquare, badge: unreadTotal },
        ]
      : [
          { id: 'ad-dashboard', label: '数据看板', icon: BarChart3 },
          { id: 'ad-audit', label: '审核中心', icon: CheckSquare, badge: audits.filter((a) => a.status === 'PENDING').length },
          { id: 'ad-refunds', label: '售后与退款裁定', icon: Shield, badge: refunds.filter((r) => r.status === 'WAIT_ADMIN').length },
          { id: 'ad-governance', label: '用户与品类管理', icon: Users },
        ];

  const selectedWork = works.find((w) => w.id === selectedWorkId);
  const selectedDemand = demands.find((d) => d.id === selectedDemandId) || demands[0];
  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];
  const selectedConv = conversations.find((c) => c.id === selectedConvId) || conversations[0];

  // ============================================================================
  // 7. 主页面结构
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans antialiased flex flex-col">
      {/* 顶部全局导航栏 */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* 左侧 Logo 与主导航 */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => {
                setSelectedWorkId(null);
                setActiveTab(activeRole === 'BU' ? 'plaza' : activeRole === 'CR' ? 'cr-hall' : 'ad-dashboard');
              }}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-900 text-amber-400 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Hammer className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold tracking-tight text-zinc-900 leading-none">匠心集</div>
                <div className="text-[10px] text-zinc-400 tracking-wider uppercase mt-0.5">CraftFlow MVP</div>
              </div>
            </button>

            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id && !selectedWorkId;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedWorkId(null);
                      setActiveTab(item.id);
                    }}
                    className={`relative px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                      active
                        ? 'bg-zinc-100 text-zinc-900'
                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.badge > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 text-[11px] font-semibold rounded-full bg-amber-600 text-white leading-tight">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 右侧：快捷发布 + 角色视角切换器 + 账号 */}
          <div className="flex items-center gap-3">
            {activeRole === 'BU' && (
              <button
                onClick={() => setModal({ type: 'CREATE_DEMAND', payload: { scope: 'PUBLIC' } })}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                发布定制需求
              </button>
            )}
            {activeRole === 'CR' && (
              <button
                onClick={() => {
                  if (creatorPausedSelf) {
                    showToast('当前已主动暂停接单，请先恢复接单后再发布新作品', 'error');
                    return;
                  }
                  setModal({ type: 'PUBLISH_WORK' });
                }}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                发布原创作品
              </button>
            )}

            {/* 三端身份切换胶囊（原型评审神器） */}
            <div className="flex items-center bg-zinc-100 p-1 rounded-lg border border-zinc-200/70">
              {[
                { id: 'BU', label: '买家' },
                { id: 'CR', label: '创作者' },
                { id: 'AD', label: '管理后台' }
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => switchRole(r.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    activeRole === r.id
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* 用户信息与退出 */}
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
              <button
                onClick={() => setModal({ type: 'PROFILE' })}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-zinc-100 transition-colors"
                title="个人资料与地址管理"
              >
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-semibold text-xs flex items-center justify-center border border-amber-200">
                  {activeRole === 'AD' ? '管' : activeRole === 'CR' ? '陈' : '林'}
                </div>
                <span className="hidden xl:inline text-xs font-medium text-zinc-700">
                  {activeRole === 'AD' ? '系统管理员' : activeRole === 'CR' ? '陈木生工坊' : '林清浅'}
                </span>
              </button>
              <button
                onClick={() => setIsLoggedIn(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                title="退出登录（查看登录/注册原型）"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-7">
        <BuyerWorks
          {...{
            activeRole, activeTab, selectedWork, searchQuery, setSearchQuery, sortBy,
            setSortBy, categories, setFilterCatL1, filterCatL1, setFilterTrade, filterTrade,
            filteredWorks, setSelectedWorkId, setWorks, showToast, setModal,
          }}
        />
        <BuyerDemands
          {...{
            activeRole, activeTab, demands, setModal, selectedDemand, setSelectedDemandId,
            setConfirmDialog, setDemands, showToast, setQuoteSort, quoteSort, setActiveTab,
          }}
        />
        <OrderView
          {...{
            activeTab, activeRole, orders, selectedOrder, setSelectedOrderId,
            handleSimulatePay, handleStartProduction, setModal, handleConfirmReceive,
            handleShowcaseAuth, setActiveTab, showToast,
          }}
        />
        <MessageView
          {...{
            activeTab, conversations, notifications, selectedConv, setSelectedConvId,
            setConversations, setNotifications, setSelectedOrderId, setActiveTab,
            setSelectedDemandId, activeRole,
          }}
        />
        <CreatorViews
          {...{
            activeRole, activeTab, creatorPausedSelf, setCreatorPausedSelf, showToast,
            demands, setConfirmDialog, setDemands, setModal, works, setWorks, orders,
          }}
        />
        <AdminViews
          {...{
            activeRole, activeTab, showToast, audits, refunds, handleAdminAudit,
            handleAdminRefund, categories, setCategories, setConfirmDialog,
          }}
        />
      </main>

      <Overlays
        {...{
          modal, addresses, setModal, handleBuyStock, handleAwardQuote, categories,
          setDemands, setSelectedDemandId, setSelectedWorkId, setActiveTab, showToast,
          handleNodeAction, setOrders, setRefunds, setWorks, setAudits, setAddresses,
          confirmDialog, setConfirmDialog, toast,
        }}
      />
    </div>
  );
}
