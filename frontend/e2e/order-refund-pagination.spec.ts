import { test, expect, type Page } from '@playwright/test'
import { api } from './environment'
import type { RefundApplicationVO, RefundEvidenceVO } from '../src/types/refund'
import type { ChatMessageVO } from '../src/types/customRequest'

/** 受控网络仅验证分页和路由恢复；权限与事务由真实后端用例独立验证。 */
const application: RefundApplicationVO = {
  id: '301', orderId: '71', orderNo: 'CUSTOM71', buyerId: '11', creatorId: '12', applicationType: 'NORMAL', originalOrderStatus: 'IN_PRODUCTION', reasonCode: 'MISMATCH', description: '制作细节与原始约定存在差异，请核查双方约定及补充材料。', imageIds: [], status: 'WAIT_ADMIN', createRequestKey: 'pagination-request', version: 0, createdAt: '2026-11-19T09:00:00+08:00', finishedAt: null, handlerId: null, decisionReason: null, returnRequired: null, returnTrackingNo: null, returnConfirmedAt: null, returnConfirmedBy: null, noReturnBasis: null, canSupplement: true, canWithdraw: true, refundAmount: '180.00', conversationId: '101',
}
const order = {
  id: '71', orderNo: 'CUSTOM71', orderType: 'CUSTOM', buyerId: '11', buyerNickname: '分页买家', creatorId: '12', creatorNickname: '分页创作者', requestId: '81', quoteId: '91', status: 'AFTER_SALE', title: '售后分页验收订单', totalAmount: '180.00', paidAmount: '180.00', paidAt: '2026-11-19T08:00:00+08:00', serverTime: '2026-11-19T09:00:00+08:00', owned: true, canRequestRefund: false, currentRefund: application, refundWindowEndsAt: null, canStart: false, canShip: false, canPay: false, canCancel: false, canRequestNoStartRefund: false, canConfirmReceipt: false, canCorrectTracking: false, progressNodes: [], trackingHistory: [], history: [], durationDays: 10, createdAt: '2026-11-18T08:00:00+08:00', conversationId: '101', agreementSnapshot: { request: { title: '原订单需求', categoryPath: ['木作'], description: '已保存的订单约定', referenceImageIds: [] }, imageIds: [], proposal: '原木手工制作' },
}
const success = (data: unknown) => ({ code: 0, message: '成功', data })
const evidence: RefundEvidenceVO[] = Array.from({ length: 21 }, (_, index) => ({
  id: String(9007199254741001n + BigInt(index)), refundApplicationId: application.id, submitterId: index % 2 ? '12' : '11', requestKey: `evidence-${index + 1}`, content: `分页证据 ${index + 1}`, imageIds: [], createdAt: application.createdAt,
}))
const messages: ChatMessageVO[] = Array.from({ length: 4 }, (_, index) => ({
  id: String(701 + index), conversationId: '101', seqNo: String(9007199254741001n + BigInt(index)), senderId: index % 2 ? '12' : '11', clientMessageKey: `message-${index + 1}`, content: `只读会话 ${index + 1}`, imageIds: [], createdAt: application.createdAt, referencedNodeId: null, referencedNodeCode: null,
}))

async function mockSession(page: Page, administrator = false) {
  // 限定后端绝对来源，避免误拦 Vite 的 src/api 模块请求。
  await page.route(`${api}/**`, async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = { items: [], total: 0, page: 1, size: 20, count: 0 }
    if (path === '/api/sessions/current') data = { userId: administrator ? '19' : '11', email: 'pagination-test@qq.com', nickname: administrator ? '分页管理员' : '分页买家', roles: administrator ? ['ADMIN'] : ['BUYER'], activeRole: administrator ? 'ADMIN' : 'BUYER', expiresAt: '2099-01-01T00:00:00+08:00' }
    if (path === '/api/csrf') data = { headerName: 'X-CSRF-TOKEN', token: 'test-token' }
    if (path === '/api/orders/71') data = order
    await route.fulfill({ json: success(data) })
  })
}

function adminDetail(selected = application) {
  return { application: { ...selected, canSupplement: false, canWithdraw: false }, order: { ...order, orderNo: selected.orderNo, payment: { flowNo: 'PAY71', amount: '180.00', occurredAt: order.paidAt }, settlement: { paidAmount: '180.00', status: 'PENDING' } }, history: [], canDecide: selected.status === 'WAIT_ADMIN', serverTime: order.serverTime, decisionFacts: null }
}

test('用户证据afterId与后台证据cursor各自排他分页，后台会话仅使用before只读游标', async ({ page, context }) => {
  await mockSession(page)
  const userQueries: URL[] = []
  await page.route(`${api}/orders/71/refund-applications*`, route => route.fulfill({ json: success({ items: [application], total: 1, page: 1, size: 20 }) }))
  await page.route(`${api}/refund-applications/301`, route => route.fulfill({ json: success(application) }))
  await page.route(`${api}/refund-applications/301/evidence*`, route => {
    const url = new URL(route.request().url()); userQueries.push(url)
    const cursor = url.searchParams.get('afterId')
    const items = evidence.filter(item => !cursor || BigInt(item.id) > BigInt(cursor)).slice(0, 20)
    return route.fulfill({ json: success({ items, nextCursor: items.at(-1)?.id || null, hasMore: !cursor }) })
  })
  await page.goto('/orders/71')
  const userPanel = page.getByRole('region', { name: '订单售后' })
  await expect(userPanel.getByText('分页证据 20', { exact: true })).toBeVisible()
  await userPanel.getByRole('button', { name: '继续读取证据', exact: true }).click()
  await expect(userPanel.getByText('分页证据 21', { exact: true })).toBeVisible()
  expect(userQueries.at(-1)?.searchParams.get('afterId')).toBe(evidence[19]!.id)
  expect(userQueries.every(url => !url.searchParams.has('cursor'))).toBe(true)
  await expect(userPanel.locator('.refund-evidence > li')).toHaveCount(22)
  await expect(userPanel.locator('.refund-evidence .request-description')).toHaveText([application.description, ...evidence.map(item => item.content)])
  await expect(userPanel.getByText('分页证据 20', { exact: true })).toHaveCount(1)
  await expect(userPanel.getByRole('button', { name: '继续读取证据', exact: true })).toHaveCount(0)

  // 分开页面建立管理员会话，避免将买家登录状态当成管理员权限。
  const admin = await context.newPage()
  try {
    await mockSession(admin, true)
    const adminQueries: URL[] = []; const chatQueries: URL[] = []; const adminWrites: string[] = []
    admin.on('request', request => { if (request.url().startsWith(api) && !['GET', 'OPTIONS'].includes(request.method())) adminWrites.push(request.url()) })
    await admin.route(`${api}/admin/refund-applications*`, route => route.fulfill({ json: success({ items: [{ ...application, title: order.title, totalAmount: '180.00' }], total: 1, page: 1, size: 20 }) }))
    await admin.route(`${api}/admin/refund-applications/301`, route => route.fulfill({ json: success(adminDetail()) }))
    await admin.route(`${api}/admin/refund-applications/301/evidence*`, route => {
      const url = new URL(route.request().url()); adminQueries.push(url)
      const cursor = url.searchParams.get('cursor')
      const items = evidence.filter(item => !cursor || BigInt(item.id) > BigInt(cursor)).slice(0, 20)
      return route.fulfill({ json: success({ items, nextCursor: items.at(-1)?.id || null, hasMore: !cursor }) })
    })
    await admin.route(`${api}/admin/refund-applications/301/messages*`, route => {
      const url = new URL(route.request().url()); chatQueries.push(url)
      const before = url.searchParams.get('before')
      const items = before ? messages.filter(item => BigInt(item.seqNo) < BigInt(before)) : messages.slice(2)
      return route.fulfill({ json: success({ items, hasMore: !before }) })
    })
    await admin.goto('/admin/refunds/301')
    const proof = admin.getByRole('region', { name: '双方补证' })
    await expect(proof.getByText('分页证据 20', { exact: true })).toBeVisible()
    await proof.getByRole('button', { name: '继续读取证据', exact: true }).click()
    await expect(proof.getByText('分页证据 21', { exact: true })).toBeVisible()
    expect(adminQueries.at(-1)?.searchParams.get('cursor')).toBe(evidence[19]!.id)
    expect(adminQueries.every(url => !url.searchParams.has('afterId'))).toBe(true)
    await expect(proof.locator('.refund-evidence > li')).toHaveCount(21)
    await expect(proof.locator('.refund-evidence .request-description')).toHaveText(evidence.map(item => item.content))
    await expect(proof.getByText('分页证据 20', { exact: true })).toHaveCount(1)
    await expect(proof.getByRole('button', { name: '继续读取证据', exact: true })).toHaveCount(0)
    await admin.getByText('原订单会话（只读）', { exact: true }).click()
    await expect(admin.getByText('只读会话 3', { exact: true })).toBeVisible()
    await admin.getByRole('button', { name: '读取更早会话', exact: true }).click()
    await expect(admin.locator('.refund-readonly-chat .request-description')).toHaveText(messages.map(item => item.content!))
    expect(chatQueries.at(-1)?.searchParams.get('before')).toBe(messages[2]!.seqNo)
    expect(chatQueries.every(url => !url.searchParams.has('after'))).toBe(true)
    await expect(admin.getByRole('button', { name: '读取更早会话', exact: true })).toHaveCount(0)
    await expect(admin.getByText('只读会话 3', { exact: true })).toHaveCount(1)
    expect(adminWrites).toEqual([])

    // 证据页失去管理员权限、会话页资源失效时，原材料与裁定草稿都必须从页面撤下。
    for (const denied of [
      { path: 'evidence', cursor: 'cursor', action: '继续读取证据', status: 403 },
      { path: 'messages', cursor: 'before', action: '读取更早会话', status: 404 },
    ]) {
      await admin.reload()
      await expect(proof.getByText('分页证据 20', { exact: true })).toBeVisible()
      await admin.getByLabel('裁定原因').fill('权限失效后需要清除的核查草稿。')
      if (denied.path === 'messages') await admin.getByText('原订单会话（只读）', { exact: true }).click()
      await admin.route(`${api}/admin/refund-applications/301/${denied.path}*`, route => {
        const url = new URL(route.request().url())
        return url.searchParams.has(denied.cursor)
          ? route.fulfill({ status: denied.status, json: { code: denied.status, message: '查证材料不可访问' } })
          : route.fallback()
      })
      await admin.getByRole('button', { name: denied.action, exact: true }).click()
      await expect(admin.getByRole('alert')).toContainText('查证材料不可访问')
      await expect(proof).toHaveCount(0)
      await expect(admin.getByText('只读会话 3', { exact: true })).toHaveCount(0)
      await expect(admin.getByLabel('裁定原因')).toHaveCount(0)
      expect(await admin.evaluate(() => sessionStorage.getItem('order-refund:19:admin-draft:301'))).toBeNull()
    }
  } finally { await admin.close() }
})

test('后台队列超过二十条可翻页，查看与返回及焦点刷新保留全部筛选条件和页码', async ({ page }) => {
  await mockSession(page, true)
  const queries: URL[] = []
  await page.route(`${api}/admin/refund-applications?*`, route => {
    const url = new URL(route.request().url()); queries.push(url)
    const pageNo = Number(url.searchParams.get('page') || 1)
    const rows = Array.from({ length: 21 }, (_, index) => ({ ...application, id: String(301 + index), orderNo: `PAGING${String(index + 1).padStart(3, '0')}`, title: `分页申请 ${index + 1}`, totalAmount: '180.00', status: url.searchParams.get('status') || 'WAIT_ADMIN', applicationType: url.searchParams.get('applicationType') || 'NORMAL' }))
    return route.fulfill({ json: success({ items: rows.slice((pageNo - 1) * 20, pageNo * 20), total: rows.length, page: pageNo, size: 20 }) })
  })
  const selected = { ...application, id: '321', orderNo: 'PAGING021', status: 'REFUNDED', applicationType: 'NO_START_TIMEOUT', canSupplement: false, canWithdraw: false }
  await page.route(`${api}/admin/refund-applications/321`, route => route.fulfill({ json: success(adminDetail(selected)) }))
  await page.route(`${api}/admin/refund-applications/321/evidence*`, route => route.fulfill({ json: success({ items: [], nextCursor: null, hasMore: false }) }))
  await page.route(`${api}/admin/refund-applications/321/messages*`, route => route.fulfill({ json: success({ items: [], hasMore: false }) }))
  await page.goto('/admin/refunds')
  const queue = page.getByRole('region', { name: '售后申请队列' })
  await queue.getByLabel('申请状态', { exact: true }).selectOption('REFUNDED')
  await queue.getByLabel('申请类型', { exact: true }).selectOption('NO_START_TIMEOUT')
  await queue.getByLabel('按订单编号筛选').fill('  PAGING  ')
  await queue.getByLabel('金额从', { exact: true }).fill('0')
  await queue.getByRole('button', { name: '筛选申请', exact: true }).click()
  await expect(queue.locator('.managed-work-row')).toHaveCount(20)
  await expect(queue.getByText('第 1 页 · 共 21 条', { exact: true })).toBeVisible()
  await queue.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(queue.locator('.managed-work-row')).toHaveCount(1)
  await expect(queue.getByRole('heading', { name: '分页申请 21', exact: true })).toBeVisible()
  await expect(queue.getByText('第 2 页 · 共 21 条', { exact: true })).toBeVisible()
  await expect(queue.getByRole('button', { name: '下一页', exact: true })).toBeDisabled()
  const assertConditions = () => {
    const query = new URL(page.url()).searchParams
    const expected = { status: 'REFUNDED', applicationType: 'NO_START_TIMEOUT', orderNo: 'PAGING', minAmount: '0', page: '2' }
    expect(Object.fromEntries(query)).toEqual(expected)
    expect(Object.fromEntries(queries.at(-1)!.searchParams)).toMatchObject(expected)
  }
  assertConditions()
  await queue.getByRole('link', { name: '查看记录 ↗', exact: true }).click()
  await expect(page.getByRole('heading', { name: '查证与裁定', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: '售后初始申请' })).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/admin/refunds/321')
  assertConditions()
  await page.getByRole('link', { name: '返回队列', exact: true }).click()
  await expect(page.getByRole('heading', { name: '选择申请查看约定、履约和证据', exact: true })).toBeVisible()
  await expect(queue.getByLabel('申请状态', { exact: true })).toHaveValue('REFUNDED')
  await expect(queue.getByLabel('申请类型', { exact: true })).toHaveValue('NO_START_TIMEOUT')
  await expect(queue.getByLabel('按订单编号筛选')).toHaveValue('PAGING')
  await expect(queue.getByLabel('金额从', { exact: true })).toHaveValue('0')
  assertConditions()
  // 焦点刷新依据已应用的 URL 条件，保留表单里尚未提交的筛选草稿。
  await queue.getByLabel('按订单编号筛选').fill('UNAPPLIED')
  const beforeFocus = queries.length
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => queries.length).toBeGreaterThan(beforeFocus)
  await expect(queue.getByLabel('按订单编号筛选')).toHaveValue('UNAPPLIED')
  await expect(queue.getByText('第 2 页 · 共 21 条', { exact: true })).toBeVisible()
  await expect(queue.locator('.managed-work-row')).toHaveCount(1)
  await expect(queue.getByRole('heading', { name: '分页申请 21', exact: true })).toBeVisible()
  assertConditions()
})
