import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Plus, Bell, MessageSquare, User, Shield, Palette, ShoppingBag,
  CheckCircle2, Clock, AlertCircle, Star, Heart, Bookmark, ChevronRight,
  SlidersHorizontal, ArrowUpDown, FileText, Package, Truck, Award,
  Send, Image as ImageIcon, X, Check, AlertTriangle, Lock, Unlock,
  RefreshCw, Eye, Layers, Sparkles, Filter, MoreHorizontal, LogOut,
  MapPin, CreditCard, Ban, RotateCcw, ThumbsUp, Flag, ExternalLink,
  Calendar, DollarSign, Users, BarChart3, CheckSquare, Inbox, Hammer
} from 'lucide-react';

// ============================================================================
// 1. 视觉艺术占位组件（无外部图片依赖，永不裂图，呈现高级手工艺品美学）
// ============================================================================
const CraftArtworkCover = ({ variant = 'leather', title, className = 'h-48' }) => {
  const styles = {
    leather: {
      bg: 'from-[#F3EAE0] via-[#E8D5C4] to-[#D6B89C]',
      accent: '#8B5A2B',
      sub: '#5C3A21',
      label: '植鞣革 · 手工皮具',
      svg: (
        <svg viewBox="0 0 200 140" className="w-full h-full opacity-90">
          <rect x="42" y="28" width="116" height="84" rx="12" fill="#8B5A2B" fillOpacity="0.18" stroke="#8B5A2B" strokeWidth="1.5" />
          <rect x="52" y="38" width="96" height="64" rx="8" fill="none" stroke="#8B5A2B" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="100" cy="70" r="9" fill="#B47B44" fillOpacity="0.45" stroke="#5C3A21" strokeWidth="1.5" />
          <path d="M42 56 H158" stroke="#8B5A2B" strokeWidth="1" strokeOpacity="0.4" />
        </svg>
      )
    },
    wood: {
      bg: 'from-[#EFECE6] via-[#DFD7C8] to-[#C8BBA4]',
      accent: '#5D4E37',
      sub: '#3E3323',
      label: '黑胡桃 · 传统木作',
      svg: (
        <svg viewBox="0 0 200 140" className="w-full h-full opacity-90">
          <ellipse cx="100" cy="74" rx="62" ry="30" fill="#5D4E37" fillOpacity="0.16" stroke="#5D4E37" strokeWidth="1.5" />
          <ellipse cx="100" cy="74" rx="48" ry="20" fill="none" stroke="#5D4E37" strokeWidth="1" strokeOpacity="0.5" />
          <path d="M55 74 Q100 58 145 74" fill="none" stroke="#5D4E37" strokeWidth="1" strokeOpacity="0.35" />
          <path d="M62 82 Q100 68 138 82" fill="none" stroke="#5D4E37" strokeWidth="1" strokeOpacity="0.35" />
        </svg>
      )
    },
    ceramic: {
      bg: 'from-[#EEF2F3] via-[#DCE4E7] to-[#C5D2D8]',
      accent: '#3B596A',
      sub: '#243B47',
      label: '景德镇 · 柴烧陶艺',
      svg: (
        <svg viewBox="0 0 200 140" className="w-full h-full opacity-90">
          <path d="M76 34 H124 L134 94 C134 108 118 114 100 114 C82 114 66 108 66 94 Z" fill="#3B596A" fillOpacity="0.18" stroke="#3B596A" strokeWidth="1.5" />
          <ellipse cx="100" cy="34" rx="24" ry="6" fill="#3B596A" fillOpacity="0.12" stroke="#3B596A" strokeWidth="1.5" />
          <path d="M70 76 Q100 84 130 76" fill="none" stroke="#3B596A" strokeWidth="1" strokeOpacity="0.45" />
        </svg>
      )
    },
    jewelry: {
      bg: 'from-[#F5F2EE] via-[#EAE2D7] to-[#DDD1C0]',
      accent: '#9A6B2F',
      sub: '#6B481B',
      label: '925银 · 失蜡铸造',
      svg: (
        <svg viewBox="0 0 200 140" className="w-full h-full opacity-90">
          <circle cx="100" cy="70" r="34" fill="none" stroke="#9A6B2F" strokeWidth="2.5" strokeOpacity="0.65" />
          <circle cx="100" cy="70" r="26" fill="none" stroke="#9A6B2F" strokeWidth="1" strokeOpacity="0.35" />
          <polygon points="100,26 108,38 100,46 92,38" fill="#9A6B2F" fillOpacity="0.4" stroke="#9A6B2F" strokeWidth="1.2" />
        </svg>
      )
    },
    weaving: {
      bg: 'from-[#F2EFE9] via-[#E5DFD3] to-[#D4CBB8]',
      accent: '#6E5D4F',
      sub: '#473B31',
      label: '天然草木染 · 手工编织',
      svg: (
        <svg viewBox="0 0 200 140" className="w-full h-full opacity-90">
          <rect x="52" y="30" width="96" height="80" rx="6" fill="#6E5D4F" fillOpacity="0.14" stroke="#6E5D4F" strokeWidth="1.2" />
          {[46, 62, 78, 94].map((y) => (
            <line key={y} x1="52" y1={y} x2="148" y2={y} stroke="#6E5D4F" strokeWidth="1" strokeOpacity="0.35" />
          ))}
          {[72, 90, 108, 126].map((x) => (
            <line key={x} x1={x} y1="30" x2={x} y2="110" stroke="#6E5D4F" strokeWidth="1" strokeOpacity="0.35" />
          ))}
        </svg>
      )
    }
  };

  const s = styles[variant] || styles.leather;
  return (
    <div className={`relative w-full ${className} bg-gradient-to-br ${s.bg} overflow-hidden flex items-center justify-center select-none`}>
      <div className="w-full h-full max-w-[240px] flex items-center justify-center">{s.svg}</div>
      <span
        className="absolute bottom-2.5 left-3 text-[11px] font-medium tracking-wide px-2 py-0.5 rounded-full bg-white/75 backdrop-blur-sm"
        style={{ color: s.sub }}
      >
        {s.label}
      </span>
    </div>
  );
};

// ============================================================================
// 2. 初始业务数据（严格对应需求规格说明书字段与状态模型）
// ============================================================================
const CATEGORIES = [
  { id: 'c1', name: '皮具', enabled: true, children: [{ id: 'c1-1', name: '钱包', enabled: true }, { id: 'c1-2', name: '卡包', enabled: true }, { id: 'c1-3', name: '托特包', enabled: true }] },
  { id: 'c2', name: '木作', enabled: true, children: [{ id: 'c2-1', name: '茶盘', enabled: true }, { id: 'c2-2', name: '桌面摆件', enabled: true }] },
  { id: 'c3', name: '陶艺', enabled: true, children: [{ id: 'c3-1', name: '手工茶具', enabled: true }, { id: 'c3-2', name: '花器', enabled: true }] },
  { id: 'c4', name: '饰品', enabled: true, children: [{ id: 'c4-1', name: '银饰戒指', enabled: true }, { id: 'c4-2', name: '吊坠', enabled: true }] },
  { id: 'c5', name: '编织', enabled: true, children: [{ id: 'c5-1', name: '挂毯', enabled: true }] },
];

const INITIAL_ADDRESSES = [
  { id: 'addr-1', recipient: '林清浅', phone: '13800138001', region: '浙江省 杭州市 西湖区', detail: '文三路 259 号昌地火炬大厦 2 号楼 802', isDefault: true },
  { id: 'addr-2', recipient: '林清浅', phone: '13800138001', region: '上海市 静安区', detail: '南京西路 1266 号恒隆广场办公楼 1 座 15F', isDefault: false },
];

const INITIAL_WORKS = [
  {
    id: 'W-1001',
    title: '意大利植鞣革手工双折短款钱包',
    categoryL1: '皮具',
    categoryL2: '钱包',
    variant: 'leather',
    material: '意大利马臀植鞣革、日本麻线、黄铜四合扣',
    spec: '11.2cm × 9.5cm × 1.8cm（6卡位+双钞位）',
    sellStock: true,
    stockStatus: 'AVAILABLE', // AVAILABLE | RESERVED | SOLD_OUT
    stockPrice: 680,
    acceptCustom: true,
    customDays: 12,
    auditStatus: 'ONLINE',
    authorId: 'cr-1',
    authorName: '陈木生皮具工坊',
    authorRegion: '浙江 · 杭州',
    authorRating: 4.9,
    authorReviewCount: 38,
    authorGoodRate: '97.4%',
    authorCompletedOrders: 46,
    likes: 128,
    favorites: 64,
    liked: false,
    favorited: true,
    createdAt: '2026-11-20',
    description: '选用意大利托斯卡纳原色植鞣革，全手工斩孔双针马鞍缝法，边缘经五道打磨与蜂蜡封边。随着日常使用会逐渐养出温润琥珀包浆，可提供免费刻字与配色定制。',
    processNote: '选皮开料 → 削薄处理 → 菱斩打孔 → 双针手缝 → 边油与蜂蜡反复打磨。',
    comments: [
      { id: 'cm-1', author: '苏微凉', time: '2026-11-21 14:20', text: '封边非常细腻！之前买过师傅的卡包，用了一年包浆特别好看，打算再定制一个深棕色的钱包。', isMine: false }
    ]
  },
  {
    id: 'W-1002',
    title: '北美黑胡桃木整板干泡茶盘',
    categoryL1: '木作',
    categoryL2: '茶盘',
    variant: 'wood',
    material: 'FAS级北美黑胡桃木、食品级木蜡油',
    spec: '48cm × 26cm × 3.2cm',
    sellStock: true,
    stockStatus: 'SOLD_OUT',
    stockPrice: 1280,
    acceptCustom: true,
    customDays: 18,
    auditStatus: 'ONLINE',
    authorId: 'cr-2',
    authorName: '山间木作研究所',
    authorRegion: '福建 · 厦门',
    authorRating: 4.8,
    authorReviewCount: 21,
    authorGoodRate: '95.2%',
    authorCompletedOrders: 27,
    likes: 215,
    favorites: 109,
    liked: true,
    favorited: false,
    createdAt: '2026-11-18',
    description: '整块北美黑胡桃木手工刨削成型，保留自然木纹走向，盘面微弧导水设计，采用天然食品级木蜡油三遍涂装，防水防裂。该件现货已售出，接受按尺寸定制同类作品。',
    processNote: '选料烘干 → 手工推刨定型 → 细砂纸逐级打磨至2000目 → 木蜡油阴干养护。',
    comments: []
  },
  {
    id: 'W-1003',
    title: '景德镇草木灰釉手拉坯柴烧主人杯',
    categoryL1: '陶艺',
    categoryL2: '手工茶具',
    variant: 'ceramic',
    material: '原矿高岭土、松木草木灰天然釉',
    spec: '口径 7.2cm × 高 5.8cm，容量约 110ml',
    sellStock: false,
    stockStatus: null,
    stockPrice: null,
    acceptCustom: true,
    customDays: 25,
    auditStatus: 'ONLINE',
    authorId: 'cr-3',
    authorName: '青屿窑口',
    authorRegion: '江西 · 景德镇',
    authorRating: 5.0,
    authorReviewCount: 14,
    authorGoodRate: '100%',
    authorCompletedOrders: 16,
    likes: 94,
    favorites: 51,
    liked: false,
    favorited: false,
    createdAt: '2026-11-16',
    description: '纯手工拉坯修足，施以自制天然草木灰釉，经 1320℃ 柴窑三天两夜烧制。每只窑变肌理独一无二，不设现货直购，支持按杯型、容量与釉色意向定制。',
    processNote: '揉泥拉坯 → 利坯修足 → 素烧 → 施草木灰釉 → 满窑柴烧。',
    comments: []
  },
  {
    id: 'W-1004',
    title: '极简锤纹 925 纯银莫比乌斯对戒（仅作品展示）',
    categoryL1: '饰品',
    categoryL2: '银饰戒指',
    variant: 'jewelry',
    material: '925 足银、手工细锤纹',
    spec: '戒面宽 3.2mm，内圈弧面舒适版',
    sellStock: false,
    stockStatus: null,
    stockPrice: null,
    acceptCustom: false,
    customDays: null,
    auditStatus: 'ONLINE',
    authorId: 'cr-4',
    authorName: '冶银小筑',
    authorRegion: '江苏 · 苏州',
    authorRating: null, // 体现无评价不显示 0 分
    authorReviewCount: 0,
    authorGoodRate: null,
    authorCompletedOrders: 0,
    likes: 76,
    favorites: 33,
    liked: false,
    favorited: false,
    createdAt: '2026-11-14',
    description: '此作品为过往毕业展参赛成品记录，采用手工锻打与微锤纹工艺呈现柔和哑光质感。仅作作品集展示，不出售现货，暂不接单。',
    processNote: '融银压条 → 扭转焊接 → 手工锤击纹理 → 抛光做旧。',
    comments: []
  },
  {
    id: 'W-1005',
    title: '植物染棉麻手工编织侘寂风墙面挂毯',
    categoryL1: '编织',
    categoryL2: '挂毯',
    variant: 'weaving',
    material: '天然粗棉线、板蓝根与核桃皮植物染、枯枝横杆',
    spec: '宽 55cm × 长 85cm',
    sellStock: true,
    stockStatus: 'AVAILABLE',
    stockPrice: 460,
    acceptCustom: false,
    customDays: null,
    auditStatus: 'ONLINE',
    authorId: 'cr-5',
    authorName: '织野手造',
    authorRegion: '云南 · 大理',
    authorRating: 4.7,
    authorReviewCount: 9,
    authorGoodRate: '88.9%',
    authorCompletedOrders: 11,
    likes: 62,
    favorites: 29,
    liked: false,
    favorited: false,
    createdAt: '2026-11-22',
    description: '使用大理本地采摘的天然植物染制棉线，手工结绳编织，仅此一件孤品现货，售完即止，不接受同类定制。',
    processNote: '植物煮染 → 阴干理线 → 手工平结与雀头结编织。',
    comments: []
  }
];

const INITIAL_DEMANDS = [
  {
    id: 'REQ-20261120-01',
    title: '定制一枚焦糖色植鞣革通勤托特包（可放14寸笔记本）',
    categoryL1: '皮具',
    categoryL2: '托特包',
    scope: 'PUBLIC', // PUBLIC | DIRECTED
    invitedCreatorId: null,
    invitedCreatorName: null,
    buyerName: '林清浅',
    purpose: '日常通勤使用，需装下 14 寸电脑、充电器及随身物品',
    materialPref: '偏好意大利植鞣革或头层疯马皮，焦糖色/深棕色，黄铜五金',
    spec: '约 36cm × 27cm × 12cm，肩带长度可单肩背',
    budgetMin: 1200,
    budgetMax: 2200,
    expectedShipDate: '2026-12-12',
    description: '希望包身有一定挺括感但不至于太重，内部需要一个带拉链的内袋和两个插袋。五金希望耐氧化，肩带连接处加固缝线，验收时希望看到走线与边油实拍。',
    status: 'QUOTING', // DRAFT | OPEN | QUOTING | AWARDED | IN_TRADE | COMPLETED | CLOSED | EXPIRED
    createdAt: '2026-11-20 10:15',
    quotes: [
      {
        id: 'QT-01',
        creatorId: 'cr-1',
        creatorName: '陈木生皮具工坊',
        creatorRegion: '浙江 · 杭州',
        price: 1680,
        days: 14,
        estimatedShipDate: '2026-12-08',
        plan: '采用 2.0mm 意大利托斯卡纳植鞣革（焦糖棕），包底加内置定型皮芯防塌陷，内里配棉麻帆布衬里+YKK黄铜拉链袋。肩带双层贴合手缝加固，全程5节点图文打卡汇报。',
        materialNote: '含免费内侧皮标烫印姓名缩写，打样阶段可免费微调一次尺寸。',
        rating: 4.9,
        reviewCount: 38,
        completedOrders: 46,
        validUntil: '2026-11-28 18:00',
        status: 'ACTIVE', // ACTIVE | AWARDED | LOST | EXPIRED
      },
      {
        id: 'QT-02',
        creatorId: 'cr-6',
        creatorName: '慢革手造',
        creatorRegion: '广东 · 广州',
        price: 1450,
        days: 22,
        estimatedShipDate: '2026-12-16', // 晚于期望发货日 2026-12-12，触发偏差提示！
        plan: '使用国产优质头层植鞣革配日本麻线纯手缝，极简无内衬原皮质感，配独立可拆卸内胆包（含电脑夹层与拉链袋）。黄铜铆钉加固提手。',
        materialNote: '因近期排单较多，预计发货日略晚于您的期望日期。',
        rating: 4.7,
        reviewCount: 19,
        completedOrders: 23,
        validUntil: '2026-11-29 12:00',
        status: 'ACTIVE',
      },
      {
        id: 'QT-03',
        creatorId: 'cr-7',
        creatorName: '拾革工作室',
        creatorRegion: '四川 · 成都',
        price: 1950,
        days: 12,
        estimatedShipDate: '2026-12-06',
        plan: '采用法国 Buttero 植鞣革，轻量化削薄工艺（整包重约 780g），手工法斩细密缝线，附赠同皮质挂饰与专属养护膏。可加急安排备料。',
        materialNote: '新入驻资深皮匠，支持打样版型确认后开工制作。',
        rating: null, // 体现无评价显示“暂无评价”
        reviewCount: 0,
        completedOrders: 0,
        validUntil: '2026-11-29 20:00',
        status: 'ACTIVE',
      }
    ]
  },
  {
    id: 'REQ-20261122-02',
    title: '定向定制：黑胡桃木异形桌面茶盘（40×22cm）',
    categoryL1: '木作',
    categoryL2: '茶盘',
    scope: 'DIRECTED',
    invitedCreatorId: 'cr-2',
    invitedCreatorName: '山间木作研究所',
    buyerName: '林清浅',
    purpose: '书房办公桌一人饮干泡茶盘',
    materialPref: '北美黑胡桃木，保留自然树边弧度',
    spec: '40cm × 22cm × 2.8cm',
    budgetMin: 800,
    budgetMax: 1200,
    expectedShipDate: '2026-12-15',
    description: '参考您主页的整板茶盘作品，希望尺寸做小巧一些放在书桌上使用，边缘打磨圆润不刮手。',
    status: 'OPEN',
    createdAt: '2026-11-22 15:30',
    quotes: []
  }
];

const INITIAL_ORDERS = [
  {
    id: 'ORD-20261110-8801',
    type: 'CUSTOM', // CUSTOM | STOCK
    title: '焦糖色植鞣革手工长款拉链钱包（定制）',
    variant: 'leather',
    buyerName: '林清浅',
    creatorId: 'cr-1',
    creatorName: '陈木生皮具工坊',
    amount: 880, // 买家实付 = 商品成交金额 = 创作者应结算金额
    status: 'IN_PRODUCTION', // PENDING_PAY | PAID | IN_PRODUCTION | PENDING_SHIP | SHIPPED | COMPLETED | AFTER_SALE | REFUNDED | CANCELLED
    statusBeforeAfterSale: null,
    createdAt: '2026-11-10 11:20',
    paidAt: '2026-11-10 11:35',
    expectedShipDate: '2026-11-24',
    shippedAt: null,
    trackingNo: null,
    trackingHistory: [],
    completedAt: null,
    addressSnapshot: '林清浅，13800138001，浙江省 杭州市 西湖区 文三路 259 号昌地火炬大厦 2 号楼 802',
    settlementStatus: 'PENDING', // PENDING | SETTLED | CANCELLED
    payoutAccountSnapshot: 'chen***@163.com（陈*生）',
    showcaseAuth: { status: 'NONE', appliedAt: null, repliedAt: null }, // NONE | PENDING | APPROVED | REJECTED
    reviewed: false,
    nodes: [
      {
        key: 'MATERIAL', name: '备料', ratio: '15%', status: 'CHECKED',
        plannedDate: '2026-11-13', actualTime: '2026-11-12 16:40', deviation: '提前 1 天',
        note: '已完成意大利植鞣革开料与削薄，YKK 5号黄铜拉链已核对到位，皮面无疤痕。',
        supplements: []
      },
      {
        key: 'SAMPLE', name: '打样打版', ratio: '20%', status: 'CHECKED',
        plannedDate: '2026-11-16', actualTime: '2026-11-16 19:10', deviation: '按期完成',
        note: '1:1 纸样与卡位排版已确认，按沟通调整了大钞位宽度，确保百元钞平放顺畅。',
        supplements: [
          { time: '2026-11-16 20:05', text: '补充确认：内侧刻字位置已定在左下角盲压。' }
        ]
      },
      {
        key: 'MAKING', name: '制作', ratio: '45%', status: 'UNLOCKED',
        plannedDate: '2026-11-22', actualTime: null, deviation: '已超期 1 天',
        note: '',
        supplements: []
      },
      {
        key: 'QC', name: '质检', ratio: '10%', status: 'NOT_STARTED',
        plannedDate: '2026-11-23', actualTime: null, deviation: null,
        note: '',
        supplements: []
      },
      {
        key: 'SHIPPING', name: '包装发货', ratio: '10%', status: 'NOT_STARTED',
        plannedDate: '2026-11-24', actualTime: null, deviation: null,
        note: '',
        supplements: []
      }
    ]
  },
  {
    id: 'ORD-20261102-6620',
    type: 'CUSTOM',
    title: '柴烧草木灰釉手工公道杯（定制）',
    variant: 'ceramic',
    buyerName: '林清浅',
    creatorId: 'cr-3',
    creatorName: '青屿窑口',
    amount: 520,
    status: 'COMPLETED',
    statusBeforeAfterSale: null,
    createdAt: '2026-11-02 09:10',
    paidAt: '2026-11-02 09:18',
    expectedShipDate: '2026-11-16',
    shippedAt: '2026-11-15 17:30',
    trackingNo: 'SF148920384712',
    trackingHistory: [],
    completedAt: '2026-11-19 14:22',
    addressSnapshot: '林清浅，13800138001，浙江省 杭州市 西湖区 文三路 259 号昌地火炬大厦 2 号楼 802',
    settlementStatus: 'PENDING', // 未满7天（11-19 ~ 11-26）
    payoutAccountSnapshot: 'qing***@qq.com（周*青）',
    showcaseAuth: { status: 'PENDING', appliedAt: '2026-11-20 10:05', repliedAt: null },
    reviewed: false,
    nodes: [
      { key: 'MATERIAL', name: '备料', ratio: '15%', status: 'CHECKED', plannedDate: '2026-11-04', actualTime: '2026-11-04 11:00', deviation: '按期完成', note: '陈腐高岭土揉泥完成。', supplements: [] },
      { key: 'SAMPLE', name: '打样打版', ratio: '20%', status: 'SKIPPED', plannedDate: '2026-11-07', actualTime: '2026-11-05 14:00', deviation: '已跳过', skipReason: '成熟经典器型，买家确认无需另做素坯打样，直接拉坯。', note: '', supplements: [] },
      { key: 'MAKING', name: '制作', ratio: '45%', status: 'CHECKED', plannedDate: '2026-11-13', actualTime: '2026-11-13 18:20', deviation: '按期完成', note: '拉坯修足、施草木灰釉并完成 1320℃ 柴窑烧制出窑。', supplements: [] },
      { key: 'QC', name: '质检', ratio: '10%', status: 'CHECKED', plannedDate: '2026-11-15', actualTime: '2026-11-15 10:15', deviation: '按期完成', note: '断水利落测试通过，器壁无开裂，釉色温润。', supplements: [] },
      { key: 'SHIPPING', name: '包装发货', ratio: '10%', status: 'CHECKED', plannedDate: '2026-11-16', actualTime: '2026-11-15 17:30', deviation: '提前 1 天', note: '防震礼盒加气泡柱双层加固，已交顺丰发出。', supplements: [] }
    ]
  },
  {
    id: 'ORD-20261121-9034',
    type: 'STOCK',
    title: '北美黑胡桃木整板干泡茶盘（现货直购）',
    variant: 'wood',
    buyerName: '林清浅',
    creatorId: 'cr-2',
    creatorName: '山间木作研究所',
    amount: 1280,
    status: 'PENDING_SHIP',
    statusBeforeAfterSale: null,
    createdAt: '2026-11-21 16:00',
    paidAt: '2026-11-21 16:05',
    expectedShipDate: '2026-11-23',
    shippedAt: null,
    trackingNo: null,
    trackingHistory: [],
    completedAt: null,
    addressSnapshot: '林清浅，13800138001，浙江省 杭州市 西湖区 文三路 259 号昌地火炬大厦 2 号楼 802',
    settlementStatus: 'PENDING',
    payoutAccountSnapshot: 'shan***@163.com（林*木）',
    showcaseAuth: null,
    reviewed: false,
    nodes: [] // 现货无进度节点
  }
];

const INITIAL_CONVERSATIONS = [
  {
    id: 'CONV-1',
    peerName: '陈木生皮具工坊',
    peerRole: '创作者',
    refType: 'ORDER',
    refId: 'ORD-20261110-8801',
    refTitle: '焦糖色植鞣革手工长款拉链钱包（定制）',
    refStatus: '制作中 2/5',
    archived: false,
    unread: 1,
    lastTime: '10:18',
    messages: [
      { id: 'm1', sender: 'PEER', time: '2026-11-16 19:15', text: '您好，打样打版节点已经打卡上传了，麻烦看下卡位排版是否符合预期。', nodeRef: '节点 2 · 打样打版' },
      { id: 'm2', sender: 'ME', time: '2026-11-16 19:32', text: '看过了非常满意！左下角帮我盲压字母 LQ 就可以。' },
      { id: 'm3', sender: 'PEER', time: '今天 10:18', text: '好的没问题！目前正在手工缝制主身，封边多打磨了两遍所以比计划晚一天，今晚前完成制作节点打卡。' }
    ]
  },
  {
    id: 'CONV-2',
    peerName: '慢革手造',
    peerRole: '创作者',
    refType: 'DEMAND',
    refId: 'REQ-20261120-01',
    refTitle: '定制一枚焦糖色植鞣革通勤托特包',
    refStatus: '报价中',
    archived: false,
    unread: 0,
    lastTime: '昨天 16:40',
    messages: [
      { id: 'm4', sender: 'PEER', time: '昨天 16:40', text: '您好，我已针对您的托特包需求提交了报价方案，内胆包可以根据您的笔记本尺寸精准定制。' }
    ]
  },
  {
    id: 'CONV-3',
    peerName: '青屿窑口',
    peerRole: '创作者',
    refType: 'ORDER',
    refId: 'ORD-20261102-6620',
    refTitle: '柴烧草木灰釉手工公道杯（定制）',
    refStatus: '已完成',
    archived: false, // 4.8.2：已成单会话即使订单完成也不归档，仍可沟通补证
    unread: 0,
    lastTime: '11-20',
    messages: [
      { id: 'm5', sender: 'PEER', time: '2026-11-20 10:06', text: '感谢确认收货！这只公道杯的窑变效果特别好，我已在订单页发起公开成品案例申请，如果您方便的话可以点一下同意或不同意～' }
    ]
  },
  {
    id: 'CONV-4',
    peerName: '古韵木艺',
    peerRole: '创作者',
    refType: 'DEMAND',
    refId: 'REQ-20261015-09',
    refTitle: '定制红酸枝镇纸一对',
    refStatus: '未中标 · 已归档',
    archived: true, // 4.8.2：未中标会话归档只读
    unread: 0,
    lastTime: '10-18',
    messages: [
      { id: 'm6', sender: 'PEER', time: '2026-10-16 14:00', text: '您好，这边已提交报价，期待有机会合作。' }
    ]
  }
];

const INITIAL_NOTIFICATIONS = [
  { id: 'n1', type: '授权提醒', title: '成品公开授权申请待回复', content: '创作者「青屿窑口」申请公开定制订单 ORD-20261102-6620 的成品案例，未回复不代表同意。', time: '2026-11-20 10:05', read: false },
  { id: 'n2', type: '报价动态', title: '收到 3 份有效定制报价', content: '您的需求「定制一枚焦糖色植鞣革通勤托特包」已收到 3/5 份有效报价，可前往对比页查看。', time: '2026-11-21 15:20', read: false },
  { id: 'n3', type: '进度打卡', title: '制作节点已更新', content: '订单 ORD-20261110-8801 已完成「打样打版」节点打卡，点击查看实拍与说明。', time: '2026-11-16 19:10', read: true },
];

const INITIAL_ADMIN_AUDITS = [
  {
    id: 'AUD-CR-01',
    kind: 'CREATOR',
    applicant: '陆沉舟',
    email: 'luchenzhou@163.com',
    region: '浙江 · 宁波',
    categories: ['木作', '陶艺'],
    years: 6,
    payoutAccount: '139****6621（陆沉舟）',
    worksCount: 4,
    intro: '专注传统榫卯小件木作与柴烧陶艺结合，拥有独立工作室 6 年，所有作品均为纯手工原创制作。',
    submittedAt: '2026-11-22 14:10',
    status: 'PENDING'
  },
  {
    id: 'AUD-WK-02',
    kind: 'WORK',
    title: '手工黄铜锤纹茶匙（定制成品案例）',
    author: '山间木作研究所',
    category: '木作 → 桌面摆件',
    sellStock: false,
    acceptCustom: true,
    customDays: 10,
    sourceOrderId: 'ORD-20261028-4410',
    submittedAt: '2026-11-23 09:20',
    status: 'PENDING'
  }
];

const INITIAL_REFUNDS = [
  {
    id: 'RF-20261122-01',
    orderId: 'ORD-20261112-7745',
    orderTitle: '手工雕刻樱桃木手办底座（定制）',
    buyerName: '周明远',
    creatorName: '木语刻造',
    amount: 420,
    prevStatus: 'SHIPPED',
    reason: '成品尺寸与报价方案约定偏差较大',
    description: '约定底座内径为 12cm，实际收到测量仅 10.5cm，手办无法放入。已在会话沟通并附上卷尺实拍对比图。',
    returnVerified: true,
    returnTrackingNo: 'YT98234109283',
    submittedAt: '2026-11-22 11:30',
    status: 'WAIT_ADMIN' // WAIT_ADMIN | REFUNDED | REJECTED
  }
];

// ============================================================================
// 3. 通用小组件（状态徽章、确认模态框、Toast）
// ============================================================================
const Badge = ({ children, tone = 'neutral', className = '' }) => {
  const tones = {
    neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200/70',
    dark: 'bg-zinc-900 text-white border-zinc-900',
    amber: 'bg-amber-50 text-amber-800 border-amber-200/80',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    rose: 'bg-rose-50 text-rose-700 border-rose-200/80',
    blue: 'bg-sky-50 text-sky-800 border-sky-200/80',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${tones[tone] || tones.neutral} ${className}`}>
      {children}
    </span>
  );
};

const ORDER_STATUS_MAP = {
  PENDING_PAY: { label: '待付款', tone: 'amber' },
  PAID: { label: '待开工', tone: 'blue' },
  IN_PRODUCTION: { label: '制作中', tone: 'blue' },
  PENDING_SHIP: { label: '待发货', tone: 'amber' },
  SHIPPED: { label: '已发货', tone: 'blue' },
  COMPLETED: { label: '已完成', tone: 'emerald' },
  AFTER_SALE: { label: '售后中', tone: 'rose' },
  REFUNDED: { label: '已退款', tone: 'neutral' },
  CANCELLED: { label: '已取消', tone: 'neutral' },
};

const DEMAND_STATUS_MAP = {
  DRAFT: { label: '草稿', tone: 'neutral' },
  OPEN: { label: '待响应', tone: 'blue' },
  QUOTING: { label: '报价中', tone: 'amber' },
  AWARDED: { label: '已定标', tone: 'emerald' },
  IN_TRADE: { label: '交易进行中', tone: 'blue' },
  COMPLETED: { label: '已完成', tone: 'emerald' },
  CLOSED: { label: '已关闭', tone: 'neutral' },
  EXPIRED: { label: '已过期', tone: 'neutral' },
};

// ============================================================================
// 4. 主应用组件
// ============================================================================
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
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6 text-zinc-900">
        <div className="w-full max-w-[980px] bg-white rounded-2xl border border-zinc-200/80 shadow-xl shadow-zinc-200/40 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* 左侧品牌视觉区 */}
          <div className="md:col-span-5 bg-zinc-900 text-white p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2.5 mb-10">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  <Hammer className="w-5 h-5" />
                </div>
                <span className="text-lg font-semibold tracking-tight">匠心集 CraftFlow</span>
              </div>
              <h1 className="text-2xl font-semibold leading-snug tracking-tight mb-4">
                让每一件手工定制，
                <br />
                从灵感到交付都清晰可见。
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                集原创手工作品分享、多方透明报价对比与五节点制作进度可视化于一体的 C2C 定制交易平台。
              </p>
            </div>
            <div className="relative z-10 space-y-3 pt-8 border-t border-zinc-800 text-xs text-zinc-400">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400" /> 现货单件管理 · 同类定制独立履约</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400" /> 最多 5 位匠人同屏横向报价对比</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-400" /> 备料至发货五节点图文透明打卡</div>
            </div>
          </div>

          {/* 右侧登录/注册表单 */}
          <div className="md:col-span-7 p-10 flex flex-col justify-center">
            <div className="max-w-sm mx-auto w-full">
              <div className="flex items-center gap-6 border-b border-zinc-100 mb-7">
                {[
                  { id: 'LOGIN', label: '邮箱登录' },
                  { id: 'REGISTER', label: '新用户注册' },
                  { id: 'RESET', label: '找回密码' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setAuthMode(t.id)}
                    className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                      authMode === t.id ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setIsLoggedIn(true);
                  showToast('登录成功，欢迎回到匠心集');
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">邮箱地址（仅支持 qq.com / 163.com）</label>
                  <input
                    type="email"
                    defaultValue="linqingqian@163.com"
                    required
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                    placeholder="example@163.com"
                  />
                </div>

                {authMode !== 'LOGIN' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">6 位邮箱验证码（5 分钟有效）</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        defaultValue="482910"
                        className="flex-1 px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-900"
                        placeholder="请输入 6 位数字"
                      />
                      <button
                        type="button"
                        onClick={() => showToast('验证码已发送至邮箱，5 分钟内有效', 'info')}
                        className="px-3.5 py-2.5 text-xs font-medium rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 whitespace-nowrap"
                      >
                        获取验证码
                      </button>
                    </div>
                  </div>
                )}

                {authMode === 'REGISTER' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">用户昵称（2—8 个字）</label>
                    <input
                      type="text"
                      defaultValue="林清浅"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                    {authMode === 'RESET' ? '设置新密码' : '密码'}（8—20 位，含字母与数字）
                  </label>
                  <input
                    type="password"
                    defaultValue="Craft2026"
                    required
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 mt-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {authMode === 'LOGIN' ? '立即登录（7 天登录态）' : authMode === 'REGISTER' ? '完成注册' : '重置密码并重新登录'}
                </button>
              </form>

              <p className="mt-6 text-xs text-zinc-400 text-center">
                依据系统安全规范，全部业务页面均需登录后访问。登录即默认拥有买家身份，可申请认证为创作者。
              </p>
            </div>
          </div>
        </div>
      </div>
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
        {/* ================= 视图 1：作品广场（买家） ================= */}
        {activeRole === 'BU' && activeTab === 'plaza' && !selectedWork && (
          <div className="space-y-6">
            {/* 极简顶部横幅与搜索区 */}
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-zinc-900">发现原创手工作品与匠人</h1>
                <p className="text-sm text-zinc-500 mt-1">
                  浏览认证创作者的成品案例，可直购单件现货，或以作品为参考发起专属同类定制。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索作品标题、材质、工艺..."
                    className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-700 focus:outline-none focus:border-zinc-900"
                >
                  <option value="NEWEST">最新发布</option>
                  <option value="PRICE_ASC">现货价格：低到高</option>
                  <option value="PRICE_DESC">现货价格：高到低</option>
                </select>
              </div>
            </div>

            {/* 品类与交易形态筛选栏 */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {['全部', ...categories.filter((c) => c.enabled).map((c) => c.name)].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCatL1(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      filterCatL1 === cat
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-zinc-200/80 text-xs">
                {[
                  { id: 'ALL', label: '全部作品' },
                  { id: 'STOCK', label: '仅可直购现货' },
                  { id: 'CUSTOM', label: '接受同类定制' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterTrade(f.id)}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${
                      filterTrade === f.id ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 作品网格（清晰展示四种现货/定制组合状态） */}
            {filteredWorks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-200/80 p-16 text-center">
                <p className="text-sm text-zinc-500">当前筛选条件下暂无已上架作品，请尝试调整关键词或筛选条件。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredWorks.map((work) => (
                  <div
                    key={work.id}
                    onClick={() => setSelectedWorkId(work.id)}
                    className="group bg-white rounded-2xl border border-zinc-200/80 overflow-hidden hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-200/50 transition-all cursor-pointer flex flex-col"
                  >
                    <div className="relative">
                      <CraftArtworkCover variant={work.variant} title={work.title} className="h-44" />
                      {/* 右上角状态徽章 */}
                      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                        {work.sellStock && work.stockStatus === 'AVAILABLE' && (
                          <Badge tone="dark">现货可直购</Badge>
                        )}
                        {work.sellStock && work.stockStatus === 'RESERVED' && (
                          <Badge tone="amber">现货已锁定</Badge>
                        )}
                        {work.sellStock && work.stockStatus === 'SOLD_OUT' && (
                          <Badge tone="neutral">现货已售出</Badge>
                        )}
                        {work.acceptCustom && <Badge tone="amber">可定制 · 约{work.customDays}天</Badge>}
                        {!work.sellStock && !work.acceptCustom && <Badge tone="neutral">仅作品展示</Badge>}
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] text-zinc-400 mb-1">
                          {work.categoryL1} · {work.categoryL2}
                        </div>
                        <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-amber-700 transition-colors line-clamp-2 leading-snug">
                          {work.title}
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1.5 line-clamp-1">{work.material}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                        <div>
                          {work.sellStock && work.stockStatus === 'AVAILABLE' ? (
                            <div className="text-base font-semibold text-zinc-900">
                              <span className="text-xs font-normal mr-0.5">¥</span>
                              {work.stockPrice}
                            </div>
                          ) : work.acceptCustom ? (
                            <span className="text-xs font-medium text-amber-700">定制按报价结算</span>
                          ) : (
                            <span className="text-xs text-zinc-400">非售展示品</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-zinc-400">
                          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {work.likes}</span>
                          <span className="truncate max-w-[90px] text-zinc-500">{work.authorName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= 视图 1.5：作品详情页 ================= */}
        {activeRole === 'BU' && selectedWork && (
          <div className="space-y-6">
            <button
              onClick={() => setSelectedWorkId(null)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              ← 返回作品广场
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 左侧大图与工艺详情 */}
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden">
                  <CraftArtworkCover variant={selectedWork.variant} className="h-80" />
                  <div className="p-6 space-y-5">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 mb-2">作品与工艺介绍</h2>
                      <p className="text-sm text-zinc-600 leading-relaxed">{selectedWork.description}</p>
                    </div>
                    {selectedWork.processNote && (
                      <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                        <div className="text-xs font-semibold text-zinc-700 mb-1">手工制作过程说明</div>
                        <p className="text-xs text-zinc-500 leading-relaxed">{selectedWork.processNote}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 公开评论区（4.2.4） */}
                <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-900">作品公开评论 ({selectedWork.comments.length})</h3>
                    <span className="text-xs text-zinc-400">10—500 字，支持附 0—3 张图片</span>
                  </div>
                  <WorkCommentBox
                    onSubmit={(text) => {
                      setWorks((prev) =>
                        prev.map((w) =>
                          w.id === selectedWork.id
                            ? {
                                ...w,
                                comments: [
                                  { id: `cm-${Date.now()}`, author: '林清浅', time: '刚刚', text, isMine: true },
                                  ...w.comments
                                ]
                              }
                            : w
                        )
                      );
                      showToast('评论发布成功');
                    }}
                  />
                  <div className="divide-y divide-zinc-100">
                    {selectedWork.comments.length === 0 ? (
                      <p className="py-6 text-center text-xs text-zinc-400">暂无评论，来留下第一条交流吧。</p>
                    ) : (
                      selectedWork.comments.map((cm) => (
                        <div key={cm.id} className="py-3.5 flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-zinc-800">{cm.author}</span>
                              <span className="text-[11px] text-zinc-400">{cm.time}</span>
                            </div>
                            <p className="text-sm text-zinc-600 mt-1">{cm.text}</p>
                          </div>
                          {cm.isMine ? (
                            <button
                              onClick={() => {
                                setWorks((prev) =>
                                  prev.map((w) =>
                                    w.id === selectedWork.id
                                      ? { ...w, comments: w.comments.filter((c) => c.id !== cm.id) }
                                      : w
                                  )
                                );
                                showToast('已删除自己的评论', 'info');
                              }}
                              className="text-xs text-zinc-400 hover:text-rose-600"
                            >
                              删除
                            </button>
                          ) : (
                            <button
                              onClick={() => showToast('已提交举报，管理员将核实处理', 'info')}
                              className="text-xs text-zinc-400 hover:text-zinc-700"
                            >
                              举报
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 右侧交易信息与创作者名片 */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 space-y-5 sticky top-24">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge tone="neutral">{selectedWork.categoryL1} → {selectedWork.categoryL2}</Badge>
                      {!selectedWork.sellStock && !selectedWork.acceptCustom && <Badge tone="neutral">纯作品展示</Badge>}
                    </div>
                    <h1 className="text-xl font-semibold text-zinc-900 leading-snug">{selectedWork.title}</h1>
                  </div>

                  {/* 工艺参数 */}
                  <div className="grid grid-cols-1 gap-2.5 text-xs bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-400 shrink-0">主材辅料</span>
                      <span className="text-zinc-800 font-medium text-right">{selectedWork.material}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-400 shrink-0">尺寸规格</span>
                      <span className="text-zinc-800 font-medium text-right">{selectedWork.spec}</span>
                    </div>
                    {selectedWork.acceptCustom && (
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-400 shrink-0">定制参考周期</span>
                        <span className="text-amber-700 font-medium text-right">约 {selectedWork.customDays} 个自然日（以报价为准）</span>
                      </div>
                    )}
                  </div>

                  {/* 价格与动态交易入口（4.2.1 四种组合） */}
                  <div className="space-y-3 pt-1">
                    {selectedWork.sellStock && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-zinc-500">单件成品现货价</span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-semibold text-zinc-900">¥{selectedWork.stockPrice}</span>
                          {selectedWork.stockStatus === 'SOLD_OUT' && <Badge tone="neutral">已售出</Badge>}
                          {selectedWork.stockStatus === 'RESERVED' && <Badge tone="amber">已锁定待支付</Badge>}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2.5">
                      {selectedWork.sellStock && selectedWork.stockStatus === 'AVAILABLE' && (
                        <button
                          onClick={() => setModal({ type: 'BUY_STOCK', payload: selectedWork })}
                          className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          立即购买现货（付款后直接待发货）
                        </button>
                      )}

                      {selectedWork.acceptCustom && (
                        <button
                          onClick={() =>
                            setModal({
                              type: 'CREATE_DEMAND',
                              payload: {
                                scope: 'DIRECTED',
                                invitedCreatorId: selectedWork.authorId,
                                invitedCreatorName: selectedWork.authorName,
                                defaultCatL1: selectedWork.categoryL1,
                                defaultCatL2: selectedWork.categoryL2,
                                refTitle: selectedWork.title
                              }
                            })
                          }
                          className={`w-full py-3 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 ${
                            selectedWork.sellStock && selectedWork.stockStatus === 'AVAILABLE'
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                          }`}
                        >
                          <Sparkles className="w-4 h-4" />
                          发起同类定制（定向邀约该创作者）
                        </button>
                      )}

                      {!selectedWork.sellStock && !selectedWork.acceptCustom && (
                        <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70 text-xs text-zinc-500 text-center">
                          该作品仅作创作者手艺案例展示，暂未开放现货直购与同类定制。
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 点赞/收藏/举报 */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setWorks((prev) =>
                            prev.map((w) =>
                              w.id === selectedWork.id
                                ? { ...w, liked: !w.liked, likes: w.liked ? w.likes - 1 : w.likes + 1 }
                                : w
                            )
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                          selectedWork.liked ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${selectedWork.liked ? 'fill-current' : ''}`} />
                        点赞 {selectedWork.likes}
                      </button>
                      <button
                        onClick={() =>
                          setWorks((prev) =>
                            prev.map((w) =>
                              w.id === selectedWork.id
                                ? { ...w, favorited: !w.favorited, favorites: w.favorited ? w.favorites - 1 : w.favorites + 1 }
                                : w
                            )
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                          selectedWork.favorited ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${selectedWork.favorited ? 'fill-current' : ''}`} />
                        收藏 {selectedWork.favorites}
                      </button>
                    </div>
                    <button
                      onClick={() => showToast('已打开举报记录，管理员将人工核实', 'info')}
                      className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1"
                    >
                      <Flag className="w-3.5 h-3.5" /> 举报
                    </button>
                  </div>

                  {/* 创作者口碑名片（4.7.2：无评价显示暂无评价，不按0分） */}
                  <div className="pt-4 border-t border-zinc-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 text-amber-400 font-semibold text-sm flex items-center justify-center">
                          {selectedWork.authorName[0]}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                            {selectedWork.authorName}
                            <Badge tone="emerald">已认证</Badge>
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5">{selectedWork.authorRegion}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => showToast(`已关注「${selectedWork.authorName}」`)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                      >
                        + 关注
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4 bg-zinc-50 rounded-xl p-3 text-center">
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          {selectedWork.authorRating ? `${selectedWork.authorRating} ★` : '暂无评价'}
                        </div>
                        <div className="text-[11px] text-zinc-400">平均评分</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          {selectedWork.authorGoodRate || '—'}
                        </div>
                        <div className="text-[11px] text-zinc-400">好评率 ({selectedWork.authorReviewCount})</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">{selectedWork.authorCompletedOrders}</div>
                        <div className="text-[11px] text-zinc-400">完成订单数</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
      </main>

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
    </div>
  );
}

// ============================================================================
// 9. 子组件实现（报价对比表、消息中心、表单弹窗）
// ============================================================================

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

function WorkCommentBox({ onSubmit }) {
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim().length < 10) return;
        onSubmit(text.trim());
        setText('');
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="发表公开评论（10—500 字，交流工艺细节或保养建议）..."
        className="flex-1 px-3.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-zinc-900"
      />
      <button
        type="submit"
        disabled={text.trim().length < 10}
        className="px-4 py-2 bg-zinc-900 disabled:bg-zinc-300 text-white text-xs font-medium rounded-lg"
      >
        发布评论
      </button>
    </form>
  );
}

function AddressConfirmModal({ title, subtitle, note, addresses, confirmText, onClose, onConfirm }) {
  const [selectedId, setSelectedId] = useState(addresses.find((a) => a.isDefault)?.id || addresses[0]?.id);
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
          <p className="text-xs text-amber-700 font-medium mt-1">{subtitle}</p>
        </div>
        <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-zinc-700">选择收货地址（生成订单后将保存地址快照，不可直接改址）</div>
        {addresses.map((a) => (
          <label
            key={a.id}
            className={`block p-3.5 rounded-xl border cursor-pointer text-xs transition-all ${
              selectedId === a.id ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <input type="radio" checked={selectedId === a.id} onChange={() => setSelectedId(a.id)} />
              <span className="font-semibold text-zinc-900">{a.recipient}</span>
              <span className="text-zinc-500">{a.phone}</span>
              {a.isDefault && <Badge tone="dark">默认</Badge>}
            </div>
            <div className="text-zinc-500 mt-1 pl-5">{a.region} {a.detail}</div>
          </label>
        ))}
      </div>

      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/70 text-xs text-amber-900 leading-relaxed">
        {note}
      </div>

      <div className="flex justify-end gap-2.5">
        <button onClick={onClose} className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-700">取消</button>
        <button onClick={() => onConfirm(selectedId)} className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800">
          {confirmText}
        </button>
      </div>
    </div>
  );
}

function CreateDemandModal({ initialPayload, categories, onClose, onSubmit }) {
  const isDirected = initialPayload?.scope === 'DIRECTED';
  const [title, setTitle] = useState(isDirected && initialPayload.refTitle ? `同类定制：${initialPayload.refTitle}` : '');
  const [catL1, setCatL1] = useState(initialPayload?.defaultCatL1 || '皮具');
  const [budgetMin, setBudgetMin] = useState(800);
  const [budgetMax, setBudgetMax] = useState(1500);
  const [expectedShipDate, setExpectedShipDate] = useState('2026-12-18');
  const [spec, setSpec] = useState('按常规尺寸，细节可与创作者沟通确认');
  const [desc, setDesc] = useState('希望采用天然材质纯手工制作，注重走线与表面处理细节，需按五节点打卡汇报制作过程。');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      id: `REQ-20261123-${Math.floor(10 + Math.random() * 89)}`,
      title: title || '定制手工皮具随身包',
      categoryL1: catL1,
      categoryL2: categories.find((c) => c.name === catL1)?.children[0]?.name || '定制款',
      scope: isDirected ? 'DIRECTED' : 'PUBLIC',
      invitedCreatorId: initialPayload?.invitedCreatorId || null,
      invitedCreatorName: initialPayload?.invitedCreatorName || null,
      buyerName: '林清浅',
      purpose: '自用定制',
      materialPref: '天然优质主材',
      spec,
      budgetMin: Number(budgetMin),
      budgetMax: Number(budgetMax),
      expectedShipDate,
      description: desc,
      status: 'OPEN',
      createdAt: '2026-11-23 10:40',
      quotes: []
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900">
          {isDirected ? `发起定向定制（受邀：${initialPayload.invitedCreatorName}）` : '发布公开定制需求'}
        </h3>
        <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
      </div>
      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200/70 rounded-lg px-3 py-2">
        提示：需求发布后正文与范围将立即锁定；如需调整可在定标前关闭并复制新建。
      </div>
      <div className="space-y-3 text-xs">
        <div>
          <label className="block font-medium text-zinc-700 mb-1">需求标题（5—30 字）</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：定制一枚深棕色植鞣革手工卡包" className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-zinc-700 mb-1">所属品类</label>
            <select value={catL1} onChange={(e) => setCatL1(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-white">
              {categories.filter((c) => c.enabled).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-medium text-zinc-700 mb-1">期望发货日期</label>
            <input type="date" value={expectedShipDate} onChange={(e) => setExpectedShipDate(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-zinc-700 mb-1">预算下限（元）</label>
            <input type="number" min={50} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 mb-1">预算上限（元）</label>
            <input type="number" min={budgetMin} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
          </div>
        </div>
        <div>
          <label className="block font-medium text-zinc-700 mb-1">尺寸规格</label>
          <input value={spec} onChange={(e) => setSpec(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
        </div>
        <div>
          <label className="block font-medium text-zinc-700 mb-1">需求详细描述与验收要求（20—2000 字）</label>
          <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-zinc-200 text-zinc-700">取消</button>
        <button type="submit" className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800">确认发布</button>
      </div>
    </form>
  );
}

function SubmitQuoteModal({ demand, onClose, onSubmit }) {
  const [price, setPrice] = useState(demand.budgetMin + 200);
  const [days, setDays] = useState(14);
  const [plan, setPlan] = useState('采用精选头层原材纯手工制作，严格按照 5 节点拍照打卡反馈进度，确保在约定工期内高标准交付。');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          id: `QT-${Date.now()}`,
          creatorId: 'cr-1',
          creatorName: '陈木生皮具工坊',
          creatorRegion: '浙江 · 杭州',
          price: Number(price),
          days: Number(days),
          estimatedShipDate: '2026-12-08',
          plan,
          materialNote: '包含专属保养说明，打样阶段可免费微调。',
          rating: 4.9,
          reviewCount: 38,
          completedOrders: 46,
          validUntil: '2026-11-30 10:30',
          status: 'ACTIVE'
        });
      }}
      className="p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900">提交定制报价方案</h3>
        <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
      </div>
      <div className="text-xs text-zinc-500 bg-zinc-50 p-3 rounded-lg">
        需求：{demand.title}（买家预算 ¥{demand.budgetMin}—¥{demand.budgetMax}）
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block font-medium text-zinc-700 mb-1">报价金额（50—50000 元）</label>
          <input type="number" min={50} max={50000} value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
        </div>
        <div>
          <label className="block font-medium text-zinc-700 mb-1">制作工期（3—180 自然日）</label>
          <input type="number" min={3} max={180} value={days} onChange={(e) => setDays(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
        </div>
      </div>
      <div className="text-xs">
        <label className="block font-medium text-zinc-700 mb-1">工艺方案与材料说明（30—1000 字）</label>
        <textarea rows={4} value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-zinc-200 text-zinc-700">取消</button>
        <button type="submit" className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800">提交报价（7 天有效）</button>
      </div>
    </form>
  );
}

function NodeCheckinModal({ order, node, nodeIndex, onClose, onSubmit }) {
  const [action, setAction] = useState('CHECK');
  const [note, setNote] = useState(
    nodeIndex === 4
      ? '已完成礼盒防震加固包装，顺丰快递已揽收发出。'
      : '本阶段制作已按方案完成，细节实拍已上传，欢迎随时在会话沟通。'
  );
  const [trackingNo, setTrackingNo] = useState('SF148920389901');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ action, note, trackingNo });
      }}
      className="p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900">
          节点 {nodeIndex + 1} · {node.name} {nodeIndex === 4 ? '与发货确认' : '图文打卡'}
        </h3>
        <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
      </div>

      {node.key === 'SAMPLE' && (
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => setAction('CHECK')} className={`flex-1 py-2 rounded-lg border font-medium ${action === 'CHECK' ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-600'}`}>
            正常图文打卡
          </button>
          <button type="button" onClick={() => setAction('SKIP')} className={`flex-1 py-2 rounded-lg border font-medium ${action === 'SKIP' ? 'bg-amber-600 text-white border-amber-600' : 'border-zinc-200 text-zinc-600'}`}>
            跳过打样节点
          </button>
        </div>
      )}

      {nodeIndex === 4 && (
        <div className="text-xs">
          <label className="block font-medium text-zinc-700 mb-1">物流运单号（8—30 位字母数字，与本节点同步生效）</label>
          <input required value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg font-mono" />
        </div>
      )}

      <div className="text-xs">
        <label className="block font-medium text-zinc-700 mb-1">
          {action === 'SKIP' ? '跳过原因说明（10—500 字）' : '阶段进度说明（5—500 字，自动附带实拍图）'}
        </label>
        <textarea rows={3} required value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-zinc-200 text-zinc-700">取消</button>
        <button type="submit" className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800">
          {nodeIndex === 4 ? '提交打卡并确认发货' : action === 'SKIP' ? '确认跳过' : '提交打卡'}
        </button>
      </div>
    </form>
  );
}

function PublishWorkModal({ categories, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [catL1, setCatL1] = useState('皮具');
  const [material, setMaterial] = useState('意大利植鞣革、纯铜五金');
  const [spec, setSpec] = useState('12cm × 9cm');
  const [sellStock, setSellStock] = useState(true);
  const [stockPrice, setStockPrice] = useState(580);
  const [acceptCustom, setAcceptCustom] = useState(true);
  const [customDays, setCustomDays] = useState(14);
  const [desc, setDesc] = useState('纯手工裁切与双针缝制，细节经多道封边处理，日常使用质感极佳。');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          id: `W-${Date.now()}`,
          title: title || '手工植鞣革随身卡包',
          categoryL1: catL1,
          categoryL2: categories.find((c) => c.name === catL1)?.children[0]?.name || '定制件',
          variant: catL1 === '木作' ? 'wood' : catL1 === '陶艺' ? 'ceramic' : 'leather',
          material,
          spec,
          sellStock,
          stockStatus: sellStock ? 'AVAILABLE' : null,
          stockPrice: sellStock ? Number(stockPrice) : null,
          acceptCustom,
          customDays: acceptCustom ? Number(customDays) : null,
          auditStatus: 'PENDING',
          authorId: 'cr-1',
          authorName: '陈木生皮具工坊',
          authorRegion: '浙江 · 杭州',
          authorRating: 4.9,
          authorReviewCount: 38,
          authorGoodRate: '97.4%',
          authorCompletedOrders: 46,
          likes: 0,
          favorites: 0,
          liked: false,
          favorited: false,
          createdAt: '2026-11-23',
          description: desc,
          processNote: '',
          comments: []
        });
      }}
      className="p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900">发布原创手工作品（四段式）</h3>
        <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
      </div>
      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200/70 rounded-lg px-3 py-2">
        请发布本人原创作品，勿重复发布相同内容；违规或重复作品可能被审核驳回或下架。
      </div>
      <div className="space-y-3 text-xs">
        <div>
          <label className="block font-medium text-zinc-700 mb-1">1. 基本信息 · 作品标题（2—30 字）</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：手工擦色植鞣革风琴卡包" className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-zinc-700 mb-1">所属品类</label>
            <select value={catL1} onChange={(e) => setCatL1(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-white">
              {categories.filter((c) => c.enabled).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-medium text-zinc-700 mb-1">2. 工艺参数 · 材质</label>
            <input value={material} onChange={(e) => setMaterial(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
          </div>
        </div>

        {/* 独立交易开关（4.2.1） */}
        <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-3">
          <div className="font-semibold text-zinc-800">3. 交易信息（两项独立，均关闭可作纯展示）</div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={sellStock} onChange={(e) => setSellStock(e.target.checked)} />
              <span>出售单件现货</span>
            </label>
            {sellStock && (
              <input type="number" value={stockPrice} onChange={(e) => setStockPrice(e.target.value)} className="w-28 px-2.5 py-1 border border-zinc-200 rounded-md bg-white" placeholder="售价(元)" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={acceptCustom} onChange={(e) => setAcceptCustom(e.target.checked)} />
              <span>接受同类定制</span>
            </label>
            {acceptCustom && (
              <input type="number" value={customDays} onChange={(e) => setCustomDays(e.target.value)} className="w-28 px-2.5 py-1 border border-zinc-200 rounded-md bg-white" placeholder="参考天数" />
            )}
          </div>
        </div>

        <div>
          <label className="block font-medium text-zinc-700 mb-1">4. 图文详情 · 作品描述（20—2000 字）</label>
          <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-zinc-200 text-zinc-700">存草稿</button>
        <button type="submit" className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800">提交上架审核</button>
      </div>
    </form>
  );
}

function SimpleInputModal({ title, label, placeholder, textarea, confirmText, onClose, onSubmit }) {
  const [val, setVal] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!val.trim()) return;
        onSubmit(val.trim());
      }}
      className="p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
      </div>
      <div className="text-xs">
        <label className="block font-medium text-zinc-700 mb-1.5">{label}</label>
        {textarea ? (
          <textarea rows={4} required value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
        ) : (
          <input required value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-zinc-200 text-zinc-700">取消</button>
        <button type="submit" className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800">{confirmText}</button>
      </div>
    </form>
  );
}

function ReviewOrderModal({ order, onClose, onSubmit }) {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ stars, text });
      }}
      className="p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900">评价订单与合作创作者</h3>
        <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
      </div>
      <div className="text-xs text-zinc-500">{order.title} · {order.creatorName}</div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} type="button" onClick={() => setStars(s)} className="p-1">
            <Star className={`w-6 h-6 ${s <= stars ? 'text-amber-500 fill-amber-500' : 'text-zinc-300'}`} />
          </button>
        ))}
        <span className="text-xs font-medium text-zinc-700 ml-1">{stars} 星</span>
      </div>
      <div className="text-xs">
        <label className="block font-medium text-zinc-700 mb-1">评价内容（10—500 字，提交后不可自行修改）</label>
        <textarea rows={3} required value={text} onChange={(e) => setText(e.target.value)} placeholder="分享成品做工、沟通体验与定制还原度..." className="w-full px-3 py-2 border border-zinc-200 rounded-lg" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded-lg border border-zinc-200 text-zinc-700">取消</button>
        <button type="submit" className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800">提交评价</button>
      </div>
    </form>
  );
}