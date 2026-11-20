import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'
import { api } from './environment'
import type { RefundApplicationVO, RefundEvidenceDTO, RefundEvidenceVO } from '../src/types/refund'

/** 恢复行为使用受控网络故障，业务事务和权限另由真实后端用例验证。 */
const snapshot = {
  id: '71', orderNo: 'CUSTOM71', orderType: 'CUSTOM', buyerId: '11', buyerNickname: '售后买家', creatorId: '12', creatorNickname: '订单创作者', requestId: '81', quoteId: '91', status: 'IN_PRODUCTION', title: '售后恢复验收订单', totalAmount: '180.00', paidAmount: '180.00', paidAt: '2026-11-19T08:00:00+08:00', serverTime: '2026-11-19T09:00:00+08:00', owned: true, canRequestRefund: true, currentRefund: null, refundWindowEndsAt: null, canStart: false, canShip: false, canPay: false, canCancel: false, canRequestNoStartRefund: false, canConfirmReceipt: false, canCorrectTracking: false, progressNodes: [], trackingHistory: [], history: [], durationDays: 10, createdAt: '2026-11-18T08:00:00+08:00', conversationId: '101', agreementSnapshot: { request: { categoryPath: ['木作'], description: '已保存的订单约定', referenceImageIds: [] }, imageIds: [], proposal: '原木手工制作' },
}
async function prepare(page: Page, administrator = false) {
  page.on('pageerror', error => console.log('退款测试页面异常:', error.message))
  await page.route(`${api}/**`, async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = { items: [], total: 0, page: 1, size: 20, count: 0 }
    if (path === '/api/sessions/current') data = { userId: administrator ? '19' : '11', email: 'refund-test@qq.com', nickname: administrator ? '售后管理员' : '售后买家', roles: administrator ? ['ADMIN'] : ['BUYER'], activeRole: administrator ? 'ADMIN' : 'BUYER', expiresAt: '2099-01-01T00:00:00+08:00' }
    if (path === '/api/csrf') data = { headerName: 'X-CSRF-TOKEN', token: 'test-token' }
    if (path === '/api/orders/71') data = snapshot
    await route.fulfill({ json: { code: 0, message: '成功', data } })
  })
  if (!administrator) { await page.goto('/orders/71'); await expect(page.getByRole('heading', { name: snapshot.title })).toBeVisible() }
}

const application: RefundApplicationVO = { id: '301', orderId: '71', orderNo: 'CUSTOM71', buyerId: '11', creatorId: '12', applicationType: 'NORMAL', originalOrderStatus: 'IN_PRODUCTION', reasonCode: 'MISMATCH', description: '制作细节与原始约定存在差异，请管理员核查原始约定与照片。', imageIds: [], status: 'WAIT_ADMIN', createRequestKey: 'initial-request', version: 0, createdAt: '2026-11-19T09:00:00+08:00', finishedAt: null, handlerId: null, decisionReason: null, returnRequired: null, returnTrackingNo: null, returnConfirmedAt: null, returnConfirmedBy: null, noReturnBasis: null, canSupplement: true, canWithdraw: true, refundAmount: '180.00', conversationId: '101' }
const success = (data: unknown) => ({ code: 0, message: '成功', data })

test('请求未到达的未知申请刷新后只重试原请求键与内容', async ({ page }) => {
  await prepare(page)
  let first = true; let applied: RefundApplicationVO | undefined; const submissions: unknown[] = []
  await page.route(`${api}/orders/71/refund-applications*`, async route => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON(); submissions.push(input)
      if (first) { first = false; await route.abort(); return }
      applied = { ...application, ...input, createRequestKey: input.requestKey }
      await route.fulfill({ status: 201, json: success(applied) }); return
    }
    await route.fulfill({ json: success({ items: applied ? [applied] : [], total: applied ? 1 : 0, page: 1, size: 20 }) })
  })
  await page.route(`${api}/refund-applications/301`, route => route.fulfill({ json: success(applied) }))
  await page.route(`${api}/refund-applications/301/evidence*`, route => route.fulfill({ json: success({ items: [], hasMore: false, nextCursor: null }) }))
  const panel = page.getByRole('region', { name: '订单售后' }); page.on('dialog', dialog => dialog.accept())
  await panel.getByRole('button', { name: '申请普通退款', exact: true }).click()
  await panel.getByLabel('退款说明', { exact: true }).fill(application.description)
  await panel.getByRole('button', { name: '确认申请全额退款', exact: true }).click()
  await expect(panel.getByRole('button', { name: '重试原售后操作' })).toBeEnabled()
  await expect(panel.getByLabel('退款说明', { exact: true })).toBeDisabled()
  await page.reload()
  await expect(panel.getByLabel('退款说明', { exact: true })).toHaveValue(application.description)
  await expect(panel.getByRole('button', { name: '重试原售后操作' })).toBeEnabled()
  await panel.getByRole('button', { name: '重试原售后操作' }).click()
  await expect(panel.getByText('退款申请已进入管理员队列。')).toBeVisible()
  expect(submissions).toHaveLength(2); expect(submissions[1]).toEqual(submissions[0])
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.includes(':attempt:')))).toEqual([])
})

test('响应丢失后按原申请键核验成功且焦点刷新不覆盖草稿', async ({ page }) => {
  await prepare(page)
  const panel = page.getByRole('region', { name: '订单售后' }); page.on('dialog', dialog => dialog.accept())
  let applied: RefundApplicationVO | undefined; let submissions = 0
  await page.route(`${api}/orders/71/refund-applications*`, async route => {
    if (route.request().method() === 'POST') { const input = route.request().postDataJSON(); applied = { ...application, ...input, createRequestKey: input.requestKey }; submissions++; await route.abort(); return }
    await route.fulfill({ json: success({ items: applied ? [applied] : [], total: applied ? 1 : 0, page: 1, size: 20 }) })
  })
  await page.route(`${api}/refund-applications/301`, route => route.fulfill({ json: success(applied) }))
  await page.route(`${api}/refund-applications/301/evidence*`, route => route.fulfill({ json: success({ items: [], hasMore: false, nextCursor: null }) }))
  await panel.getByRole('button', { name: '申请普通退款', exact: true }).click()
  await panel.getByLabel('退款说明', { exact: true }).fill(application.description)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(panel.getByLabel('退款说明', { exact: true })).toHaveValue(application.description)
  await panel.getByRole('button', { name: '确认申请全额退款', exact: true }).click()
  await expect(panel.getByText('已精确核验原操作提交成功。')).toBeVisible()
  await expect(panel.getByRole('button', { name: '重试原售后操作' })).toHaveCount(0)
  expect(submissions).toBe(1)
})

async function adminModel(page: Page) {
  await prepare(page, true)
  const model = { application: { ...application, canSupplement: false, canWithdraw: false }, order: { ...snapshot, payment: { flowNo: 'PAY71', amount: '180.00', occurredAt: snapshot.paidAt }, progressNodes: [], settlement: { paidAmount: '180.00', status: 'PENDING' } }, history: [], canDecide: true, serverTime: snapshot.serverTime, decisionFacts: null as unknown }
  await page.route(`${api}/admin/refund-applications*`, route => route.fulfill({ json: success({ items: [{ ...application, title: snapshot.title, totalAmount: '180.00' }], total: 1, page: 1, size: 20 }) }))
  await page.route(`${api}/admin/refund-applications/301`, route => route.fulfill({ json: success(model) }))
  await page.route(`${api}/admin/refund-applications/301/evidence*`, route => route.fulfill({ json: success({ items: [], hasMore: false, nextCursor: null }) }))
  await page.route(`${api}/admin/refund-applications/301/messages*`, route => route.fulfill({ json: success({ items: [], hasMore: false }) }))
  await page.goto('/admin/refunds/301?status=WAIT_ADMIN&orderNo=CUSTOM&page=2')
  await expect(page.getByRole('heading', { name: '查证与裁定' })).toBeVisible()
  return model
}

test('管理员版本冲突保留意见且必须重新查阅确认后才使用新版本', async ({ page }) => {
  const model = await adminModel(page); const panel = page.getByRole('region', { name: '管理员退款裁定' }); page.on('dialog', dialog => dialog.accept())
  const versions: number[] = []
  await page.route(`${api}/admin/refund-applications/301/decision`, async route => {
    const input = route.request().postDataJSON(); versions.push(input.expectedVersion)
    if (versions.length === 1) { model.application.version = 1; await route.fulfill({ status: 409, json: { code: 409, message: '补证材料已变化，请重新查阅', data: null } }); return }
    model.application.status = 'REJECTED'; model.application.handlerId = '19'; model.application.decisionReason = input.reason; model.canDecide = false; model.decisionFacts = input
    await route.fulfill({ json: success(model) })
  })
  await panel.getByLabel('裁定原因').fill('现有证据不能支持退款，请继续按原方案履约。')
  await panel.getByRole('button', { name: '已重新查阅当前材料' }).click()
  await panel.getByRole('button', { name: '确认裁定', exact: true }).click()
  await expect(panel.getByRole('button', { name: '确认裁定', exact: true })).toBeDisabled()
  await expect(panel.getByLabel('裁定原因')).toHaveValue('现有证据不能支持退款，请继续按原方案履约。')
  await panel.getByRole('button', { name: '已重新查阅当前材料' }).click()
  await panel.getByRole('button', { name: '确认裁定', exact: true }).click()
  await expect(page.getByText('已驳回退款申请，原履约状态恢复。')).toBeVisible()
  expect(versions).toEqual([0, 1])
  await expect(page.getByLabel('按订单编号筛选')).toHaveValue('CUSTOM')
})

test('管理员未知裁定不能凭他人已退款结果宣称本次成功', async ({ page }) => {
  const model = await adminModel(page); const panel = page.getByRole('region', { name: '管理员退款裁定' }); page.on('dialog', dialog => dialog.accept())
  await page.route(`${api}/admin/refund-applications/301/decision`, async route => { model.application.status = 'REFUNDED'; model.application.handlerId = '29'; model.canDecide = false; model.decisionFacts = route.request().postDataJSON(); await route.abort() })
  await panel.getByLabel('裁定原因').fill('根据双方约定与留存证据决定退款。')
  await panel.getByLabel('裁定结果').selectOption('APPROVE')
  await panel.getByRole('button', { name: '已重新查阅当前材料' }).click()
  await panel.getByRole('button', { name: '确认裁定', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('不同处理结论')
  await expect(page.getByRole('button', { name: '重试原裁定' })).toBeDisabled()
  await expect(page.getByText('已精确核验原管理员及完整裁定参数，原裁定提交成功。')).toHaveCount(0)
  expect(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.includes('admin-attempt')))).toBe(true)
})

test('普通退款存储失败不发送请求并保留已填说明', async ({ page }) => {
  await prepare(page)
  const panel = page.getByRole('region', { name: '订单售后' })
  await panel.getByRole('button', { name: '申请普通退款', exact: true }).click()
  const description = '制作细节与原始约定存在差异，请管理员根据订单方案及阶段照片核查。'
  await panel.getByLabel('退款说明', { exact: true }).fill(description)
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'QuotaExceededError') } })
  let writes = 0
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/refund-applications')) writes++ })
  page.on('dialog', dialog => dialog.accept())
  await panel.getByRole('button', { name: '确认申请全额退款', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('存储')
  await expect(panel.getByLabel('退款说明', { exact: true })).toHaveValue(description)
  expect(writes).toBe(0)
})

test('管理员全部筛选发送合法ALL且迟到队列响应不覆盖新条件', async ({ page }) => {
  await adminModel(page)
  const requests: URL[] = []; let release = () => {}; let captured = () => {}; const gate = new Promise<void>(resolve => { release = resolve }); const seen = new Promise<void>(resolve => { captured = resolve })
  await page.route(`${api}/admin/refund-applications?*`, async route => {
    const url = new URL(route.request().url()); requests.push(url)
    if (url.searchParams.get('status') === 'ALL' && url.searchParams.get('applicationType') === 'NORMAL') { captured(); await gate; await route.fulfill({ json: success({ items: [{ ...application, id: '399', title: '迟到的旧条件申请', totalAmount: '180.00' }], total: 1, page: 1, size: 20 }) }); return }
    await route.fulfill({ json: success({ items: [], total: 0, page: 1, size: 20 }) })
  })
  try {
    await page.getByLabel('申请状态', { exact: true }).selectOption('')
    await page.getByRole('button', { name: '筛选申请', exact: true }).click(); await seen
    await page.getByLabel('申请类型', { exact: true }).selectOption('')
    await page.getByRole('button', { name: '筛选申请', exact: true }).click()
    await expect(page.getByText('当前条件下暂无售后申请')).toBeVisible()
    release(); await expect.poll(() => requests.some(url => url.searchParams.get('status') === 'ALL' && url.searchParams.get('applicationType') === 'ALL')).toBe(true)
    await expect(page.getByText('迟到的旧条件申请')).toHaveCount(0)
  } finally { release() }
})

test('管理员需退与免退切换仅提交当前分支且空运单规范为null', async ({ page }) => {
  const model = await adminModel(page); Object.assign(model.order, { shippedAt: snapshot.paidAt, trackingNo: 'ORIGINAL20261119' }); await page.getByRole('button', { name: '刷新查证材料' }).click()
  const panel = page.getByRole('region', { name: '管理员退款裁定' }); page.on('dialog', dialog => dialog.accept()); let sent: Record<string, unknown> | undefined
  await page.route(`${api}/admin/refund-applications/301/decision`, async route => { sent = route.request().postDataJSON(); model.application.status = 'REFUNDED'; model.canDecide = false; await route.fulfill({ json: success(model) }) })
  await panel.getByLabel('裁定结果').selectOption('APPROVE'); await panel.getByLabel('裁定原因').fill('依据双方说明批准原实付金额全额退款。')
  await panel.getByLabel('退货核查').selectOption('true'); await panel.getByLabel('已核实原成品确已退回').check(); await panel.getByLabel('退回运单号').fill('RETURN20261119001')
  await panel.getByLabel('退货核查').selectOption('false'); await panel.getByLabel('无需退货依据').fill('双方明确同意无需退回，已核实成品无法再提供。')
  await panel.getByRole('button', { name: '已重新查阅当前材料' }).click(); await panel.getByRole('button', { name: '确认裁定', exact: true }).click()
  await expect(page.getByText('全额退款裁定已执行，原支付和履约证据保留。')).toBeVisible()
  expect(sent).toMatchObject({ returnRequired: false, returnedConfirmed: false, returnTrackingNo: null, returnEvidenceImageIds: [], noReturnBasis: '双方明确同意无需退回，已核实成品无法再提供。' })
})

test('管理员四张已保存凭证的未知裁定刷新后完整恢复并复用原参数', async ({ page }) => {
  const model = await adminModel(page); Object.assign(model.order, { shippedAt: snapshot.paidAt, trackingNo: 'ORIGINAL20261119' })
  const original = { expectedVersion: 0, decision: 'APPROVE', reason: '已核实原成品退回，使用四份已保存材料共同确认。', returnRequired: true, returnedConfirmed: true, returnTrackingNo: '', returnEvidenceImageIds: ['501', '502', '503', '504'], noReturnBasis: '' }
  await page.evaluate(value => { sessionStorage.setItem('order-refund:19:admin-attempt:301', JSON.stringify(value)); sessionStorage.setItem('order-refund:19:admin-draft:301', JSON.stringify(value)) }, original)
  await page.reload()
  await expect(page.getByLabel('裁定原因')).toHaveValue(original.reason)
  await expect(page.getByLabel('裁定原因')).toBeDisabled()
  const retry = page.getByRole('button', { name: '重试原裁定' }); await expect(retry).toBeEnabled()
  let sent: Record<string, unknown> | undefined
  await page.route(`${api}/admin/refund-applications/301/decision`, async route => { sent = route.request().postDataJSON(); model.application.status = 'REFUNDED'; model.application.handlerId = '19'; model.decisionFacts = sent; model.canDecide = false; await route.fulfill({ json: success(model) }) })
  await retry.click(); await expect(page.getByText('全额退款裁定已执行，原支付和履约证据保留。')).toBeVisible()
  expect(sent).toMatchObject({ ...original, returnTrackingNo: null, noReturnBasis: null })
})

test('同账号管理员资格被撤销立即清理详情及待确认输入', async ({ page }) => {
  await adminModel(page)
  await page.getByLabel('裁定原因').fill('应在资格失效后清除的私人核查意见。')
  await page.route(`${api}/sessions/current`, route => route.fulfill({ json: success({ userId: '19', email: 'refund-test@qq.com', nickname: '售后管理员', roles: ['BUYER'], activeRole: 'BUYER', expiresAt: '2099-01-01T00:00:00+08:00' }) }))
  await page.evaluate(() => window.dispatchEvent(new Event('creator-certification-updated')))
  await expect(page.getByRole('region', { name: '售后初始申请' })).toHaveCount(0)
  await expect(page.getByLabel('裁定原因')).toHaveCount(0)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('order-refund:19:')))).toEqual([])
})

test('退款提交开始废弃旧订单GET且迟到快照不能恢复履约按钮', async ({ page }) => {
  await prepare(page)
  let release = () => {}; let captured = () => {}; const gate = new Promise<void>(resolve => { release = resolve }); const seen = new Promise<void>(resolve => { captured = resolve }); let hold = true; let created = false
  await page.route(`${api}/orders/71`, async route => { if (hold) { hold = false; captured(); await gate; await route.fulfill({ json: success(snapshot) }); return }; await route.fulfill({ json: success(created ? { ...snapshot, status: 'AFTER_SALE', canRequestRefund: false, currentRefund: application } : snapshot) }) })
  await page.route(`${api}/orders/71/refund-applications*`, async route => { if (route.request().method() === 'POST') { created = true; await route.fulfill({ status: 201, json: success(application) }); return }; await route.fulfill({ json: success({ items: created ? [application] : [], total: created ? 1 : 0, page: 1, size: 20 }) }) })
  await page.route(`${api}/refund-applications/301`, route => route.fulfill({ json: success(application) }))
  await page.route(`${api}/refund-applications/301/evidence*`, route => route.fulfill({ json: success({ items: [], hasMore: false, nextCursor: null }) }))
  const panel = page.getByRole('region', { name: '订单售后' }); page.on('dialog', dialog => dialog.accept())
  try {
    await panel.getByRole('button', { name: '申请普通退款', exact: true }).click(); await panel.getByLabel('退款说明', { exact: true }).fill(application.description)
    await page.getByRole('button', { name: '刷新订单', exact: true }).click(); await seen
    await panel.getByRole('button', { name: '确认申请全额退款', exact: true }).click()
    await expect(page.locator('.work-section-heading .work-status')).toHaveText('售后中')
    release(); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(page.locator('.work-section-heading .work-status')).toHaveText('售后中')
  } finally { release() }
})

test('管理员存储失败保留核验意见且不发送裁定', async ({ page }) => {
  await adminModel(page)
  const panel = page.getByRole('region', { name: '管理员退款裁定' }); let writes = 0; page.on('dialog', dialog => dialog.accept())
  page.on('request', request => { if (request.method() === 'PUT' && request.url().endsWith('/decision')) writes++ })
  await panel.getByLabel('裁定原因').fill('保留完整意见，浏览器存储不可用时不得提交裁定。'); await panel.getByRole('button', { name: '已重新查阅当前材料' }).click()
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'QuotaExceededError') } })
  await panel.getByRole('button', { name: '确认裁定', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('本次裁定未提交')
  await expect(panel.getByLabel('裁定原因')).toHaveValue('保留完整意见，浏览器存储不可用时不得提交裁定。'); expect(writes).toBe(0)
})

test('终态通知保留补证草稿并冻结编辑上传提交，仍可关闭或进入原会话', async ({ page }) => {
  await prepare(page)
  const current: RefundApplicationVO = { ...application }
  await page.route(`${api}/orders/71`, route => route.fulfill({ json: success({ ...snapshot, status: current.status === 'WAIT_ADMIN' ? 'AFTER_SALE' : 'REFUNDED', canRequestRefund: false, currentRefund: current.status === 'WAIT_ADMIN' ? current : null }) }))
  await page.route(`${api}/orders/71/refund-applications*`, route => route.fulfill({ json: success({ items: [current], total: 1, page: 1, size: 20 }) }))
  await page.route(`${api}/refund-applications/301`, route => route.fulfill({ json: success(current) }))
  await page.route(`${api}/refund-applications/301/evidence*`, route => route.fulfill({ json: success({ items: [], hasMore: false, nextCursor: null }) }))
  await page.evaluate(() => window.dispatchEvent(new Event('order-updated')))
  const panel = page.getByRole('region', { name: '订单售后' })
  await panel.getByRole('button', { name: '追加售后证据', exact: true }).click()
  const text = '尚未发送的补证草稿，申请终结后仍保留原内容供复制。'
  await panel.getByLabel('补充证据说明', { exact: true }).fill(text)
  Object.assign(current, { status: 'REFUNDED', canSupplement: false, canWithdraw: false, finishedAt: '2026-11-19T10:00:00+08:00', version: 1 })
  await page.evaluate(() => window.dispatchEvent(new Event('order-updated')))
  await expect(panel.getByText('本申请及证据已只读。后续沟通与补证使用原订单会话，不重开原申请期限。')).toBeVisible()
  await expect(panel.getByLabel('补充证据说明', { exact: true })).toHaveValue(text)
  await expect(panel.getByLabel('补充证据说明', { exact: true })).toBeDisabled()
  await expect(panel.getByLabel('售后凭证', { exact: true })).toBeDisabled()
  await expect(panel.getByRole('button', { name: '提交补充证据', exact: true })).toBeDisabled()
  await expect(panel.getByRole('link', { name: '进入原订单会话 ↗', exact: true })).toHaveAttribute('href', '/messages/conversations/101')
  await panel.getByRole('button', { name: '暂不提交', exact: true }).click()
  await expect(panel.getByLabel('补充证据说明', { exact: true })).toHaveCount(0)
})

test('补证未知结果刷新后复用原键原内容，响应丢失按提交者和原键精确恢复', async ({ page }) => {
  await prepare(page)
  const current: RefundApplicationVO = { ...application }
  const submissions: RefundEvidenceDTO[] = []; const queriedKeys: string[] = []; let applied: RefundEvidenceVO | undefined
  await page.route(`${api}/orders/71`, route => route.fulfill({ json: success({ ...snapshot, status: 'AFTER_SALE', canRequestRefund: false, currentRefund: current }) }))
  await page.route(`${api}/orders/71/refund-applications*`, route => route.fulfill({ json: success({ items: [current], total: 1, page: 1, size: 20 }) }))
  await page.route(`${api}/refund-applications/301`, route => route.fulfill({ json: success(current) }))
  await page.route(`${api}/refund-applications/301/evidence*`, async route => {
    if (route.request().method() === 'POST') {
      const input: RefundEvidenceDTO = route.request().postDataJSON(); submissions.push(input)
      // 首次请求未达；第二次已保存但响应丢失，页面只能核验原键与全部内容。
      if (submissions.length === 2) { applied = { id: '401', refundApplicationId: '301', submitterId: '11', ...input, createdAt: '2026-11-19T10:00:00+08:00' }; current.version++ }
      await route.abort(); return
    }
    const requestKey = new URL(route.request().url()).searchParams.get('requestKey')
    if (requestKey) queriedKeys.push(requestKey)
    await route.fulfill({ json: success({ items: applied && (!requestKey || requestKey === applied.requestKey) ? [applied] : [], hasMore: false, nextCursor: null }) })
  })
  await page.evaluate(() => window.dispatchEvent(new Event('order-updated')))
  const panel = page.getByRole('region', { name: '订单售后' })
  await panel.getByRole('button', { name: '追加售后证据', exact: true }).click()
  const content = '补充核对作品的实际尺寸及原方案，原始补证内容不可在重试时改变。'
  await panel.getByLabel('补充证据说明', { exact: true }).fill(content)
  await panel.getByRole('button', { name: '提交补充证据', exact: true }).click()
  await expect(panel.getByRole('button', { name: '重试原售后操作' })).toBeEnabled()
  await expect(panel.getByRole('button', { name: '撤回退款申请', exact: true })).toBeDisabled()
  await page.reload()
  await expect(panel.getByLabel('补充证据说明', { exact: true })).toHaveValue(content)
  await expect(panel.getByLabel('补充证据说明', { exact: true })).toBeDisabled()
  await expect(panel.getByRole('button', { name: '重试原售后操作' })).toBeEnabled()
  await panel.getByRole('button', { name: '重试原售后操作' }).click()
  await expect(panel.getByText('已精确核验原操作提交成功。')).toBeVisible()
  await expect(panel.getByText(content, { exact: true })).toBeVisible()
  expect(submissions).toHaveLength(2); expect(submissions[1]).toEqual(submissions[0]); expect(queriedKeys).toContain(submissions[0]!.requestKey)
  await expect(panel.getByRole('button', { name: '重试原售后操作' })).toHaveCount(0)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.includes(':attempt:')))).toEqual([])
})

test('撤回响应丢失且核验暂时失败时保留未知操作，刷新按原申请自然幂等恢复', async ({ page }) => {
  await prepare(page)
  const current: RefundApplicationVO = { ...application }; let canRead = true; let withdrawals = 0
  await page.route(`${api}/orders/71`, route => route.fulfill({ json: success({ ...snapshot, status: current.status === 'WITHDRAWN' ? 'IN_PRODUCTION' : 'AFTER_SALE', canRequestRefund: current.status === 'WITHDRAWN', currentRefund: current.status === 'WAIT_ADMIN' ? current : null }) }))
  await page.route(`${api}/orders/71/refund-applications*`, route => canRead ? route.fulfill({ json: success({ items: [current], total: 1, page: 1, size: 20 }) }) : route.fulfill({ status: 503, json: { code: 503, message: '暂时无法核验售后状态', data: null } }))
  await page.route(`${api}/refund-applications/301`, route => route.fulfill({ json: success(current) }))
  await page.route(`${api}/refund-applications/301/evidence*`, route => route.fulfill({ json: success({ items: [], hasMore: false, nextCursor: null }) }))
  await page.route(`${api}/refund-applications/301/withdrawal`, async route => {
    withdrawals++; canRead = false
    Object.assign(current, { status: 'WITHDRAWN', canSupplement: false, canWithdraw: false, finishedAt: '2026-11-19T10:00:00+08:00', version: 1 })
    await route.abort()
  })
  await page.evaluate(() => window.dispatchEvent(new Event('order-updated')))
  const panel = page.getByRole('region', { name: '订单售后' }); page.on('dialog', dialog => dialog.accept())
  await panel.getByRole('button', { name: '撤回退款申请', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('暂时无法核验售后状态')
  await expect(panel.getByRole('button', { name: '重试原售后操作' })).toBeDisabled()
  expect(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.includes(':attempt:')))).toBe(true)
  canRead = true; await page.reload()
  await expect(panel.getByText('已精确核验原操作提交成功。')).toBeVisible()
  await expect(page.locator('.work-section-heading .work-status')).toHaveText('制作中')
  await expect(panel.getByRole('button', { name: '申请普通退款', exact: true })).toBeEnabled()
  await expect(panel.getByRole('button', { name: '撤回退款申请', exact: true })).toHaveCount(0)
  expect(withdrawals).toBe(1)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.includes(':attempt:')))).toEqual([])
})


