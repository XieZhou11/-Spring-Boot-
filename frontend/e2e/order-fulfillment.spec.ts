import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { api, image, mutate, origin, prepareCreator, register } from './custom-request-support'

test.use({ storageMode: 'receiver', actionTimeout: 15_000 })

/** 订单详情的状态由左侧选中卡片展示。 */
const selectedStatus = (page: Page) => page.locator('.craftflow-order-item a[aria-current="page"] [data-status]')

/** 从真实需求、报价、地址和付款准备履约，不能直接插入已付款状态掩盖调用链问题。 */
async function paidOrder(buyer: Page, creator: Page, categoryId: string, title: string) {
  const fields = { title, categoryId, purpose: '生日纪念', materialPreference: '天然原木', specification: '长十二厘米', budgetMin: '100.00', budgetMax: '300.00', expectedShipDate: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), description: '定制一枚保留原木纹理的书签，边缘圆润并刻上名字，制作前确认字体和位置，作为朋友的生日纪念。', referenceImageIds: [], visibility: 'PUBLIC', invitedCreatorId: null, sourceWorkId: null }
  const draftResponse = await mutate(buyer, '/me/custom-requests', { ...fields, requestKey: randomUUID() })
  expect(draftResponse.status()).toBe(201)
  const draft = (await draftResponse.json()).data
  expect((await mutate(buyer, `/me/custom-requests/${draft.id}/publication`, { ...fields, version: draft.version }, 'put')).status()).toBe(200)
  const quoteResponse = await mutate(creator, `/custom-requests/${draft.id}/quotes`, { requestKey: randomUUID(), goodsAmount: '180.00', durationDays: 10, proposal: '选用天然胡桃木，手工锯切与细磨，表面涂木蜡油，雕刻前确认字体和名字位置并保留过程照片。', additionalAgreement: '', imageIds: [] })
  expect(quoteResponse.status()).toBe(201)
  const quote = (await quoteResponse.json()).data
  const address = await mutate(buyer, '/me/addresses', { recipientName: '履约测试收件人', phone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', detailAddress: '履约快照测试路一号', isDefault: true })
  expect(address.status()).toBe(201)
  const award = await mutate(buyer, `/custom-requests/${draft.id}/award`, { requestKey: randomUUID(), quoteId: quote.id, addressId: (await address.json()).data.id, confirmedEstimatedShipDate: quote.estimatedShipDate }, 'put')
  expect(award.status()).toBe(201)
  const pending = (await award.json()).data
  const confirmation = pending.paymentPreview
  const payment = await mutate(buyer, `/orders/${pending.id}/payment`, { termsConfirmed: true, termsVersion: confirmation.termsVersion, confirmedShipDate: confirmation.shipDate }, 'put')
  expect(payment.status()).toBe(201)
  return (await payment.json()).data
}

/** 捕获付款后没有开工入口、双方状态不刷新或创作者越权读取待开工地址的问题。 */
test('已付款订单由本单创作者确认开工，双方读取解锁节点及固定计划', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  let releaseOld = () => {}
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '履约买家')
    const order = await paidOrder(page, creator, categoryId, '完整制作履约验收')
    await page.goto(`/orders/${order.id}`)
    await creator.goto(`/orders/${order.id}`)
    const creatorSecond = await creatorContext.newPage()
    await creatorSecond.goto(`/orders/${order.id}`)
    await expect(page.getByRole('button', { name: '确认开工', exact: true })).toHaveCount(0)
    await expect(creator.getByRole('link', { name: '收货地址快照', exact: true })).toHaveCount(0)
    expect((await (await creator.request.get(`${api}/orders/${order.id}`)).json()).data.addressSnapshot).toBeNull()
    const start = creator.getByRole('button', { name: '确认开工', exact: true })
    await expect(start).toBeVisible()
    let captured = () => {}; const oldCaptured = new Promise<void>(resolve => { captured = resolve })
    const oldGate = new Promise<void>(resolve => { releaseOld = resolve }); let hold = true
    await creator.route(`**/api/orders/${order.id}`, async route => {
      if (!hold) { await route.continue(); return }
      hold = false; const response = await route.fetch(); expect((await response.json()).data.status).toBe('PAID')
      captured(); await oldGate; await route.fulfill({ response })
    })
    await creator.evaluate(() => window.dispatchEvent(new Event('order-updated')))
    await oldCaptured
    await start.click()
    await expect(selectedStatus(creator)).toHaveText('制作中')
    await expect(selectedStatus(page)).toHaveText('制作中')
    await expect(selectedStatus(creatorSecond)).toHaveText('制作中')
    const returned = creator.waitForResponse(response => response.url().endsWith(`/api/orders/${order.id}`))
    releaseOld(); await returned
    await creator.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(selectedStatus(creator)).toHaveText('制作中')
    await expect(start).toHaveCount(0)
    await expect(creator.locator('.order-progress > li[data-node-code="MATERIAL"]').getByRole('button', { name: '提交打卡', exact: true })).toBeVisible()
    const latest = (await (await page.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(latest.startedAt).toBeTruthy()
    expect(latest.progressNodes[0].status).toBe('UNLOCKED')
    expect(latest.progressNodes.slice(1).every((node: { status: string }) => node.status === 'NOT_STARTED')).toBe(true)
    expect(latest.progressNodes.map((node: { plannedFinishDate: string }) => node.plannedFinishDate)).toEqual(order.progressNodes.map((node: { plannedFinishDate: string }) => node.plannedFinishDate))
  } finally {
    releaseOld()
    await adminContext.close()
    await creatorContext.close()
  }
})

/** 通过真实上传和API预置当前阶段，供恢复、权限及时间边界用例聚焦各自行为。 */
async function progressImage(creator: Page, orderId: string) {
  const csrf = (await (await creator.request.get(`${api}/csrf`)).json()).data
  const response = await creator.request.post(`${api}/orders/${orderId}/progress-images`, { headers: { [csrf.headerName]: csrf.token }, multipart: { file: { name: 'stage.png', mimeType: 'image/png', buffer: image } } })
  expect(response.status()).toBe(201)
  return (await response.json()).data.id as string
}

async function startedOrder(buyer: Page, creator: Page, categoryId: string, title: string) {
  const order = await paidOrder(buyer, creator, categoryId, title)
  const response = await mutate(creator, `/orders/${order.id}/production-start`, undefined, 'put')
  expect(response.status()).toBe(201)
  return (await response.json()).data
}

async function shippedOrder(buyer: Page, creator: Page, categoryId: string, title: string) {
  const order = await startedOrder(buyer, creator, categoryId, title)
  const fileId = await progressImage(creator, order.id)
  for (const node of order.progressNodes.slice(0, 4)) {
    const response = await mutate(creator, `/orders/${order.id}/progress-nodes/${node.id}/check-in`, { requestKey: randomUUID(), content: '当前阶段制作完成，已核对原始约定。', imageIds: [fileId] }, 'put')
    expect(response.status()).toBe(201)
  }
  const response = await mutate(creator, `/orders/${order.id}/shipment`, { requestKey: randomUUID(), content: '包装与保护完成，已交付承运并保留凭证。', imageIds: [fileId], trackingNo: 'CRAFT20261119001' }, 'put')
  expect(response.status()).toBe(201)
  return (await response.json()).data
}

/** 捕获顺序推进、补充覆盖、第五节点部分提交、更正重置倒计时和终态继续打卡。 */
test('五节点图文制作、跳过打样、补充、发货更正到买家收货完整履约', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(240_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '全程履约买家')
    await adminContext.close()
    const order = await paidOrder(page, creator, categoryId, '木纹书签五节点完整履约')
    let firstImageUrl = ''; let firstImageReads = 0
    await page.route('**/api/order-progress-images/*', async route => {
      const response = await route.fetch()
      if (!firstImageUrl) firstImageUrl = route.request().url()
      if (route.request().url() === firstImageUrl) {
        firstImageReads++
        if (firstImageReads === 1) { const body = await response.json(); body.data.expiresAt = new Date(Date.now() + 20_000).toISOString(); await route.fulfill({ response, json: body }); return }
      }
      await route.fulfill({ response })
    })
    await page.goto(`/orders/${order.id}`)
    await creator.goto(`/orders/${order.id}`)
    await creator.getByRole('button', { name: '确认开工', exact: true }).click()
    const material = creator.locator('.order-progress > li[data-node-code="MATERIAL"]')
    await material.getByRole('button', { name: '提交打卡', exact: true }).click()
    const checkin = creator.getByRole('form', { name: '提交打卡', exact: true })
    await checkin.getByLabel('阶段说明', { exact: true }).fill('原木选材与裁切完成，尺寸符合原始方案。')
    await checkin.getByRole('button', { name: '提交打卡', exact: true }).click()
    await expect(checkin.getByRole('alert')).toContainText('1—6张阶段实拍图')
    await expect(material.locator('.progress-record')).toHaveCount(0)
    await checkin.getByLabel('阶段实拍图', { exact: true }).setInputFiles({ name: 'material.png', mimeType: 'image/png', buffer: image })
    await expect(checkin.getByRole('button', { name: '提交打卡', exact: true })).toBeEnabled()
    await checkin.getByRole('button', { name: '提交打卡', exact: true }).click()
    await expect(material).toContainText('原木选材与裁切完成')
    await material.getByRole('button', { name: '追加补充', exact: true }).click()
    const supplement = creator.getByRole('form', { name: '追加补充', exact: true })
    await supplement.getByLabel('补充说明', { exact: true }).fill('补充说明：木纹已与买家沟通确认。')
    await supplement.getByRole('button', { name: '追加补充', exact: true }).click()
    await expect(material).toContainText('补充说明：木纹已与买家沟通确认。')
    await expect(material).toContainText('原木选材与裁切完成')
    await material.getByRole('button', { name: '追加补充', exact: true }).click()
    await supplement.getByLabel('阶段实拍图', { exact: true }).setInputFiles({ name: 'supplement-only.png', mimeType: 'image/png', buffer: image })
    await expect(supplement.getByRole('button', { name: '追加补充', exact: true })).toBeEnabled()
    await supplement.getByRole('button', { name: '追加补充', exact: true }).click()
    await expect(material.locator('.progress-record')).toHaveCount(3)
    const buyerMaterial = page.locator('.order-progress > li[data-node-code="MATERIAL"]')
    await expect(buyerMaterial.locator('.progress-record')).toHaveCount(3)
    await expect.poll(() => firstImageReads, { timeout: 12_000 }).toBeGreaterThanOrEqual(2)
    await buyerMaterial.getByRole('button', { name: '放大备料阶段图片 1', exact: true }).first().click()
    await expect(page.getByRole('dialog').getByRole('img', { name: '备料阶段图片大图', exact: true })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: '关闭大图', exact: true }).click()
    const sample = creator.locator('.order-progress > li[data-node-code="SAMPLE"]')
    await sample.getByRole('button', { name: '跳过打样', exact: true }).click()
    const skip = creator.getByRole('form', { name: '跳过打样', exact: true })
    await skip.getByLabel('跳过原因', { exact: true }).fill('沿用已确认版型')
    await skip.getByLabel('跳过说明', { exact: true }).fill('买家已经确认现有尺寸与字体，无需另做打样。')
    await skip.getByRole('button', { name: '跳过打样', exact: true }).click()
    await expect(sample).toContainText('已跳过')
    for (const code of ['MAKING', 'QC']) {
      const node = creator.locator(`.order-progress > li[data-node-code="${code}"]`)
      await node.getByRole('button', { name: '提交打卡', exact: true }).click()
      const form = creator.getByRole('form', { name: '提交打卡', exact: true })
      await form.getByLabel('阶段说明', { exact: true }).fill(code === 'MAKING' ? '主体制作与雕刻完成，细磨表面并确认名字。' : '核对尺寸、外观、字体和边角，质检完成。')
      await form.getByLabel('阶段实拍图', { exact: true }).setInputFiles({ name: `${code}.png`, mimeType: 'image/png', buffer: image })
      await expect(form.getByRole('button', { name: '提交打卡', exact: true })).toBeEnabled()
      await form.getByRole('button', { name: '提交打卡', exact: true }).click()
      await expect(node).toContainText('已打卡')
    }
    await expect(selectedStatus(creator)).toHaveText('待发货')
    await creator.getByRole('link', { name: '收货地址快照', exact: true }).click()
    await expect(creator).toHaveURL(`/orders/${order.id}/details/address`)
    await expect(creator.getByText('履约快照测试路一号', { exact: false })).toBeVisible()
    await creator.getByRole('button', { name: '返回订单', exact: true }).click()
    await expect(creator).toHaveURL(`/orders/${order.id}`)
    const shipping = creator.locator('.order-progress > li[data-node-code="SHIPPING"]')
    await shipping.getByRole('button', { name: '包装并发货', exact: true }).click()
    const shipment = creator.getByRole('form', { name: '确认发货', exact: true })
    await shipment.getByLabel('阶段说明', { exact: true }).fill('完成防撞包装并拍照，已核对收货地址。')
    await shipment.getByLabel('运单号', { exact: true }).fill('CRAFT20261119002')
    await shipment.getByRole('button', { name: '确认发货', exact: true }).click()
    await expect(shipment.getByRole('alert')).toContainText('1—6张阶段实拍图')
    await expect(selectedStatus(creator)).toHaveText('待发货')
    await shipment.getByLabel('阶段实拍图', { exact: true }).setInputFiles({ name: 'shipping.png', mimeType: 'image/png', buffer: image })
    await expect(shipment.getByRole('button', { name: '确认发货', exact: true })).toBeEnabled()
    await shipment.getByRole('button', { name: '确认发货', exact: true }).click()
    await expect(selectedStatus(creator)).toHaveText('已发货')
    await expect(selectedStatus(page)).toHaveText('已发货')
    await expect(page.getByRole('timer', { name: '自动确认收货倒计时', exact: true })).toContainText('剩余')
    const beforeCorrection = (await (await page.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(beforeCorrection.progressNodes.every((node: { status: string }) => ['CHECKED', 'SKIPPED'].includes(node.status))).toBe(true)
    await creator.getByRole('button', { name: '更正运单号', exact: true }).click()
    const correction = creator.getByRole('form', { name: '更正运单号', exact: true })
    await correction.getByLabel('运单号', { exact: true }).fill('CRAFT20261119003')
    await correction.getByRole('button', { name: '更正运单号', exact: true }).click()
    await expect(page.getByText('CRAFT20261119003', { exact: true }).first()).toBeVisible()
    const corrected = (await (await page.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(corrected.shippedAt).toBe(beforeCorrection.shippedAt)
    expect(corrected.autoConfirmAt).toBe(beforeCorrection.autoConfirmAt)
    expect(corrected.trackingHistory).toHaveLength(1)
    await creator.setViewportSize({ width: 1366, height: 1000 })
    expect(await creator.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    // 分屏检查长时间轴，避免低内存环境一次生成超长截图耗尽浏览器绘图资源。
    await creator.evaluate(() => window.scrollTo(0, 0))
    await creator.screenshot({ path: testInfo.outputPath('shipped-order-overview.png') })
    await creator.locator('.fulfillment-panel').evaluate(element => element.scrollIntoView({ block: 'start' }))
    await creator.screenshot({ path: testInfo.outputPath('shipped-fulfillment.png') })
    await creator.locator('.shipment-information').evaluate(element => element.scrollIntoView({ block: 'start' }))
    await creator.screenshot({ path: testInfo.outputPath('shipped-logistics.png') })
    await page.getByRole('button', { name: '确认收货', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确认收货', exact: true }).click()
    await expect(selectedStatus(page)).toHaveText('已完成')
    await expect(selectedStatus(creator)).toHaveText('已完成')
    await expect(creator.getByRole('button', { name: /提交打卡|追加补充|包装并发货|更正运单号/ })).toHaveCount(0)
    const completed = (await (await page.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(completed.originalCompletedAt).toBeTruthy()
    const request = (await (await page.request.get(`${api}/custom-requests/${order.requestId}`)).json()).data
    expect(request.status).toBe('IN_TRADE')
    await page.getByRole('link', { name: '进入订单沟通', exact: true }).click()
    await page.getByLabel('沟通内容', { exact: true }).fill('收到作品，补充保留此次交付确认。')
    const orderLink = page.getByRole('region', { name: '关联订单信息' }).getByRole('link', { name: '查看订单', exact: true })
    await expect(orderLink).toHaveAttribute('href', `/orders/${order.id}`)
    await orderLink.click()
    await page.getByRole('dialog', { name: '离开会话？' }).getByRole('button', { name: '确认离开', exact: true }).click()
    await page.locator('.order-progress > li[data-node-code="SHIPPING"]').getByRole('link', { name: '讨论此进度 ↗', exact: true }).click()
    await expect(page.getByLabel('沟通内容', { exact: true })).toHaveValue('收到作品，补充保留此次交付确认。')
    await expect(page.getByRole('button', { name: '移除引用', exact: true })).toBeVisible()
    const photoSent = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/conversations/${order.conversationId}/messages`))
    await page.getByLabel('消息图片', { exact: true }).setInputFiles({ name: 'delivery.png', mimeType: 'image/png', buffer: image })
    const photoResponse = await photoSent
    expect(photoResponse.status()).toBe(201)
    expect((await photoResponse.json()).data).toMatchObject({ content: null, referencedNodeId: null, imageIds: [expect.any(String)] })
    await expect(page.getByRole('log').getByRole('img', { name: '消息图片 1', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '移除引用', exact: true })).toBeVisible()
    await expect(page.getByLabel('沟通内容', { exact: true })).toHaveValue('收到作品，补充保留此次交付确认。')
    const sent = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/conversations/${order.conversationId}/messages`))
    await page.getByRole('button', { name: '发送', exact: true }).click()
    const chatResponse = await sent
    expect(chatResponse.status()).toBe(201)
    expect((await chatResponse.json()).data.referencedNodeId).toBe(completed.progressNodes[4].id)
    const progressReference = page.getByRole('link', { name: /^引用进度：包装发货/ })
    await expect(progressReference).toBeVisible()
    await progressReference.click()
    await expect(page).toHaveURL(`/orders/${order.id}#progress-${completed.progressNodes[4].id}`)
    await expect(page.locator('.order-progress > li[data-node-code="SHIPPING"]')).toBeInViewport()
  } finally { await adminContext.close(); await creatorContext.close() }
})

/** 退款入口须按服务器满48小时资格开放，退款成功仍保留订单会话及固定计划。 */
test('满48小时未开工申请无责全额退款，取消待结算且会话可继续', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '未开工退款买家')
    const order = await paidOrder(page, creator, categoryId, '等待开工无责退款验收')
    await page.goto(`/orders/${order.id}`)
    await expect(page.getByRole('button', { name: '申请未开工全额退款', exact: true })).toHaveCount(0)
    await mailbox.expireFulfillmentBoundary(order.id, 'NO_START')
    await page.reload()
    await creator.goto(`/orders/${order.id}`)
    await page.getByRole('button', { name: '申请未开工全额退款', exact: true }).click()
    const form = page.getByRole('form', { name: '申请未开工全额退款', exact: true })
    await form.getByLabel('退款说明', { exact: true }).fill('支付已经超过四十八小时仍未确认开工，申请按平台规则全额退款。')
    await form.getByLabel('退款凭证', { exact: true }).setInputFiles({ name: 'refund.png', mimeType: 'image/png', buffer: image })
    let failReads = false
    await page.route(`**/api/orders/${order.id}`, async route => { if (failReads) await route.abort('failed'); else await route.continue() })
    await page.route(`**/api/orders/${order.id}/no-start-refund`, async route => {
      const response = await route.fetch(); expect(response.status()).toBe(201); failReads = true; await route.abort('failed')
    })
    await expect(form.getByRole('button', { name: '申请未开工全额退款', exact: true })).toBeEnabled()
    await form.getByRole('button', { name: '申请未开工全额退款', exact: true }).click()
    const refundConfirmation = page.getByRole('dialog', { name: '确认无责退款？' })
    await expect(refundConfirmation).toContainText('180.00')
    await refundConfirmation.getByRole('button', { name: '确认退款', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: '退款结果尚未确认' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: '重试确认操作结果', exact: true })).toBeDisabled()
    failReads = false
    await page.getByRole('button', { name: '刷新订单', exact: true }).first().click()
    await expect(selectedStatus(page)).toHaveText('已退款')
    await expect(selectedStatus(creator)).toHaveText('已退款')
    await expect(creator.getByRole('button', { name: '确认开工', exact: true })).toHaveCount(0)
    const refunded = (await (await creator.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(refunded.noStartRefund.amount).toBe('180.00')
    expect(refunded.noStartRefund.flowNo).toBeTruthy()
    expect(refunded.settlement.status).toBe('CANCELLED')
    expect(refunded.progressNodes.map((node: { plannedFinishDate: string }) => node.plannedFinishDate)).toEqual(order.progressNodes.map((node: { plannedFinishDate: string }) => node.plannedFinishDate))
    expect((await (await page.request.get(`${api}/custom-requests/${order.requestId}`)).json()).data.status).toBe('CLOSED')
    expect((await mutate(page, `/conversations/${order.conversationId}/messages`, { clientMessageKey: randomUUID(), content: '保留退款后沟通，感谢理解。', imageIds: [] })).status()).toBe(201)
  } finally { await adminContext.close(); await creatorContext.close() }
})

/** 丢失真实成功响应与请求未到达是两种结果，必须保留同一输入并分别核验。 */
test('补充未知结果刷新恢复，存储失败不发送，原请求重试不重复记录', async ({ page, browser, mailbox }) => {
  test.setTimeout(240_000)
  const adminContext = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '补充恢复买家')
    const order = await startedOrder(page, creator, categoryId, '制作补充异常恢复验收')
    const node = order.progressNodes[0]; const fileId = await progressImage(creator, order.id)
    expect((await mutate(creator, `/orders/${order.id}/progress-nodes/${node.id}/check-in`, { requestKey: randomUUID(), content: '材料裁切完成并核对初始尺寸。', imageIds: [fileId] }, 'put')).status()).toBe(201)
    await adminContext.close()
    await creator.goto(`/orders/${order.id}`)
    await creator.locator('.order-progress > li[data-node-code="MATERIAL"]').getByRole('button', { name: '追加补充', exact: true }).click()
    const form = creator.getByRole('form', { name: '追加补充', exact: true }); const text = '补充木纹方向确认，保留原始图文和计划。'
    await form.getByLabel('补充说明', { exact: true }).fill(text)
    let requests = 0; let failReads = false; let denied = 0; let lost = true; const bodies: string[] = []
    await creator.route(`**/api/orders/${order.id}`, async route => {
      if (denied) await route.fulfill({ status: denied, json: { code: 40300, message: '测试注入：订单访问权限失效', data: null } })
      else if (failReads) await route.abort('failed'); else await route.continue()
    })
    await creator.route(`**/api/orders/${order.id}/progress-nodes/${node.id}/supplements`, async route => {
      requests++; bodies.push(route.request().postData() || '')
      if (lost) { lost = false; const response = await route.fetch(); expect(response.status()).toBe(201); failReads = true; await route.abort('failed') }
      else await route.continue()
    })
    await creator.evaluate(() => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) { if (this === sessionStorage && key.startsWith('order-fulfillment:')) throw new DOMException('测试注入：无法保存履约输入', 'QuotaExceededError'); original.call(this, key, value) }
      ;(window as Window & { restoreFulfillmentStorage?: () => void }).restoreFulfillmentStorage = () => { Storage.prototype.setItem = original }
    })
    await form.getByRole('button', { name: '追加补充', exact: true }).click()
    await expect(creator.getByRole('alert').filter({ hasText: '浏览器存储暂时不可用' })).toBeVisible()
    expect(requests).toBe(0)
    await expect(form.getByLabel('补充说明', { exact: true })).toHaveValue(text)
    await creator.evaluate(() => (window as Window & { restoreFulfillmentStorage?: () => void }).restoreFulfillmentStorage?.())
    await form.getByRole('button', { name: '追加补充', exact: true }).click()
    await expect(creator.getByRole('alert').filter({ hasText: '追加补充结果尚未确认' })).toBeVisible()
    await expect(creator.getByRole('button', { name: '重试确认操作结果', exact: true })).toBeDisabled()
    const stored = await creator.evaluate(() => Object.entries(sessionStorage).filter(([key]) => key.startsWith('order-fulfillment:')))
    expect(stored).toHaveLength(1); expect(JSON.parse(stored[0]![1]).input).toEqual(JSON.parse(bodies[0]!))
    await creator.reload()
    await expect(creator.getByRole('alert').filter({ hasText: '追加补充结果尚未确认' })).toBeVisible()
    failReads = false
    await creator.getByRole('button', { name: '刷新订单', exact: true }).first().click()
    await expect(creator.locator('.progress-record').filter({ hasText: text })).toHaveCount(1)
    await expect(creator.getByRole('button', { name: '重试确认操作结果', exact: true })).toHaveCount(0)
    expect(requests).toBe(1)
    expect(await creator.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('order-fulfillment:')))).toHaveLength(0)
    await creator.locator('.order-progress > li[data-node-code="MATERIAL"]').getByRole('button', { name: '追加补充', exact: true }).click()
    await form.getByLabel('补充说明', { exact: true }).fill('这一次请求尚未到达服务端，核验后使用原键重试。')
    let reject = true
    await creator.unroute(`**/api/orders/${order.id}/progress-nodes/${node.id}/supplements`)
    await creator.route(`**/api/orders/${order.id}/progress-nodes/${node.id}/supplements`, async route => {
      bodies.push(route.request().postData() || '')
      if (reject) { reject = false; await route.abort('failed') } else await route.continue()
    })
    await form.getByRole('button', { name: '追加补充', exact: true }).click()
    await expect(creator.getByRole('button', { name: '重试确认操作结果', exact: true })).toBeEnabled()
    await creator.getByRole('button', { name: '重试确认操作结果', exact: true }).click()
    await expect(creator.locator('.progress-record').filter({ hasText: '这一次请求尚未到达服务端' })).toHaveCount(1)
    expect(bodies).toHaveLength(3); expect(bodies[2]).toBe(bodies[1])
    const latest = (await (await creator.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(latest.progressNodes[0].records).toHaveLength(3)
    await creator.locator('.order-progress > li[data-node-code="MATERIAL"]').getByRole('button', { name: '追加补充', exact: true }).click()
    await form.getByLabel('补充说明', { exact: true }).fill('访问资格失效时应清除未知输入与订单详情。')
    await creator.unroute(`**/api/orders/${order.id}/progress-nodes/${node.id}/supplements`)
    await creator.route(`**/api/orders/${order.id}/progress-nodes/${node.id}/supplements`, route => route.abort('failed'))
    await form.getByRole('button', { name: '追加补充', exact: true }).click()
    await expect(creator.getByRole('button', { name: '重试确认操作结果', exact: true })).toBeEnabled()
    denied = 403
    await creator.getByRole('button', { name: '刷新订单', exact: true }).first().click()
    await expect(creator.getByRole('heading', { name: order.title, exact: true })).toHaveCount(0)
    await expect(creator.getByRole('button', { name: '重试确认操作结果', exact: true })).toHaveCount(0)
    expect(await creator.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('order-fulfillment:')))).toHaveLength(0)
  } finally { await adminContext.close(); await creatorContext.close() }
})

/** 真正的定时扫描驱动收货和需求完结；隔离夹具只调整时间，不代写业务状态。 */
test('定时自动收货与售后窗口后需求完结，结算自动生效', async ({ page, browser, mailbox }) => {
  test.setTimeout(300_000)
  const adminContext = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '自动收货买家')
    const order = await shippedOrder(page, creator, categoryId, '七日自动收货及需求完结验收')
    await adminContext.close()
    await page.goto(`/orders/${order.id}`)
    await mailbox.expireFulfillmentBoundary(order.id, 'AUTO_RECEIPT')
    await expect.poll(async () => (await (await page.request.get(`${api}/orders/${order.id}`)).json()).data.status, { timeout: 90_000, intervals: [1000] }).toBe('COMPLETED')
    await expect(selectedStatus(page)).toHaveText('已完成')
    const completed = (await (await creator.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(completed.originalCompletedAt).toBeTruthy(); expect(completed.settlement.status).toBe('PENDING')
    expect((await (await page.request.get(`${api}/custom-requests/${order.requestId}`)).json()).data.status).toBe('IN_TRADE')
    await mailbox.expireFulfillmentBoundary(order.id, 'COMPLETION')
    await expect.poll(async () => (await (await page.request.get(`${api}/custom-requests/${order.requestId}`)).json()).data.status, { timeout: 90_000, intervals: [1000] }).toBe('COMPLETED')
    // 结算扫描每分钟运行一次：窗口结束后应自动生成结算流水并把结算状态推进为已结算。
    await expect.poll(async () => (await (await creator.request.get(`${api}/orders/${order.id}`)).json()).data.settlement.status, { timeout: 120_000, intervals: [5000] }).toBe('SETTLED')
    const final = (await (await creator.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(final.settlement.settledAt).toBeTruthy()
    expect(final.history.filter((item: { toStatus: string }) => item.toStatus === 'COMPLETED')).toHaveLength(1)
  } finally { await adminContext.close(); await creatorContext.close() }
})
