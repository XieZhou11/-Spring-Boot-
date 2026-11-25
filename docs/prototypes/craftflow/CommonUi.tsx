import React from 'react';

// 共用的作品封面、徽章与状态文案。
export const CraftArtworkCover = ({ variant = 'leather', title, className = 'h-48' }) => {
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
export const Badge = ({ children, tone = 'neutral', className = '' }) => {
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

export const ORDER_STATUS_MAP = {
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

export const DEMAND_STATUS_MAP = {
  DRAFT: { label: '草稿', tone: 'neutral' },
  OPEN: { label: '待响应', tone: 'blue' },
  QUOTING: { label: '报价中', tone: 'amber' },
  AWARDED: { label: '已定标', tone: 'emerald' },
  IN_TRADE: { label: '交易进行中', tone: 'blue' },
  COMPLETED: { label: '已完成', tone: 'emerald' },
  CLOSED: { label: '已关闭', tone: 'neutral' },
  EXPIRED: { label: '已过期', tone: 'neutral' },
};
