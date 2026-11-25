import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { api, mutate, origin, prepareCreator, register } from './custom-request-support'
import { refundOrder } from './refund-support'

test.use({ storageMode: 'receiver', actionTimeout: 15_000, viewport: { width: 1366, height: 900 } })

/** 使用真实报价、定标及固定地址准备待付款订单，不绕过业务建单。 */
async function pendingOrder(buyer: Page, creator: Page, categoryId: string, title: string) {
  const content = { title, categoryId, purpose: '生日礼物', materialPreference: '天然原木', specification: '十二厘米', budgetMin: '100.00', budgetMax: '300.00', expectedShipDate: new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10), description: '希望制作一枚保留自然木纹的书签，边角圆润并刻上名字，在制作前确认字体和位置，作为生日纪念。', referenceImageIds: [], visibility: 'PUBLIC', invitedCreatorId: null, sourceWorkId: null }
  const draftResponse = await mutate(buyer, '/me/custom-requests', { ...content, requestKey: randomUUID() })
  expect(draftResponse.status()).toBe(201)
  const draft = (await draftResponse.json()).data
  expect((await mutate(buyer, `/me/custom-requests/${draft.id}/publication`, { ...content, version: draft.version }, 'put')).status()).toBe(200)
  const quoteResponse = await mutate(creator, `/custom-requests/${draft.id}/quotes`, { requestKey: randomUUID(), goodsAmount: '180.00', durationDays: 10, proposal: '选用天然胡桃木，细致打磨并使用环保木蜡油，保留自然纹理，制作前提供草图确认尺寸和姓名刻印。', additionalAgreement: '雕刻前可修改一次字体', imageIds: [] })
  expect(quoteResponse.status()).toBe(201)
  const quote = (await quoteResponse.json()).data
  const addressResponse = await mutate(buyer, '/me/addresses', { recipientName: '收入验收收件人', phone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', detailAddress: '收入快照测试路一号', isDefault: true })
  expect(addressResponse.status()).toBe(201)
  const response = await mutate(buyer, `/custom-requests/${draft.id}/award`, { requestKey: randomUUID(), quoteId: quote.id, addressId: (await addressResponse.json()).data.id, confirmedEstimatedShipDate: quote.estimatedShipDate }, 'put')
  expect(response.status()).toBe(201)
  return (await response.json()).data
}

/** 通过真实界面完成模拟支付，不直接调用支付接口。 */
async function payOrder(buyer: Page, orderId: string) {
  await buyer.goto(`/orders/${orderId}`)
  await buyer.getByRole('button', { name: '模拟支付', exact: true }).click()
  await buyer.getByLabel('我已阅读并同意定制支付条款', { exact: true }).check()
  await buyer.getByRole('button', { name: '确认模拟支付', exact: true }).click()
  await expect(buyer.locator('.work-section-heading .work-status')).toHaveText('待开工')
}

test('创作者与管理员按角色查询待结算、已结算与退款取消记录', async ({ page, browser, mailbox }) => {
  test.setTimeout(240_000)
  const adminContext = await browser.newContext({ baseURL: origin, viewport: { width: 1366, height: 900 } })
  const creatorContext = await browser.newContext({ baseURL: origin, viewport: { width: 1366, height: 900 } })
  try {
    const creator = await creatorContext.newPage()
    const admin = await adminContext.newPage()
    const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '收入买家')
    const order = await pendingOrder(page, creator, categoryId, '模拟结算收入验收')
    await payOrder(page, order.id)
    // 支付成功即生成待结算记录，创作者收入页与管理员资金记录均应展示。
    await creator.goto('/creator/income')
    const row = creator.locator('.income-row').filter({ hasText: order.title })
    await expect(row).toContainText('待结算')
    await expect(row).toContainText('¥ 180.00')
    await expect(row).toContainText('****')
    await expect(row).not.toContainText('13800138000')
    await expect(creator.getByRole('columnheader', { name: '模拟结算时间' })).toBeVisible()
    await expect(row.getByRole('cell', { name: '—', exact: true })).toBeVisible()
    // 创作者收入页按照已保存状态查询。
    await creator.getByLabel('结算状态', { exact: true }).selectOption('SETTLED')
    await expect(creator.getByRole('heading', { name: '暂无收入记录' })).toBeVisible()
    await creator.getByLabel('结算状态', { exact: true }).selectOption('')
    // 管理员资金记录含已审核收款资料明文，仅管理员可达。
    await admin.goto('/admin/settlements')
    const adminRow = admin.locator('.settlement-row').filter({ hasText: order.title })
    await expect(adminRow).toContainText('待结算')
    await expect(adminRow).toContainText('测试手艺')
    await expect(adminRow).toContainText('13800138000')
    await admin.getByLabel('结算状态', { exact: true }).selectOption('PENDING')
    await expect(adminRow).toBeVisible()
    await admin.getByRole('textbox', { name: '订单号', exact: true }).fill(order.orderNo)
    await admin.getByLabel('实付金额从').fill('0')
    await admin.getByLabel('实付金额至').fill('0')
    await admin.getByRole('button', { name: '查询', exact: true }).click()
    await expect(admin.getByRole('heading', { name: '暂无资金记录' })).toBeVisible()
    await admin.getByLabel('实付金额至').fill('')
    await admin.getByRole('button', { name: '查询', exact: true }).click()
    await expect(admin).toHaveURL(new RegExp('[?&]orderNo=' + order.orderNo + '(?:&|$)'))
    await adminRow.getByRole('link', { name: order.title }).click()
    await expect(admin).toHaveURL(new RegExp('/admin/orders\\?orderId=' + order.id + '(?:&|$)'))
    await expect(admin.getByRole('heading', { name: '订单详情 · ' + order.orderNo })).toBeVisible()
    await admin.getByRole('link', { name: '返回资金记录' }).click()
    await expect(admin.getByRole('textbox', { name: '订单号', exact: true })).toHaveValue(order.orderNo)
    await expect(admin.getByLabel('实付金额从')).toHaveValue('0')
    await expect(admin.getByLabel('结算状态', { exact: true })).toHaveValue('PENDING')
    await expect(adminRow).toBeVisible()
    await admin.goto('/admin/orders')
    await admin.getByRole('spinbutton', { name: '金额至', exact: true }).fill('0')
    await admin.getByRole('button', { name: '查询订单' }).click()
    await expect(admin.getByRole('heading', { name: '没有匹配订单' })).toBeVisible()
    await admin.goBack()
    await expect(adminRow).toBeVisible()
    // 非管理员访问资金记录被路由守卫送回首页。
    await creator.goto('/admin/settlements')
    await expect(creator).toHaveURL(origin + '/')
    await creator.goto('/admin/orders?orderId=' + order.id)
    await expect(creator).toHaveURL(origin + '/')
    expect((await creator.request.get(`${api}/admin/orders/${order.id}`)).status()).toBe(403)
    await expect(page.getByRole('heading', { name: '结算信息', exact: true })).toHaveCount(0)
    expect((await (await page.request.get(`${api}/orders/${order.id}`)).json()).data.settlement).toBeNull()

    // 由真实普通售后裁定取消待结算，保留双方核对所需原金额。
    const application = await mutate(page, `/orders/${order.id}/refund-applications`, {
      requestKey: randomUUID(), reasonCode: 'OTHER', description: '本次完成前买家申请全额退款，申请说明用于核对结算取消记录。', imageIds: [],
    })
    expect(application.status()).toBe(201)
    const refund = (await application.json()).data
    const decision = await mutate(admin, `/admin/refund-applications/${refund.id}/decision`, {
      expectedVersion: refund.version, decision: 'APPROVE', reason: '确认未发货并批准全额退款',
      returnRequired: false, returnedConfirmed: false, returnTrackingNo: null, returnEvidenceImageIds: [], noReturnBasis: null,
    }, 'put')
    expect(decision.status()).toBe(200)
    await creator.goto('/creator/income')
    await creator.getByLabel('结算状态', { exact: true }).selectOption('CANCELLED')
    await expect(row).toContainText('已取消')
    await expect(row).toContainText('¥ 180.00')
    await expect(row.getByRole('cell', { name: '—', exact: true })).toBeVisible()
    await admin.getByLabel('结算状态', { exact: true }).selectOption('CANCELLED')
    await expect(adminRow).toContainText('已取消')
    await expect(adminRow).toContainText('¥ 180.00')
    await expect(adminRow.getByRole('cell', { name: '—', exact: true })).toHaveCount(1)
    const refundedOrder = (await (await admin.request.get(`${api}/admin/orders/${order.id}`)).json()).data
    expect(refundedOrder.fundFlows).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'REFUND', amount: '180.00' })]))
    expect(refundedOrder.fundFlows.some((flow: { type: string }) => flow.type === 'SETTLEMENT')).toBe(false)

    // 真实发货及收货后只调整隔离库的原完成时间，等待 Spring 定时任务结算。
    const fulfilled = await refundOrder(page, creator, categoryId, '满七天后模拟结算')
    const receipt = await mutate(page, `/orders/${fulfilled.id}/receipt`, undefined, 'put')
    expect(receipt.status()).toBe(201)
    expect((await receipt.json()).data.status).toBe('COMPLETED')
    const getFulfilled = async () => (await (await creator.request.get(`${api}/orders/${fulfilled.id}`)).json()).data
    expect((await getFulfilled()).settlement.status).toBe('PENDING')
    await mailbox.expireFulfillmentBoundary(fulfilled.id, 'COMPLETION')
    await expect.poll(async () => (await getFulfilled()).settlement.status, { timeout: 90_000, intervals: [1000] }).toBe('SETTLED')
    await creator.goto('/creator/income')
    await creator.getByLabel('结算状态', { exact: true }).selectOption('SETTLED')
    const settledRow = creator.locator('.income-row').filter({ hasText: fulfilled.title })
    await expect(settledRow).toContainText('已结算')
    await expect(settledRow.getByRole('cell', { name: '—', exact: true })).toHaveCount(0)
    await admin.goto('/admin/settlements?status=SETTLED')
    await expect(admin.locator('.settlement-row').filter({ hasText: fulfilled.title })).toContainText('已结算')
    await settledRow.getByRole('link', { name: fulfilled.title }).click()
    await expect(creator.getByRole('heading', { name: '结算信息', exact: true })).toBeVisible()
    await expect(creator.locator('.work-specifications').filter({ hasText: '应结算金额' })).toContainText('已结算')
    const settledDetail = await getFulfilled()
    expect(settledDetail.settlement.status).toBe('SETTLED')
    expect(settledDetail.settlement.settledAt).toBeTruthy()
    const fundedOrder = (await (await admin.request.get(`${api}/admin/orders/${fulfilled.id}`)).json()).data
    expect(fundedOrder.fundFlows.filter((flow: { type: string }) => flow.type === 'SETTLEMENT')).toEqual([expect.objectContaining({ amount: '180.00' })])
  } finally {
    await adminContext.close()
    await creatorContext.close()
  }
})
