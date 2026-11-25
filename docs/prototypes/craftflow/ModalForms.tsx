import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { Badge } from './CommonUi';

// 业务弹窗内的演示表单及各自的输入状态。
export function AddressConfirmModal({ title, subtitle, note, addresses, confirmText, onClose, onConfirm }) {
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

export function CreateDemandModal({ initialPayload, categories, onClose, onSubmit }) {
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

export function SubmitQuoteModal({ demand, onClose, onSubmit }) {
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

export function NodeCheckinModal({ order, node, nodeIndex, onClose, onSubmit }) {
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

export function PublishWorkModal({ categories, onClose, onSubmit }) {
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

export function SimpleInputModal({ title, label, placeholder, textarea, confirmText, onClose, onSubmit }) {
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

export function ReviewOrderModal({ order, onClose, onSubmit }) {
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
