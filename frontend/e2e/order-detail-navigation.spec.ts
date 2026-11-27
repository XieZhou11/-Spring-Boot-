import { expect, test, type Page } from '@playwright/test'
import { api, origin } from './environment'

const timestamp = '2026-11-26T18:00:00+08:00'
const title = '织物定制订单'
const nodeCodes = ['MATERIAL', 'SAMPLE', 'MAKING', 'QC', 'SHIPPING']
const order = {
  id: '50', orderNo: 'TEST50', title, orderType: 'CUSTOM', status: 'COMPLETED', owned: false,
  buyerId: '11', creatorId: '10', buyerNickname: '测试买家', creatorNickname: '测试创作者',
  requestId: '12', quoteId: '13', conversationId: '7', durationDays: 15, totalAmount: '178.00', paidAmount: '178.00',
  createdAt: timestamp, paidAt: timestamp, startedAt: timestamp, shippedAt: timestamp, originalCompletedAt: timestamp,
  serverTime: timestamp, shipDate: '2026-12-10', trackingNo: 'TESTEXPRESS01', trackingHistory: [], history: [],
  agreementSnapshot: {
    request: { title, description: '制作一件可用于展示的定制织物。', purpose: '展示', categoryPath: ['织物'], referenceImageIds: [] },
    proposal: '选用浅灰织物和深蓝缝线。', imageIds: [], expectedShipDate: '2026-12-10', confirmedEstimatedShipDate: '2026-12-10',
  },
  payment: { amount: '178.00', flowNo: 'PAY50', result: 'SUCCESS', termsText: '模拟支付条款', occurredAt: timestamp },
  settlement: { paidAmount: '178.00', status: 'PENDING', maskedPayee: '试**' },
  publicationConsentStatus: 'APPROVED', publicationRequestedAt: timestamp, publicationRespondedAt: timestamp,
  progressNodes: nodeCodes.map((nodeCode, index) => ({
    id: String(31 + index), nodeCode, sortOrder: index + 1, plannedFinishDate: '2026-12-09', status: 'CHECKED', handledAt: timestamp,
    records: [{ id: String(101 + index), content: '阶段说明已经核验。', imageIds: [], recordType: 'CHECKIN', createdAt: timestamp }],
  })),
}
const session = { userId: '10', nickname: '测试创作者', roles: ['BUYER', 'CREATOR'], activeRole: 'CREATOR' }
const conversation = {
  id: '7', requestId: '12', orderId: '50', orderTitle: title, orderStatus: 'COMPLETED', otherUserId: '11', otherNickname: '测试买家',
  lastMessageSeq: '0', readSeq: '0', canSend: true,
}
const blankPage = { items: [], total: 0, size: 20, page: 1 }
const otherOrder = { ...order, id: '51', orderNo: 'TEST51', title: '另一件织物订单' }
const contextQuery = '?side=CREATOR&status=COMPLETED&page=2'
const orderPath = '/orders/50' + contextQuery
const anchorPath = orderPath + '#progress-35'

function gate() {
  let release = () => {}
  const promise = new Promise<void>(resolve => { release = resolve })
  return { release, promise }
}

/** 固定订单与会话响应，精确控制重新挂载时的详情加载，浏览器不连接数据库。 */
async function mockOrder(page: Page, beforeRead: () => void | number | Promise<void> = () => {}, orderOptions?: {
  detail: unknown
  list: () => Promise<unknown>
}) {
  await page.routeWebSocket('**/api/ws', () => {})
  await page.route(`${api}/**`, async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.slice('/api'.length)
    let data: unknown = blankPage
    if (path === '/sessions/current') data = session
    if (path === '/csrf') data = { headerName: 'X-CSRF-TOKEN', token: 'sample' }
    if (path.endsWith('/unread-count')) data = { count: 0 }
    if (path === '/me/orders') data = orderOptions ? await orderOptions.list() : { ...blankPage, items: [order, otherOrder], total: 22, page: Number(url.searchParams.get('page')) }
    if (path === '/orders/50') {
      const status = await beforeRead()
      if (typeof status === 'number') {
        return route.fulfill({ status, json: { code: status, message: '订单读取暂不可用', data: null },
          headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } })
      }
      data = orderOptions?.detail ?? order
    }
    if (path === '/orders/51') data = otherOrder
    if (path === '/me/conversations') data = { ...blankPage, items: [conversation], total: 1 }
    if (path === '/conversations/7') data = conversation
    if (path === '/conversations/7/messages') data = { items: [], hasMore: false }
    await route.fulfill({
      json: { code: 0, message: '成功', data },
      headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' },
    })
  })
}

test('简短订单详情在左栏列表迟到时仍能恢复原来的窗口位置', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 750 })
  const delayed = gate()
  const requested = gate()
  let holdList = false
  const stock = { ...order, orderType: 'STOCK', requestId: null, quoteId: null, progressNodes: [] }
  const list = { ...blankPage, page: 2, total: 40, items: [stock,
    ...Array.from({ length: 19 }, (_, index) => ({ ...stock, id: String(100 + index), title: `历史现货订单 ${index + 1}` }))] }
  await mockOrder(page, () => {}, { detail: stock, list: async () => {
    if (holdList) { requested.release(); await delayed.promise }
    return list
  } })

  await page.goto(orderPath)
  await expect(page.getByRole('link', { name: '历史现货订单 19', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 900))
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBe(900)
  // 直接触发链接，保留原视口位置，避免 Playwright 为点击自动滚动。
  await page.getByRole('link', { name: '进入订单沟通' }).evaluate((link: HTMLAnchorElement) => link.click())
  const back = page.getByRole('button', { name: '返回订单', exact: true })
  await expect(back).toBeVisible()

  holdList = true
  try {
    await back.click()
    await requested.promise
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '历史现货订单 19', exact: true })).toHaveCount(0)
  } finally {
    delayed.release()
  }
  await expect(page.getByRole('link', { name: '历史现货订单 19', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before)
})

test('从桌面订单列表靠下的位置打开详情时能直接看到订单概览', async ({ page }) => {
  const list = { ...blankPage, total: 20, items: [
    ...Array.from({ length: 19 }, (_, index) => ({ ...order, id: String(100 + index), title: `历史定制订单 ${index + 1}` })),
    order,
  ] }
  await mockOrder(page, () => {}, { detail: order, list: async () => list })

  await page.goto('/orders?side=CREATOR')
  const link = page.getByRole('link', { name: title, exact: true })
  await link.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(400)
  await link.click()
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeInViewport()
})

test('订单主详情保留制作节点，完整方案与历史分别打开子页', async ({ page }) => {
  await mockOrder(page)
  await page.goto(orderPath)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.locator('.order-progress > li')).toHaveCount(5)
  await expect(page.getByRole('heading', { name: '锁定的合作方案' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '订单历史' })).toHaveCount(0)

  const agreement = page.getByRole('navigation', { name: '订单资料' }).getByRole('link', { name: '锁定的合作方案' })
  await expect(agreement).toBeVisible()
  await agreement.click()
  await expect(page).toHaveURL('/orders/50/details/agreement' + contextQuery)
  await expect(page.getByRole('heading', { name: '锁定的合作方案' })).toBeVisible()
  await expect(page.locator('.order-progress > li')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('选用浅灰织物和深蓝缝线。')).toBeVisible()
  await page.getByRole('button', { name: '返回订单', exact: true }).click()
  await expect(page).toHaveURL(orderPath)
  await expect(page.locator('.order-progress > li')).toHaveCount(5)
  await page.goForward({ waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL('/orders/50/details/agreement' + contextQuery)
  await expect(page.getByText('选用浅灰织物和深蓝缝线。')).toBeVisible()

  await page.goto(orderPath + '#publication-consent')
  await expect(page).toHaveURL('/orders/50/details/publication' + contextQuery)
  await expect(page.getByRole('heading', { name: '定制成品公开授权' })).toBeVisible()
})

test('详情读取失败可重试，正常详情不显示常驻刷新按钮', async ({ page }) => {
  let failures = 1
  await mockOrder(page, () => failures-- > 0 ? 503 : undefined)
  await page.goto(orderPath)
  const error = page.getByRole('alert').filter({ hasText: '订单读取暂不可用' })
  const refresh = page.getByRole('button', { name: '刷新订单', exact: true })
  await expect(error).toBeVisible()
  await expect(refresh).toBeEnabled()
  await refresh.click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(refresh).toHaveCount(0)
})

for (const method of ['页面返回', '浏览器后退']) {
  test(`订单进度聊天后${method}恢复筛选、锚点与滚动位置`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 750 })
    const requested = gate()
    const response = gate()
    let holdRead = false
    await mockOrder(page, () => {
      if (!holdRead) return
      requested.release()
      return response.promise
    })

    await page.goto(anchorPath)
    const node = page.locator('#progress-35')
    await expect(node).toBeInViewport()
    await page.evaluate(() => window.scrollBy(0, -180))
    const discuss = node.getByRole('link', { name: /讨论此进度/ })
    await discuss.scrollIntoViewIfNeeded()
    const before = await page.evaluate(() => window.scrollY)
    expect(before).toBeGreaterThan(0)
    await discuss.click()
    await expect(page).toHaveURL(/\/messages\/conversations\/7/)
    const returnToOrder = page.getByRole('button', { name: '返回订单' }).or(page.getByRole('link', { name: '返回订单' }))
    await expect(returnToOrder).toBeVisible()

    holdRead = true
    try {
      if (method === '页面返回') await returnToOrder.click()
      else await page.goBack({ waitUntil: 'domcontentloaded' })
      await requested.promise
      await expect(page).toHaveURL(anchorPath)
    } finally {
      response.release()
    }
    await expect(node).toBeVisible()
    await expect.poll(() => page.evaluate(y => Math.abs(window.scrollY - y), before)).toBeLessThanOrEqual(3)
    await expect(page.getByRole('link', { name: '我承接的' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByLabel('订单状态')).toHaveValue('COMPLETED')
    await expect(page.getByText('第 2 页', { exact: false })).toBeVisible()
    if (method === '浏览器后退') {
      await page.goForward({ waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/messages\/conversations\/7\?progressNodeId=35/)
      await expect(returnToOrder).toBeVisible()
      await page.goBack({ waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(anchorPath)
      await expect.poll(() => page.evaluate(y => Math.abs(window.scrollY - y), before)).toBeLessThanOrEqual(3)
    }
  })
}

test('从另一笔订单后退时，迟到的详情响应不会覆盖刚恢复的订单', async ({ page }) => {
  const oldRead = gate()
  const delayed = gate()
  await mockOrder(page, () => { oldRead.release(); return delayed.promise })
  await page.goto('/orders/51' + contextQuery)
  const otherHeading = page.getByRole('heading', { name: otherOrder.title, exact: true })
  await expect(otherHeading).toBeVisible()

  try {
    await page.getByRole('link', { name: title, exact: true }).click()
    await oldRead.promise
    await expect(page).toHaveURL(orderPath)
    await page.goBack({ waitUntil: 'domcontentloaded' })
    await expect(otherHeading).toBeVisible()
    const delayedResponse = page.waitForResponse(`${api}/orders/50`)
    delayed.release()
    await (await delayedResponse).finished()
  } finally {
    delayed.release()
  }

  await expect(page).toHaveURL('/orders/51' + contextQuery)
  await expect(otherHeading).toBeVisible()
  await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0)
})
