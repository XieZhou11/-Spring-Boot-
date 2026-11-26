import { expect, test, type Page } from '@playwright/test'
import { api, origin } from './environment'

const blankPage = { items: [], total: 0, size: 20, page: 1 }

/** 路由、浏览器历史和界面均走真实前端，接口响应固定用于验证读取失败和链接上下文。 */
async function mockApi(page: Page, respond: (url: URL) => unknown) {
  await page.routeWebSocket('**/api/ws', () => {})
  await page.route(`${api}/**`, route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const data = respond(url) ?? (
      path.endsWith('/sessions/current')
        ? { userId: '10', nickname: '测试创作者', roles: ['BUYER', 'CREATOR'], activeRole: 'BUYER', expiresAt: '2099-01-01T00:00:00+08:00' }
        : path.endsWith('/csrf') ? { headerName: 'X-CSRF-TOKEN', token: 'test' }
          : path.includes('unread-count') ? { count: 0 } : blankPage
    )
    const failed = data === '读取失败'
    return route.fulfill({
      status: failed ? 503 : 200,
      json: { code: failed ? 50300 : 0, message: failed ? data : '成功', data: failed ? null : data },
      headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' },
    })
  })
}

test('广场读取失败后重试地址栏的条件和页码', async ({ page }) => {
  let fail = true
  const searches: string[][] = []
  await mockApi(page, url => {
    if (url.pathname.endsWith('/categories')) return []
    if (!url.pathname.endsWith('/works')) return
    searches.push([url.searchParams.get('keyword') ?? '', url.searchParams.get('page') ?? ''])
    if (fail) { fail = false; return '读取失败' }
    return blankPage
  })
  await page.goto('/?keyword=原条件&page=2')
  await expect(page.getByRole('alert')).toContainText('读取失败')
  await expect(page.getByRole('button', { name: '下一页' })).toHaveCount(0)
  await page.getByRole('searchbox', { name: '作品关键词' }).fill('还未应用')
  await page.getByRole('button', { name: '重新读取' }).click()
  await expect.poll(() => searches[1]).toEqual(['原条件', '2'])
  await expect(page.getByRole('searchbox', { name: '作品关键词' })).toHaveValue('还未应用')
})

test('定向邀约通知进入创作者工作台并可返回邀约', async ({ page }) => {
  await mockApi(page, url => {
    if (url.pathname.endsWith('/me/notifications')) return {
      ...blankPage, total: 1, items: [{ id: '1', title: '收到定向需求邀约', content: '请查看需求', readAt: '2026-11-26T18:00:00+08:00', eventType: 'REQUEST_INVITED', businessReference: { type: 'CUSTOM_REQUEST', id: '15' } }],
    }
    if (url.pathname.endsWith('/custom-requests/15')) return {
      id: '15', title: '定向木作需求', owned: false, buyerNickname: '买家', categoryPath: ['木作'],
      visibility: 'DIRECTED', invitedCreatorId: '10', status: 'OPEN', referenceImageIds: [],
    }
    if (url.pathname.endsWith('/quote-quota')) return { used: 0, limit: 20, remaining: 20 }
  })
  await page.goto('/messages/notifications')
  await page.getByRole('button', { name: '查看需求' }).click()
  await expect(page.getByRole('heading', { name: '定向木作需求' })).toBeVisible()
  const back = page.getByRole('navigation', { name: '需求导航' }).getByRole('link')
  await expect(back).toHaveText('收到的定向邀约')
  await expect(back).toHaveAttribute('href', '/creator/invitations')
  await back.click()
  await expect(page).toHaveURL('/creator/invitations')
})

const quoteComparison = {
  requestId: '15', requestTitle: '定制木盒', expectedShipDate: '2026-12-12', activeCount: 1, limit: 5, canAward: true,
  items: [{ id: '21', creatorNickname: '作者', creatorId: '22', goodsAmount: '100.00', durationDays: 7, estimatedShipDate: '2026-12-10', proposal: '制作木盒', imageIds: [], canAward: true }],
}

test('没有有效报价时显示空态且不渲染比价标记', async ({ page }) => {
  await mockApi(page, url => {
    if (url.pathname.endsWith('/quote-comparison')) return { ...quoteComparison, items: [], activeCount: 0, canAward: false }
  })
  await page.goto('/requests/15/quotes')
  await expect(page.getByRole('heading', { name: '暂无有效报价', exact: true })).toBeVisible()
  await expect(page.getByRole('table', { name: '报价方案对比' })).toHaveCount(0)
  await expect(page.getByText(/最低价|最短工期|Infinity/)).toHaveCount(0)
})

test('定标后可从订单中的原需求恢复列表来路', async ({ page }) => {
  await mockApi(page, url => {
    const path = url.pathname
    if (path.endsWith('/quote-comparison')) return quoteComparison
    if (path.endsWith('/me/addresses')) return [{ id: '1', recipientName: '买家', phone: '13000000000', province: '浙江', city: '杭州', district: '拱墅', detailAddress: '测试地址', isDefault: true }]
    if (path.endsWith('/award') || path.endsWith('/orders/99')) return {
      id: '99', orderNo: 'TEST99', title: '定制木盒', orderType: 'CUSTOM', owned: true, status: 'PENDING_PAYMENT',
      requestId: '15', goodsAmount: '100.00', progressNodes: [], history: [],
      agreementSnapshot: { expectedShipDate: '2026-12-12', imageIds: [], request: { categoryPath: ['木作'], referenceImageIds: [] } },
    }
    if (path.endsWith('/custom-requests/15')) return { id: '15', title: '定制木盒', owned: true, status: 'OPEN', categoryPath: ['木作'], referenceImageIds: [] }
  })
  await page.goto('/requests/15/quotes?returnTo=%2Fmy-requests%3Fstatus%3DOPEN%26page%3D2')
  await page.getByRole('button', { name: '选择此方案' }).click()
  await page.getByRole('button', { name: '确认定标并生成订单' }).click()
  await expect(page.getByRole('link', { name: '返回订单列表' })).toHaveAttribute('href', '/orders')
  await page.getByRole('link', { name: '查看原需求' }).click()
  await expect(page.getByRole('navigation', { name: '需求导航' }).getByRole('link')).toHaveAttribute('href', '/my-requests?status=OPEN&page=2')
})

for (const [path, endpoint, filter] of [
  ['/messages/notifications', '/me/notifications', ''],
  ['/messages/conversations', '/me/conversations', ''],
  ['/creator/works', '/me/works', 'PENDING'],
  ['/creator/quotes', '/me/quotes', 'ACTIVE'],
  ['/creator/income', '/me/settlements', 'PENDING'],
  ['/account/creator-certification', '/me/creator-applications', ''],
] as const) {
  test(`从链接恢复列表的第 2 页 ${path}`, async ({ page }) => {
    const loaded: URL[] = []
    await mockApi(page, url => {
      if (url.pathname.endsWith(endpoint)) {
        loaded.push(url)
        return { ...blankPage, total: 40, page: Number(url.searchParams.get('page')) }
      }
      if (url.pathname.endsWith('/categories')) return []
      if (url.pathname.endsWith('/me/creator-certification')) return { certificationStatus: 'NONE' }
    })
    const query = filter ? `page=2&status=${filter}` : 'page=2'
    await page.goto(`${path}?${query}`)
    await expect.poll(() => loaded.at(-1)?.searchParams.get('page')).toBe('2')
    if (filter) expect(loaded.at(-1)?.searchParams.get('status')).toBe(filter)
    await page.reload()
    await expect(page.getByText(/第 2 页/)).toBeVisible()
    await page.getByRole('button', { name: '上一页' }).click()
    await expect(page.getByText(/第 1 页/)).toBeVisible()
    await page.goBack()
    await expect(page.getByText(/第 2 页/)).toBeVisible()
  })
}

test('评价举报补证拒绝超过大小限制的图片并不发送上传请求', async ({ page }) => {
  let uploads = 0
  await mockApi(page, url => {
    const path = url.pathname
    if (path.endsWith('/creators/10')) return { id: '10', nickname: '测试创作者', categories: [], reviewCount: 1, completedOrderCount: 1 }
    if (path.endsWith('/creators/10/reviews')) return {
      ...blankPage, total: 1, items: [{ id: '15', content: '测试评价', rating: 5, images: [] }],
    }
    if (path.endsWith('/reviews/15/reports')) return [{ id: '20', reporterId: '10', status: 'PENDING' }]
    if (path.endsWith('/work-comment-images')) {
      uploads++
      return { id: '88', url: '', expiresAt: '2099-01-01T00:00:00+08:00' }
    }
  })
  await page.goto('/creators/10')
  await page.getByRole('button', { name: '查询关联举报' }).click()
  await page.locator('.review-report-followup input[type=file]').setInputFiles({
    name: 'oversize.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  })
  await expect(page.locator('.review-report-followup')).toContainText(/5\s*(MiB|MB)/i)
  expect(uploads).toBe(0)
})

test('同一评价的补证附件只属于所选举报', async ({ page }) => {
  await mockApi(page, url => {
    const path = url.pathname
    if (path.endsWith('/creators/10')) return { id: '10', nickname: '测试创作者', categories: [], reviewCount: 1, completedOrderCount: 1 }
    if (path.endsWith('/creators/10/reviews')) return {
      ...blankPage, total: 1, items: [{ id: '15', content: '测试评价', rating: 5, images: [] }],
    }
    if (path.endsWith('/reviews/15/reports')) return [
      { id: '20', reporterId: '12', status: 'PROCESSED' },
      { id: '21', reporterId: '13', status: 'PROCESSED' },
    ]
    if (path.endsWith('/work-comment-images')) return { id: '88', url: '', expiresAt: '2099-01-01T00:00:00+08:00' }
  })
  await page.goto('/creators/10')
  await page.getByRole('button', { name: '查询关联举报' }).click()
  const first = page.locator('.review-report-followup').filter({ hasText: '举报 #20' })
  const second = page.locator('.review-report-followup').filter({ hasText: '举报 #21' })
  await first.locator('input[type=file]').setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: Buffer.from('受控附件') })
  await expect(first.getByRole('button', { name: '提交材料' })).toBeEnabled()
  await expect(second.getByRole('button', { name: '提交材料' })).toBeDisabled()
  await first.locator('input[type=file]').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('不是图片') })
  await expect(first.getByRole('status')).toContainText('JPEG、PNG 或 WebP')
  await expect(first.getByRole('button', { name: '提交材料' })).toBeEnabled()
})

test('列表记录减少后校正末页并保留筛选', async ({ page }) => {
  const fetched: (string | null)[] = []
  await mockApi(page, url => {
    if (!url.pathname.endsWith('/me/settlements')) return
    fetched.push(url.searchParams.get('page'))
    return { ...blankPage, total: 20, page: Number(url.searchParams.get('page')) }
  })
  await page.goto('/creator/income?status=PENDING&page=2')
  await expect(page).toHaveURL('/creator/income?status=PENDING')
  await expect.poll(() => fetched).toEqual(['2', '1'])
  await expect(page.getByLabel('结算状态')).toHaveValue('PENDING')
})

test('会话列表页码在打开对话及返回时保留', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 })
  await mockApi(page, url => {
    if (url.pathname.endsWith('/me/conversations')) return {
      ...blankPage, total: 40, page: 2, items: [{ id: '7', otherNickname: '交易对方', canSend: false }],
    }
    if (url.pathname.endsWith('/conversations/7')) return { id: '7', otherNickname: '交易对方', canSend: false, readSeq: '0' }
    if (url.pathname.endsWith('/conversations/7/messages')) return { items: [], hasMore: false }
  })
  await page.goto('/messages/conversations?page=2')
  await page.getByRole('link', { name: /交易对方/ }).click()
  await expect(page).toHaveURL('/messages/conversations/7?page=2')
  await page.getByRole('link', { name: /返回会话列表/ }).click()
  await expect(page).toHaveURL('/messages/conversations?page=2')
})
