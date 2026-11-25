import React, { useState } from 'react';
import { Bookmark, Flag, Heart, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { Badge, CraftArtworkCover } from './CommonUi';

// 买家作品广场、筛选及作品详情。
export function BuyerWorks({
  activeRole,
  activeTab,
  selectedWork,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  categories,
  setFilterCatL1,
  filterCatL1,
  setFilterTrade,
  filterTrade,
  filteredWorks,
  setSelectedWorkId,
  setWorks,
  showToast,
  setModal,
}) {
  return (
    <>
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
    </>
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
