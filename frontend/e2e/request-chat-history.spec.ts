import { expect, test, type Page } from '@playwright/test'
import { api } from './environment'

const request = {
  id: '41', title: '定制原木书签', buyerNickname: '测试买家', owned: true, categoryPath: [],
  visibility: 'PUBLIC', status: 'OPEN', version: '1', canClose: true, referenceImageIds: [],
  description: '希望制作一枚保留天然纹理的原木书签。',
}
const requests = Array.from({ length: 20 }, (_, index) => ({ ...request, id: String(22 + index), title: index === 19 ? request.title : `列表需求 ${index + 1}` }))
const conversation = { id: '71', requestId: '41', requestTitle: request.title, orderId: null, otherNickname: '测试交易对方', unreadCount: 0, canSend: true, lastMessageSeq: '0', readSeq: '0' }

/** 在浏览器保留真实路由和页面，延迟列表与详情的响应以复现加载后滚动恢复。 */
async function mockRequestsAndChat(page: Page, role: 'BUYER' | 'CREATOR' = 'BUYER') {
  const detail = role === 'BUYER' ? request : { ...request, owned: false, canConsult: true }
  await page.routeWebSocket('**/api/ws', socket => socket.onMessage(message => {
    if (message === 'PING') socket.send(JSON.stringify({ type: 'PONG' }))
  }))
  await page.route(`${api}/**`, async route => {
    const { pathname, searchParams } = new URL(route.request().url())
    let data: unknown = []
    if (pathname === '/api/sessions/current') data = { userId: '11', nickname: '导航验收账号', roles: [role], activeRole: role }
    if (pathname === '/api/csrf') data = { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' }
    if (pathname.endsWith('/unread-count')) data = { count: 0 }
    if (pathname.endsWith('/quote-quota')) data = { usedToday: 0, dailyLimit: 5 }
    if (pathname.endsWith('/quotes')) data = { items: [], total: 0, size: 20 }
    if (pathname.endsWith('/quote-comparison')) data = { requestTitle: request.title, items: [], activeCount: 0 }
    if (['/api/me/custom-requests', '/api/custom-requests'].includes(pathname)) {
      await new Promise(resolve => setTimeout(resolve, 180))
      data = { items: requests, total: 40, page: Number(searchParams.get('page') || 1), size: 20 }
    }
    if (pathname === '/api/custom-requests/41') {
      await new Promise(resolve => setTimeout(resolve, 180))
      data = detail
    }
    if (pathname === '/api/me/conversations') {
      const rows = Array.from({ length: 20 }, (_, index) => ({ ...conversation, id: String(52 + index), otherNickname: `交易对方 ${index + 1}` }))
      data = { items: rows, total: 40, page: Number(searchParams.get('page') || 1), size: 20 }
    }
    if (pathname === '/api/custom-requests/41/conversations' || pathname === '/api/conversations/71') data = conversation
    if (pathname === '/api/conversations/71/messages') data = { items: [], hasMore: false }
    await route.fulfill({ json: { code: 0, data } })
  })
}

test('需求详情返回筛选后的原历史条目并恢复列表位置和焦点', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 850 })
  await mockRequestsAndChat(page)
  const listUrl = '/my-requests?status=OPEN&page=2'
  await page.goto(listUrl)
  const trigger = page.getByRole('link', { name: request.title, exact: true })
  await trigger.scrollIntoViewIfNeeded()
  const initialScroll = await page.evaluate(() => window.scrollY)
  expect(initialScroll).toBeGreaterThan(100)
  await trigger.click()
  await expect(page.getByRole('heading', { name: request.title })).toBeVisible()
  const detailUrl = page.url()
  await page.getByRole('navigation', { name: '需求导航' }).getByRole('link', { name: '我的需求' }).click()
  await expect(page).toHaveURL(listUrl)
  await expect(page.getByLabel('需求状态', { exact: true })).toHaveValue('OPEN')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScroll)
  await expect(trigger).toBeFocused()
  await page.goForward()
  await expect(page).toHaveURL(detailUrl)
})

test('报价面包屑返回原需求详情，直接打开时回到报价区', async ({ page }) => {
  await mockRequestsAndChat(page)
  const detailUrl = '/requests/41?returnTo=/my-requests?status=OPEN'
  await page.goto(detailUrl)
  const compare = page.getByRole('link', { name: '查看报价对比', exact: true })
  await compare.click()
  await expect(page.getByRole('heading', { name: '报价对比', exact: true })).toBeVisible()
  const comparisonUrl = page.url()
  const back = page.getByRole('navigation', { name: '面包屑', exact: true }).getByRole('link', { name: '需求详情', exact: true })
  await back.click()
  await expect(page).toHaveURL(detailUrl)
  await expect(compare).toBeFocused()
  await page.goForward()
  await expect(page).toHaveURL(comparisonUrl)

  const bookmark = await page.context().newPage()
  try {
    await mockRequestsAndChat(bookmark)
    await bookmark.goto(comparisonUrl)
    await bookmark.getByRole('navigation', { name: '面包屑', exact: true }).getByRole('link', { name: '需求详情', exact: true }).click()
    await expect(bookmark).toHaveURL(url => url.pathname === '/requests/41' && url.hash === '#quotes')
    await expect(bookmark.getByRole('link', { name: '查看报价对比', exact: true })).toBeInViewport()
  } finally { await bookmark.close() }
})

for (const width of [1366, 600]) {
  test(`需求沟通在 ${width}px 可返回原详情并保留未发送草稿`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 })
    await mockRequestsAndChat(page, 'CREATOR')
    const sourceUrl = '/requests/41?returnTo=/requests?minBudget=150'
    await page.goto(sourceUrl)
    const trigger = page.getByRole('button', { name: '进入需求沟通', exact: true })
    await trigger.click()
    const draft = page.getByLabel('沟通内容', { exact: true })
    await draft.fill('返回验证草稿')
    const back = page.getByRole('link', { name: '返回需求详情', exact: true })
    await back.click()
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click()
    await expect(draft).toHaveValue('返回验证草稿')
    await back.click()
    await page.getByRole('dialog').getByRole('button', { name: '确认离开', exact: true }).click()
    await expect(page).toHaveURL(sourceUrl)
    await expect(trigger).toBeFocused()
    await page.goForward()
    await expect(draft).toHaveValue('返回验证草稿')
  })
}

test('会话列表返回第二页并恢复列表滚动，直接打开会话可以回到列表', async ({ page }) => {
  await mockRequestsAndChat(page)
  await page.goto('/messages/conversations?page=2')
  const list = page.locator('.conversation-rows')
  const trigger = list.getByRole('link', { name: /交易对方 20/ })
  await trigger.scrollIntoViewIfNeeded()
  const initialScroll = await list.evaluate(element => element.scrollTop)
  expect(initialScroll).toBeGreaterThan(0)
  await trigger.click()
  const detailUrl = '/messages/conversations/71?page=2'
  await expect(page).toHaveURL(detailUrl)
  await list.evaluate(element => { element.scrollTop = 0 })
  const back = page.getByRole('link', { name: '返回会话列表', exact: true })
  await back.click()
  await expect(page).toHaveURL('/messages/conversations?page=2')
  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBe(initialScroll)
  await expect(trigger).toBeFocused()
  await page.goForward()
  await expect(page).toHaveURL(detailUrl)

  const bookmark = await page.context().newPage()
  try {
    await mockRequestsAndChat(bookmark)
    await bookmark.goto(detailUrl)
    await bookmark.getByRole('link', { name: '返回会话列表', exact: true }).click()
    await expect(bookmark).toHaveURL('/messages/conversations?page=2')
  } finally { await bookmark.close() }
})
