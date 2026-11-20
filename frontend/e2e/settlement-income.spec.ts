import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { api, mutate, origin, prepareCreator, register } from './custom-request-support'

test.use({ storageMode: 'receiver', actionTimeout: 15_000 })

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

test('创作者收入记录与管理员资金记录展示结算快照', async ({ page, browser, mailbox }) => {
  test.setTimeout(240_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
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
    await expect(row.getByText(/结算时间/)).toHaveCount(1)
    await expect(row.getByText('—')).toBeVisible()
    // 订单号过滤未实现，收入页按状态筛选；取消与已结算筛选下为空。
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
    // 非管理员访问资金记录被路由守卫送回首页。
    await creator.goto('/admin/settlements')
    await expect(creator).toHaveURL(origin + '/')
    // 扫描同款结算落地后，收入页与订单详情展示已结算与结算时间。
    await mailbox.markSettled(order.id)
    await mailbox.expireFulfillmentBoundary(order.id, 'FORCE_COMPLETE')
    await creator.goto('/creator/income')
    await creator.getByLabel('结算状态', { exact: true }).selectOption('SETTLED')
    await expect(creator.locator('.income-row').filter({ hasText: order.title })).toContainText('已结算')
    await expect(creator.locator('.income-row').filter({ hasText: order.title }).getByText('—')).toHaveCount(0)
    await creator.goto(`/orders/${order.id}`)
    await expect(creator.getByRole('heading', { name: '结算信息', exact: true })).toBeVisible()
    await expect(creator.locator('.work-specifications').filter({ hasText: '应结算金额' })).toContainText('已结算')
    const settledDetail = (await (await creator.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(settledDetail.settlement.status).toBe('SETTLED')
    expect(settledDetail.settlement.settledAt).toBeTruthy()
  } finally {
    await adminContext.close()
    await creatorContext.close()
  }
})
