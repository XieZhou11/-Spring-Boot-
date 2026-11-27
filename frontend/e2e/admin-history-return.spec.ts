import { expect, test, type Page } from '@playwright/test'
import { api } from './environment'

const createdAt = '2026-11-22T10:00:00+08:00'
const queueFixtures = [
  {
    name: '作品审核', route: '/admin/works', endpoint: '/admin/works', query: 'status=ONLINE&keyword=木作&page=2',
    queue: '作品审核队列', list: '.managed-work-list', filter: '搜索作品标题或描述',
    draft: '暂未提交的作品搜索词',
    row: (id: string) => ({
      id, title: `木作作品 ${id}`, creatorId: '42', creatorNickname: '测试创作者', categoryId: '31',
      categoryPath: ['木作'], reviewStatus: 'ONLINE', mainImageIds: [], specificationImageIds: [],
      version: '1', stockStatus: 'AVAILABLE', updatedAt: createdAt,
    }),
  },
  {
    name: '入驻审核', route: '/admin/creator-applications', endpoint: '/admin/creator-applications', query: 'status=APPROVED&page=2',
    queue: '入驻审核队列', list: '.review-table-wrap', filter: '审核状态',
    row: (id: string) => ({
      id, userId: '42', nickname: `申请人 ${id}`, status: 'APPROVED', submittedAt: createdAt,
      categories: [], originalWorks: [],
    }),
  },
  {
    name: '售后退款', route: '/admin/refunds', endpoint: '/admin/refund-applications', query: 'status=REFUNDED&applicationType=NORMAL&orderNo=ORDER&page=2',
    queue: '售后申请队列', list: '.managed-work-list', filter: '按订单编号筛选',
    draft: '暂未提交的订单搜索词',
    row: (id: string) => ({
      id, title: `售后订单 ${id}`, orderNo: `ORDER${id}`, orderType: 'STOCK', applicationType: 'NORMAL',
      reasonCode: 'MISMATCH', status: 'REFUNDED', createdAt, totalAmount: '180.00',
    }),
  },
]

/** 只拦截后端来源，浏览器运行真实路由、交互和历史记录。 */
async function mockQueue(page: Page, fixture: typeof queueFixtures[number]) {
  await page.routeWebSocket('**/api/ws', socket => socket.onMessage(value => {
    if (value === 'PING') socket.send(JSON.stringify({ type: 'PONG' }))
  }))
  await page.route(api + '/**', async route => {
    const url = new URL(route.request().url())
    let data: unknown = { items: [], total: 0, count: 0, page: 1, size: 20 }
    if (url.pathname === '/api/sessions/current') {
      data = { userId: '19', nickname: '审核管理员', roles: ['ADMIN'], activeRole: 'ADMIN' }
    } else if (url.pathname === '/api' + fixture.endpoint) {
      const pageNumber = Number(url.searchParams.get('page'))
      const items = Array.from({ length: 20 }, (_, index) => fixture.row(String(100 + index)))
      data = { items, total: 60, page: pageNumber, size: 20 }
    } else if (url.pathname.startsWith('/api' + fixture.endpoint + '/')) {
      // 详情失败时也要能回队列。此处避免构造与历史导航无关的交易与审核数据。
      return route.fulfill({ status: 404, json: { code: 404, message: '详情已不可访问' } })
    }
    await route.fulfill({ json: { code: 0, data } })
  })
}

for (const fixture of queueFixtures) {
  test(`${fixture.name}从队列返回保留页码、滚动和焦点，浏览器仍可前进到详情`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockQueue(page, fixture)
    const queuePath = `${fixture.route}?${fixture.query}`
    const detailPath = `${fixture.route}/113?${fixture.query}`
    await page.goto(queuePath)
    const queue = page.getByRole('region', { name: fixture.queue })
    const list = queue.locator(fixture.list)
    const selected = queue.locator(`a[href^="${fixture.route}/113?"]`)
    const scrollTop = () => list.evaluate(element => element.scrollTop)
    await expect(queue.getByText(/第 2 页/)).toBeVisible()
    if (fixture.draft) await queue.getByLabel(fixture.filter, { exact: true }).fill(fixture.draft)
    await selected.scrollIntoViewIfNeeded()
    const before = await scrollTop()
    expect(before).toBeGreaterThan(100)
    await selected.focus()
    await selected.press('Enter')
    await expect(page).toHaveURL(detailPath)
    await expect(page.getByRole('alert')).toContainText('详情已不可访问')
    await page.getByRole('link', { name: '返回队列', exact: true }).click()
    await expect(page).toHaveURL(queuePath)
    await expect(selected).toBeFocused()
    await expect.poll(scrollTop).toBe(before)

    let expectedFocus = selected
    let expectedScroll = before
    // 前进也会离开队列，下一次后退应恢复这次离开前的位置。
    if (fixture.route === '/admin/works') {
      expectedFocus = queue.locator('a[href^="/admin/works/117?"]')
      await expectedFocus.focus()
      expectedScroll = await scrollTop()
      expect(expectedScroll).toBeGreaterThan(before)
    }
    await page.goForward()
    await expect(page).toHaveURL(detailPath)
    await page.goBack()
    await expect(page).toHaveURL(queuePath)
    await expect(queue.getByText(/第 2 页/)).toBeVisible()
    await expect(expectedFocus).toBeFocused()
    await expect.poll(scrollTop).toBe(expectedScroll)
    if (fixture.draft) await expect(queue.getByLabel(fixture.filter, { exact: true })).toHaveValue(fixture.draft)
  })

  test(`${fixture.name}直接打开详情时返回到带筛选的队列`, async ({ page }) => {
    await mockQueue(page, fixture)
    await page.goto(`${fixture.route}/113?${fixture.query}`)
    await page.getByRole('link', { name: '返回队列', exact: true }).click()
    await expect(page).toHaveURL(`${fixture.route}?${fixture.query}`)
    await expect(page.getByRole('region', { name: fixture.queue }).getByText(/第 2 页/)).toBeVisible()
  })
}

test('售后队列刷新期间打开仍可操作的记录，返回时恢复队列焦点', async ({ page }) => {
  const fixture = queueFixtures[2]!
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockQueue(page, fixture)
  await page.goto(`${fixture.route}?${fixture.query}`)
  const queue = page.getByRole('region', { name: fixture.queue })
  const selected = queue.locator('a[href^="/admin/refunds/113?"]')
  await selected.focus()
  const list = queue.locator(fixture.list)
  const before = await list.evaluate(element => element.scrollTop)
  expect(before).toBeGreaterThan(100)

  let finishRefresh!: () => void
  const refreshing = new Promise<void>(resolve => { finishRefresh = resolve })
  await page.route(api + '/admin/refund-applications?*', async route => {
    await refreshing
    await route.fallback()
  })
  try {
    await page.evaluate(() => window.dispatchEvent(new Event('order-updated')))
    await expect(queue).toHaveAttribute('aria-busy', 'true')
    await selected.press('Enter')
    await expect(page).toHaveURL(`${fixture.route}/113?${fixture.query}`)
  } finally {
    finishRefresh()
  }
  await expect(queue).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('link', { name: '返回队列', exact: true }).click()
  await expect(selected).toBeFocused()
  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBe(before)
})
