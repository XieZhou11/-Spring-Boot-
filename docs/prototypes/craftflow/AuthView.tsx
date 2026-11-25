import React from 'react';
import { CheckCircle2, Hammer } from 'lucide-react';

// 未登录时的登录、注册和找回密码界面。
export function AuthView({ setAuthMode, authMode, setIsLoggedIn, showToast }) {
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
