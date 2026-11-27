import { expect, test, type Page } from '@playwright/test'
import type { WorkVO } from '../src/types/work'
import type { OrderVO, QuoteComparisonVO } from '../src/types/quote'
import { origin } from './environment'

const time = '2026-11-26T00:00:00+08:00'
const empty = { items: [], total: 0, page: 1, size: 20 }
const session = { userId: '1', nickname: '测试买家', roles: ['BUYER'], activeRole: 'BUYER' }
const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
const work: WorkVO = {
  id: '1', creatorId: '2', creatorNickname: '手艺人', creatorAvatarUrl: null, creatorAvatarExpiresAt: null,
  title: '木制摆件', categoryId: '3', categoryPath: ['木工'], mainImageIds: [], specificationImageIds: [],
  description: '以黑胡桃木制作和打磨的摆件。', processDescription: '', material: '木材', specification: '15cm',
  saleEnabled: false, customEnabled: false, stockPrice: null, customReferenceDays: null,
  sourceOrderId: null, version: '1', reviewStatus: 'ONLINE', stockStatus: null, submittedAt: null,
  firstSubmittedAt: null, onlineAt: time, updatedAt: time, createdAt: time, reviewReason: null,
  purchasable: false, customizable: false, coverImage: null,
}

type Mock = (path: string, request: URL, method: string) => { data: unknown; status?: number } | undefined

async function mockApi(page: Page, resolve: Mock) {
  await page.routeWebSocket(/\/ws\//, () => { /* 独立验证页面 HTTP 交互。 */ })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.slice(4)
    const method = route.request().method()
    const result = resolve(path, url, method) ?? {
      data: path === '/sessions/current' ? session : path === '/categories' ? [] : { count: 0 },
    }
    const status = result.status ?? 200
    await route.fulfill({
      status,
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' },
      json: { code: status >= 400 ? 500 : 0, message: status >= 400 ? '操作暂时不可用' : '', data: result.data },
    })
  })
}

test('广场等待卡片渲染后恢复浏览位置，直接打开结果锚点时避开页头', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const items = Array.from({ length: 20 }, (_, index) => ({
    ...work, id: String(index + 1), title: '作品 ' + (index + 1),
  }))
  await mockApi(page, (path, url) => {
    if (path === '/works') return { data: { ...empty, items, total: 60, page: Number(url.searchParams.get('page')) } }
    if (/^\/works\/\d+$/.test(path)) return { data: items[Number(path.split('/').at(-1)) - 1] }
    if (/\/comments$/.test(path)) return { data: empty }
    return undefined
  })
  // 浏览器后退时先显示加载态，确保断言覆盖异步数据渲染。
  let listRequests = 0
  await page.route(url => url.pathname === '/api/works', async route => {
    if (++listRequests > 1) {
      await expect(page.getByRole('status', { name: '' }).filter({ hasText: '正在读取作品' })).toBeVisible()
    }
    await route.fallback()
  })
  await page.goto('/?page=2&keyword=木工')
  const card = page.getByRole('link', { name: '作品 18', exact: true })
  await card.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => scrollY)
  expect(before).toBeGreaterThan(700)
  await card.click()
  await expect(page).toHaveURL('/works/18')
  await page.goBack()
  await expect(page).toHaveURL('/?page=2&keyword=木工')
  await expect(card).toBeVisible()
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before)
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page).toHaveURL(/page=3/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)

  await page.goto('/#discover')
  await expect.poll(() => page.evaluate(() => {
    const header = document.querySelector('.craft-header')?.getBoundingClientRect()
    const results = document.getElementById('discover')?.getBoundingClientRect()
    return Boolean(header && results && scrollY > 0 && results.top >= header.bottom && results.top <= header.bottom + 32)
  })).toBe(true)
})

test('广场切换一级品类时保持阅读位置和原结果高度，查询完成后更换卡片', async ({ page }) => {
  const initial = Array.from({ length: 20 }, (_, index) => ({
    ...work, id: String(index + 1), title: '全部作品样例 ' + (index + 1),
  }))
  const category = { id: '3', name: '家居器物', children: [{ id: '4', name: '木工挂饰', children: [] }] }
  const filtered = [{ ...work, id: '21', title: '家居器物样例' }]
  await mockApi(page, (path, url) => {
    if (path === '/categories') return { data: [category] }
    if (path === '/works') {
      const items = url.searchParams.has('categoryId') ? filtered : initial
      return { data: { ...empty, items, total: items.length } }
    }
    return undefined
  })
  let releaseQuery: () => void = () => {}
  const waitForQuery = new Promise<void>(resolve => { releaseQuery = resolve })
  await page.route(url => url.pathname === '/api/works' && url.searchParams.has('categoryId'), async route => {
    await waitForQuery
    await route.fallback()
  })
  await page.goto('/')
  const cards = page.locator('.work-grid .work-card')
  await expect(cards).toHaveCount(initial.length)
  const categories = page.getByRole('navigation', { name: '一级品类' })
  const filteredCategory = categories.getByRole('button', { name: category.name })
  await expect(filteredCategory).toBeVisible()
  await page.evaluate(() => scrollTo(0, 48))
  const results = page.getByRole('region', { name: '搜索结果' })
  const before = await results.evaluate(element => {
    const { top, height } = element.getBoundingClientRect()
    return { top, height, scroll: scrollY }
  })
  try {
    await filteredCategory.click()
    await expect(results).toHaveAttribute('aria-busy', 'true')
    await expect(cards).toHaveCount(initial.length)
    await expect(results.locator('.cf-work-result-content')).toHaveAttribute('inert', '')
    await expect.poll(() => results.evaluate(element => {
      const { top, height } = element.getBoundingClientRect()
      return { top, height, scroll: scrollY }
    })).toEqual(before)
  } finally {
    releaseQuery()
  }
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByRole('link', { name: filtered[0].title, exact: true })).toBeVisible()
  await expect(cards).toHaveCount(1)
  await categories.getByRole('button', { name: '全部作品' }).click()
  await expect(cards).toHaveCount(initial.length)
})

test('需求报价锚点和首个输入框在桌面及窄窗中都避开页头', async ({ page }) => {
  await mockApi(page, path => {
    if (path === '/sessions/current') return { data: { ...session, roles: ['BUYER', 'CREATOR'], activeRole: 'CREATOR' } }
    if (path === '/custom-requests/1') return { data: {
      id: '1', title: '制作木制摆件', status: 'OPEN', categoryPath: ['木工'], visibility: 'PUBLIC',
      buyerNickname: '买家', description: '制作要求和说明。'.repeat(40), referenceImageIds: [],
      purpose: '陈列', materialPreference: '木材', specification: '100cm', owned: false, canQuote: true,
    } }
    if (path === '/custom-requests/1/quotes') return { data: empty }
    if (path === '/me/quote-quota') return { data: { used: 0, remaining: 5, limit: 5 } }
    return undefined
  })
  for (const width of [600, 760, 1024, 1366, 1440]) {
    await page.setViewportSize({ width, height: 650 })
    await page.goto('about:blank')
    await page.goto('/requests/1?returnTo=%2Frequests#quotes')
    await expect(page.getByRole('heading', { name: '我的报价方案' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: '报价金额（元）', exact: true })).toBeEnabled()
    await expect.poll(() => page.evaluate(() => {
      const header = document.querySelector('.craft-header')?.getBoundingClientRect()
      const heading = document.querySelector('#quotes h2')?.getBoundingClientRect()
      const input = document.querySelector('#quotes input')?.getBoundingClientRect()
      return Boolean(header && heading && input && scrollY > 0
        && heading.top >= header.bottom && heading.bottom <= innerHeight
        && input.top >= header.bottom && input.bottom <= innerHeight)
    }), { message: `${width}px 的报价标题及首个输入框均在页头下方可见` }).toBe(true)
  }
})

test('需求分页提供业务名称', async ({ page }) => {
  await mockApi(page, path => path === '/me/custom-requests'
    ? { data: { ...empty, total: 40 } }
    : undefined)
  await page.goto('/my-requests')
  await expect(page.getByRole('navigation', { name: '需求分页', exact: true })).toBeVisible()
})

test('前台退出失败后可以关闭提示并再次退出', async ({ page }) => {
  let attempts = 0
  await mockApi(page, (path, _url, method) => {
    if (path === '/csrf') return { data: { headerName: 'X-CSRF', token: 'csrf' } }
    if (path === '/sessions/current') {
      if (method === 'DELETE') return { data: null, status: ++attempts === 1 ? 503 : 200 }
      return { data: attempts > 1 ? null : session, status: attempts > 1 ? 401 : 200 }
    }
    if (path === '/works') return { data: empty }
    return undefined
  })
  await page.goto('/')
  const logout = page.getByRole('button', { name: '退出登录', exact: true })
  await logout.click()
  await expect(page.getByRole('alert')).toHaveText(/操作暂时不可用/)
  await expect(page).toHaveURL('/')
  const dismiss = page.getByRole('button', { name: '关闭退出提示' })
  await expect(dismiss).toBeVisible()
  await dismiss.click()
  await expect(logout).toBeFocused()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await logout.click()
  await expect(page).toHaveURL('/login')
  expect(attempts).toBe(2)
})

test('无效图片签名不会自动重复读取，手动重试后恢复', async ({ page }) => {
  let requests = 0
  await mockApi(page, path => {
    if (path === '/works') return { data: { ...empty, items: [{ ...work, mainImageIds: ['4'] }], total: 1 } }
    if (path === '/work-images/4') return { data: { url: testImage, expiresAt: ++requests < 4 ? 'invalid' : new Date(Date.now() + 60_000).toISOString() } }
    return undefined
  })
  await page.goto('/')
  const readAgain = page.getByRole('button', { name: '重新读取图片' })
  await expect(readAgain).toBeVisible()
  expect(requests).toBe(1)
  await readAgain.click()
  await expect(readAgain).toBeVisible()
  expect(requests).toBe(2)
  await readAgain.click()
  await expect(readAgain).toBeVisible()
  expect(requests).toBe(3)
  await readAgain.click()
  await expect(page.getByRole('img', { name: '木制摆件' })).toBeVisible()
  expect(requests).toBe(4)
})

test('有效的作品图续签，离开广场后停止后续续签', async ({ page }) => {
  let requests = 0
  const clock = Date.now()
  await page.clock.install({ time: clock })
  await mockApi(page, path => {
    if (path === '/works') return { data: { ...empty, items: [{ ...work, mainImageIds: ['4'] }], total: 1 } }
    if (path === '/me/orders') return { data: empty }
    if (path === '/work-images/4') return { data: {
      url: testImage,
      expiresAt: new Date(clock + 25_000 + 5000 * requests++).toISOString(),
    } }
    return undefined
  })
  await page.goto('/')
  await expect(page.getByRole('img', { name: '木制摆件' })).toBeVisible()
  expect(requests).toBe(1)
  await page.clock.runFor(5200)
  await expect.poll(() => requests).toBe(2)
  await page.getByRole('link', { name: '我的订单', exact: true }).click()
  await expect(page).toHaveURL('/orders')
  await page.clock.runFor(10_000)
  expect(requests).toBe(2)
})

test('报价放大图保留键盘操作，定标确认区域避开页头', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const comparison: QuoteComparisonVO = {
    requestId: '1', requestTitle: '木制摆件', expectedShipDate: '2026-12-31',
    activeCount: 1, limit: 5, canAward: true, awardDisabledReason: null, serverDate: '2026-11-26',
    items: [{
      id: '7', requestId: '1', requestTitle: '木制摆件', creatorId: '2', creatorNickname: '手艺人',
      goodsAmount: '100.00', durationDays: 7, proposal: '以黑胡桃木制作和打磨的摆件。', imageIds: ['4'],
      additionalAgreement: null, status: 'ACTIVE', invalidReason: null, createdAt: time,
      expiresAt: '2026-12-04T00:00:00+08:00', estimatedShipDate: '2026-12-05', averageRating: null,
      reviewCount: 0, positiveRate: null, completedOrderCount: 0, owned: false, canWithdraw: false, canAward: true,
    }],
  }
  await mockApi(page, path => {
    if (path === '/custom-requests/1/quote-comparison') return { data: comparison }
    if (path === '/custom-requests/1/quotes') return { data: empty }
    if (path === '/quote-images/4') return { data: {
      url: testImage, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    } }
    return undefined
  })
  await page.goto('/requests/1/quotes')
  const trigger = page.getByRole('button', { name: '放大方案图片 1' })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  const largeImage = dialog.getByRole('img', { name: '方案图片大图' })
  await expect(largeImage).toBeVisible()
  await expect(largeImage).toHaveCSS('object-fit', 'contain')
  await expect(dialog).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await page.getByRole('button', { name: '选择此方案', exact: true }).click()
  const confirmation = page.getByRole('region', { name: '定标确认', exact: true })
  await expect(confirmation.getByRole('combobox', { name: '选择收货地址' })).toBeEnabled()
  await expect.poll(() => confirmation.evaluate(element => {
    const header = document.querySelector('.craft-header')?.getBoundingClientRect()
    const heading = element.querySelector('h2')?.getBoundingClientRect()
    const address = element.querySelector('select')?.getBoundingClientRect()
    return Boolean(header && heading && address && heading.top >= header.bottom && address.bottom <= innerHeight)
  })).toBe(true)
})

test('认证三页布局对齐，矮窗出现错误后仍可键盘到达提交入口', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await mockApi(page, path => {
    if (path === '/sessions/current') return { data: null, status: 401 }
    if (path === '/csrf') return { data: { headerName: 'X-CSRF', token: 'csrf' } }
    if (path === '/email-verification-codes') return { data: null, status: 503 }
    return undefined
  })
  await page.goto('/login')
  const authBounds = () => page.locator('.craft-auth__intro, .craft-auth__tabs, .craft-auth__view').evaluateAll(nodes =>
    nodes.map(node => node.getBoundingClientRect().toJSON()),
  )
  await expect(page.getByRole('heading', { name: '欢迎回到匠心集' })).toBeVisible()
  const loginBounds = await authBounds()
  const tabs = page.getByRole('navigation', { name: '账号入口' })
  await tabs.getByRole('link', { name: '新用户注册' }).click()
  await expect(page.getByRole('heading', { name: '创建匠心集账号' })).toBeVisible()
  expect(await authBounds()).toEqual(loginBounds)
  expect(await page.evaluate(() => {
    const panel = document.querySelector('.craft-auth__view')!
    return panel.clientHeight === panel.scrollHeight && document.documentElement.scrollHeight === innerHeight
  })).toBe(true)
  await tabs.getByRole('link', { name: '找回密码' }).click()
  await expect(page.getByRole('heading', { name: '设置新的登录密码' })).toBeVisible()
  expect(await authBounds()).toEqual(loginBounds)
  await tabs.getByRole('link', { name: '新用户注册' }).click()
  await page.setViewportSize({ width: 1366, height: 540 })
  await page.getByRole('textbox', { name: '邮箱地址' }).fill('123456@qq.com')
  await page.getByRole('button', { name: '发送验证码' }).click()
  await expect(page.getByRole('alert')).toContainText('操作暂时不可用')
  const submit = page.getByRole('button', { name: '注册账号' })
  for (let key = 0; key < 8; key++) {
    if (await submit.evaluate(element => element === document.activeElement)) break
    await page.keyboard.press('Tab')
  }
  await expect(submit).toBeFocused()
  await expect(submit).toBeInViewport()
})

test('订单公开授权资料页和制作进度锚点均完整定位', async ({ page }) => {
  const order: OrderVO = {
    id: '1', orderNo: 'T033-ORDER-1', orderType: 'CUSTOM', buyerId: '1', buyerNickname: '测试买家',
    creatorId: '2', creatorNickname: '手艺人', requestId: '7', quoteId: '8', status: 'COMPLETED',
    title: '定制木制摆件', totalAmount: '100.00', paidAmount: '100.00', paidAt: time, termsConfirmedAt: time,
    shipDate: '2026-12-01', shipDeadlineAt: null, durationDays: 7,
    agreementSnapshot: {
      request: { title: '制作木制摆件', description: '定制摆件的约定。'.repeat(25), purpose: '陈列',
        materialPreference: '木材', specification: '15cm', categoryPath: ['木工'], referenceImageIds: [], sourceWorkId: null },
      proposal: '制作说明。', additionalAgreement: null, imageIds: [], expectedShipDate: '2026-12-01',
      confirmedEstimatedShipDate: '2026-12-01', durationDays: 7, goodsAmount: '100.00',
    },
    addressSnapshot: null, startedAt: time, startDeadlineAt: null, trackingNo: null, shippedAt: time,
    autoConfirmAt: null, originalCompletedAt: time, serverTime: time, canStart: false, canShip: false,
    canCorrectTracking: false, canConfirmReceipt: false, canRequestNoStartRefund: false, canRequestRefund: false,
    refundWindowEndsAt: null, currentRefund: null, publicationConsentStatus: 'PENDING', publicationRequestedAt: time,
    publicationRespondedAt: null, canRequestPublicationConsent: false, canRespondPublicationConsent: true,
    shippingOverdue: false, trackingHistory: [], noStartRefund: null, createdAt: time, payDeadlineAt: time,
    cancelledAt: null, cancelReason: null, owned: true, canCancel: false, canPay: false, paymentPreview: null,
    payment: null, settlement: null, conversationId: null, history: [],
    progressNodes: [{ id: '9', nodeCode: 'MATERIAL', sortOrder: 1, plannedFinishDate: '2026-11-26',
      status: 'CHECKED', handledAt: time, records: [], canCheckIn: false, canSkip: false,
      canSupplement: false, deviationDays: 0, overdue: false }],
  }
  await mockApi(page, path => {
    if (path === '/orders/1') return { data: order }
    if (path === '/me/orders') return { data: { ...empty, items: [order], total: 1 } }
    if (path.startsWith('/orders/1/')) return { data: empty }
    return undefined
  })
  const section = page.getByRole('region', { name: '定制成品公开授权' })
  const heading = page.getByRole('heading', { name: '定制成品公开授权', level: 1 })
  const authorizationBounds = () => page.evaluate(() => {
    const header = document.querySelector('.craft-header')?.getBoundingClientRect()
    const title = document.querySelector('.order-document-heading h1')?.getBoundingClientRect()
    return {
      width: innerWidth,
      headerBottom: header?.bottom,
      titleTop: title?.top,
      titleBottom: title?.bottom,
      visible: Boolean(header && title && title.top >= header.bottom && title.bottom <= innerHeight),
    }
  })
  for (const width of [1366, 1024, 760, 600]) {
    await page.setViewportSize({ width, height: 500 })
    // 每个尺寸从一个新文档访问深链，避免测到上一轮浏览器保留的滚动值。
    await page.goto('about:blank')
    await page.goto('/orders/1#publication-consent')
    await expect(page).toHaveURL('/orders/1/details/publication')
    await expect(heading).toBeFocused()
    await expect(section).toBeVisible()
    await expect.poll(authorizationBounds).toMatchObject({ width, visible: true })
    await page.goto('/orders/1')
    await page.getByRole('link', { name: '定制成品公开授权', exact: true }).click()
    await expect(page).toHaveURL('/orders/1/details/publication')
    await expect(heading).toBeFocused()
    await expect(section).toBeVisible()
    await expect.poll(authorizationBounds).toMatchObject({ width, visible: true })
    await page.goto('/orders/1#progress-9')
    const progress = page.locator('#progress-9')
    await expect(progress).toBeFocused()
    await expect.poll(() => progress.evaluate(element => {
      const header = document.querySelector('.craft-header')?.getBoundingClientRect()
      const title = element.querySelector('.node-heading')?.getBoundingClientRect()
      return Boolean(header && title && title.top >= header.bottom && title.bottom <= innerHeight)
    })).toBe(true)
  }
})

test('作品网格跨断点无横向溢出，键盘仍可访问品类和分页', async ({ page }) => {
  const category = { id: '3', parentId: null, name: '木工', enabled: true, sortOrder: 0, selectableForWork: true, children: [] }
  await mockApi(page, path => {
    if (path === '/categories') return { data: [category] }
    if (path === '/works') return { data: { ...empty, items: Array.from({ length: 8 }, (_, i) => ({
      ...work, id: String(i + 1), title: '作品 ' + (i + 1),
    })), total: 40 } }
    return undefined
  })
  await page.goto('/')
  const categoryButton = page.getByRole('button', { name: '木工', exact: true })
  await expect(categoryButton).toBeVisible()
  for (const width of [1366, 1000, 901, 900]) {
    await page.setViewportSize({ width, height: 768 })
    expect(await page.evaluate(() => {
      const covers = [...document.querySelectorAll('.work-grid .work-card-photo')].map(node => node.getBoundingClientRect())
      return covers.length === 8 && document.documentElement.scrollWidth <= innerWidth
        && covers.every((cover, index) => covers.slice(index + 1).every(other =>
          cover.right <= other.left || other.right <= cover.left || cover.bottom <= other.top || other.bottom <= cover.top,
        ))
    })).toBe(true)
  }
  const all = page.getByRole('button', { name: '全部作品' })
  await all.focus()
  await page.keyboard.press('Tab')
  await expect(categoryButton).toBeFocused()
  await expect(categoryButton).toHaveCSS('outline-offset', '2px')
  await expect(categoryButton).toHaveCSS('outline-style', 'solid')
  await page.getByRole('link', { name: '手艺人', exact: false }).last().focus()
  await page.keyboard.press('Tab')
  const next = page.getByRole('button', { name: '下一页' })
  await expect(next).toBeFocused()
  await expect(next).toHaveCSS('outline-style', 'solid')
})

test('窄窗需求详情显示在列表上方，返回后恢复筛选和页码', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 768 })
  const request = {
    id: '7', title: '制作木制摆件', status: 'OPEN', categoryPath: ['木工'], visibility: 'PUBLIC',
    buyerNickname: '买家', description: '需要一件木制摆件。', referenceImageIds: [],
    budgetMin: '150.00', budgetMax: '250.00', purpose: '陈列', materialPreference: '木材',
    specification: '15cm', owned: true,
  }
  await mockApi(page, (path, url) => {
    if (path === '/me/custom-requests') return { data: {
      ...empty, items: [request], total: 40, page: Number(url.searchParams.get('page') ?? '1'),
    } }
    if (path === '/custom-requests/7') return { data: request }
    return undefined
  })
  const listing = '/my-requests?status=OPEN&page=2'
  await page.goto(listing)
  await page.getByRole('link', { name: '制作木制摆件', exact: true }).click()
  await expect(page.getByRole('heading', { name: '制作木制摆件', exact: true, level: 1 })).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const detail = document.querySelector('.cf-request-main')?.getBoundingClientRect()
    const list = document.querySelector('.cf-request-collection')?.getBoundingClientRect()
    return Boolean(detail && list && detail.bottom <= list.top && document.documentElement.scrollWidth <= innerWidth)
  })).toBe(true)
  await page.getByRole('navigation', { name: '需求导航' }).getByRole('link', { name: '我的需求' }).click()
  await expect(page).toHaveURL(listing)
  await expect(page.getByRole('combobox', { name: '需求状态' })).toHaveValue('OPEN')
  await expect(page.getByRole('navigation', { name: '需求分页' })).toContainText('第 2 页')
})

test('浏览器无障碍树的互动和通知控件名称包含正确计数', async ({ page, context }) => {
  await mockApi(page, path => {
    if (path === '/works/1') return { data: work }
    if (path === '/works/1/interactions') return { data: {
      likeCount: 12, favoriteCount: 8, commentCount: 0, liked: false, favorited: false,
    } }
    if (path === '/works/1/comments' || path === '/me/notifications') return { data: empty }
    if (path === '/me/notifications/unread-count') return { data: { count: 3 } }
    return undefined
  })
  // 从浏览器生成的无障碍树核对角色和含计数的名称。
  const accessibility = await context.newCDPSession(page)
  async function includesControl(role: string, name: string) {
    const { nodes } = await accessibility.send('Accessibility.getFullAXTree')
    return nodes.some(node => !node.ignored && node.role?.value === role
      && node.name?.value === name)
  }
  try {
    await page.goto('/works/1')
    await expect.poll(() => includesControl('button', '点赞 点赞数 12')).toBe(true)
    await expect.poll(() => includesControl('button', '收藏 收藏数 8')).toBe(true)
    await page.goto('/messages/notifications')
    await expect.poll(() => includesControl('link', '系统通知 3 条未读')).toBe(true)
  } finally {
    await accessibility.detach()
  }
})
