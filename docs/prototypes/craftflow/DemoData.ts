// 各角色共用的初始演示数据。
export const CATEGORIES = [
  { id: 'c1', name: '皮具', enabled: true, children: [{ id: 'c1-1', name: '钱包', enabled: true }, { id: 'c1-2', name: '卡包', enabled: true }, { id: 'c1-3', name: '托特包', enabled: true }] },
  { id: 'c2', name: '木作', enabled: true, children: [{ id: 'c2-1', name: '茶盘', enabled: true }, { id: 'c2-2', name: '桌面摆件', enabled: true }] },
  { id: 'c3', name: '陶艺', enabled: true, children: [{ id: 'c3-1', name: '手工茶具', enabled: true }, { id: 'c3-2', name: '花器', enabled: true }] },
  { id: 'c4', name: '饰品', enabled: true, children: [{ id: 'c4-1', name: '银饰戒指', enabled: true }, { id: 'c4-2', name: '吊坠', enabled: true }] },
  { id: 'c5', name: '编织', enabled: true, children: [{ id: 'c5-1', name: '挂毯', enabled: true }] },
];

export const INITIAL_ADDRESSES = [
  { id: 'addr-1', recipient: '林清浅', phone: '13800138001', region: '浙江省 杭州市 西湖区', detail: '文三路 259 号昌地火炬大厦 2 号楼 802', isDefault: true },
  { id: 'addr-2', recipient: '林清浅', phone: '13800138001', region: '上海市 静安区', detail: '南京西路 1266 号恒隆广场办公楼 1 座 15F', isDefault: false },
];

export const INITIAL_WORKS = [
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

export const INITIAL_DEMANDS = [
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

export const INITIAL_ORDERS = [
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

export const INITIAL_CONVERSATIONS = [
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

export const INITIAL_NOTIFICATIONS = [
  { id: 'n1', type: '授权提醒', title: '成品公开授权申请待回复', content: '创作者「青屿窑口」申请公开定制订单 ORD-20261102-6620 的成品案例，未回复不代表同意。', time: '2026-11-20 10:05', read: false },
  { id: 'n2', type: '报价动态', title: '收到 3 份有效定制报价', content: '您的需求「定制一枚焦糖色植鞣革通勤托特包」已收到 3/5 份有效报价，可前往对比页查看。', time: '2026-11-21 15:20', read: false },
  { id: 'n3', type: '进度打卡', title: '制作节点已更新', content: '订单 ORD-20261110-8801 已完成「打样打版」节点打卡，点击查看实拍与说明。', time: '2026-11-16 19:10', read: true },
];

export const INITIAL_ADMIN_AUDITS = [
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

export const INITIAL_REFUNDS = [
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
