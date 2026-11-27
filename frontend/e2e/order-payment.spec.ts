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
  const addressResponse = await mutate(buyer, '/me/addresses', { recipientName: '支付验收收件人', phone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', detailAddress: '支付快照测试路一号', isDefault: true })
  expect(addressResponse.status()).toBe(201)
  const response = await mutate(buyer, `/custom-requests/${draft.id}/award`, { requestKey: randomUUID(), quoteId: quote.id, addressId: (await addressResponse.json()).data.id, confirmedEstimatedShipDate: quote.estimatedShipDate }, 'put')
  expect(response.status()).toBe(201)
  return (await response.json()).data
}

function plusDays(day: string, days: number) { return new Date(Date.parse(`${day}T00:00:00+08:00`) + days * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }) }

/** 订单当前状态由左栏所选卡片展示，完整支付记录在资料子页。 */
const selectedStatus = (page: Page) => page.locator('.craftflow-order-item a[aria-current="page"] [data-status]')

async function openPaymentRecord(page: Page) {
  await page.getByRole('navigation', { name: '订单资料', exact: true }).getByRole('link', { name: '支付记录', exact: true }).click()
  await expect(page.getByRole('heading', { name: '支付记录', exact: true })).toBeVisible()
}

test('买家确认模拟条款后付款，双方实时查看金额、固定五节点和需求会话状态', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '付款买家')
    const order = await pendingOrder(page, creator, categoryId, '原木书签模拟付款验收')
    // 订单离页也要检查实际请求，不能把其他页面的缺失参数当作订单编号。
    const invalidOrderRequests: string[] = []
    page.on('request', request => {
      const path = new URL(request.url()).pathname
      if (path.startsWith('/api/orders/') && !/^\/api\/orders\/[1-9]\d*(?:\/|$)/.test(path)) invalidOrderRequests.push(path)
    })
    await adminContext.close()
    const requests = await page.context().newPage(); await requests.goto('/my-requests')
    const requestCard = requests.getByRole('link', { name: order.title, exact: true })
    await expect(requestCard).toContainText('已定标')
    const requestDetail = await page.context().newPage(); await requestDetail.goto(`/requests/${order.requestId}`)
    const requestStatus = requestDetail.getByRole('region', { name: '需求详情', exact: true }).locator('.cf-request-status')
    await expect(requestStatus).toHaveText('已定标')
    // 定标后已退出开放报价阶段，过期和新咨询拒绝文案不应继续误导订单双方。
    await expect.soft(requestDetail.getByText(/无有效报价将过期|需求未开放或已经结束/)).toHaveCount(0)
    await creator.goto(`/orders/${order.id}`)
    await expect(creator.getByRole('button', { name: '模拟支付', exact: true })).toHaveCount(0)
    const chat = await creatorContext.newPage(); await chat.goto(`/messages/conversations/${order.conversationId}`)
    const chatStatus = chat.locator('.conversation-header .conversation-status')
    await expect(chatStatus).toHaveText('待付款')
    await page.goto(`/orders/${order.id}`)
    await expect.soft(page.locator('.request-summary')).not.toContainText('订单取消后')
    await page.getByRole('button', { name: '模拟支付', exact: true }).click()
    const confirmation = page.getByRole('region', { name: '确认模拟支付', exact: true })
    await expect(confirmation).toContainText('180.00')
    await expect(confirmation).toContainText('支付快照测试路一号')
    await expect(confirmation).toContainText('10 个自然日')
    await expect(confirmation).toContainText('晚于需求期望')
    await expect(page.getByRole('button', { name: '确认模拟支付', exact: true })).toBeDisabled()
    await page.getByLabel('我已阅读并同意定制支付条款', { exact: true }).check()
    await page.getByRole('button', { name: '确认模拟支付', exact: true }).click()
    await expect(selectedStatus(page)).toHaveText('待开工')
    await expect.soft(page.locator('.request-summary')).not.toContainText('订单取消后')
    await expect.soft(page.locator('.request-summary')).toContainText('等待创作者确认开工')
    await expect(page.getByRole('link', { name: '结算信息', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '取消订单', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /确认开工|申请退款/ })).toHaveCount(0)
    await expect(page.locator('.order-progress li')).toHaveCount(5)
    await expect(page.locator('.order-progress li').filter({ hasText: '未开始' })).toHaveCount(5)
    await expect(selectedStatus(creator)).toHaveText('待开工')
    await creator.getByRole('navigation', { name: '订单资料', exact: true }).getByRole('link', { name: '结算信息', exact: true }).click()
    await expect(creator.getByRole('heading', { name: '结算信息', exact: true })).toBeVisible()
    await expect(creator.getByText('支付快照测试路一号', { exact: false })).toHaveCount(0)
    await expect(requestCard).toContainText('交易进行中')
    await expect(requestStatus).toHaveText('交易进行中')
    await expect.soft(requestDetail.getByText(/无有效报价将过期|需求未开放或已经结束/)).toHaveCount(0)
    await expect(chatStatus).toHaveText('待开工')
    const paid = (await (await page.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(paid.status).toBe('PAID'); expect(paid.paidAmount).toBe('180.00'); expect(paid.payment.amount).toBe('180.00'); expect(paid.settlement).toBeNull()
    const paymentDay = new Date(paid.paidAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
    expect(paid.shipDate).toBe(plusDays(paymentDay, 10))
    expect(paid.progressNodes.map((node: { nodeCode: string }) => node.nodeCode)).toEqual(['MATERIAL', 'SAMPLE', 'MAKING', 'QC', 'SHIPPING'])
    expect(paid.progressNodes.map((node: { plannedFinishDate: string }) => node.plannedFinishDate)).toEqual([2, 4, 8, 9, 10].map(days => plusDays(paymentDay, days)))
    const creatorPaid = (await (await creator.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(creatorPaid.settlement.paidAmount).toBe('180.00'); expect(creatorPaid.settlement.status).toBe('PENDING'); expect(creatorPaid.settlement.maskedPayee).toContain('*')
    await openPaymentRecord(page)
    await page.screenshot({ path: testInfo.outputPath('paid-order.png'), fullPage: true })
    await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '我的订单', exact: true }).click()
    await page.getByLabel('订单状态', { exact: true }).selectOption('PAID')
    await expect(page.getByRole('region', { name: '订单列表' }).getByRole('listitem').filter({ hasText: order.title })).toContainText('待开工')
    const listed = (await (await page.request.get(`${api}/me/orders?status=PAID`)).json()).data.items[0]
    expect(listed.addressSnapshot).toBeNull(); expect(listed.paymentPreview).toBeNull(); expect(listed.payment).toBeNull(); expect(listed.progressNodes).toEqual([])
    expect(invalidOrderRequests).toEqual([])
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('付款真实成功丢响应且核验暂时失败，刷新保留未知确认并恢复原付款结果', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '重试付款买家')
    const order = await pendingOrder(page, creator, categoryId, '未知支付结果恢复验收')
    await adminContext.close()
    await page.goto(`/orders/${order.id}`)
    await page.getByRole('button', { name: '模拟支付', exact: true }).click()
    await page.getByLabel('我已阅读并同意定制支付条款', { exact: true }).check()
    let unavailable = false; let original = ''; let paidFlow = ''
    await page.route(`**/api/orders/${order.id}`, async route => {
      if (unavailable) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '测试注入：支付核验暂时不可用', data: null }) })
      else await route.continue()
    })
    await page.route(`**/api/orders/${order.id}/payment`, async route => {
      original = route.request().postData() || ''
      const response = await route.fetch(); expect(response.status()).toBe(201); paidFlow = (await response.json()).data.payment.flowNo
      unavailable = true; await route.abort('failed')
    })
    await page.getByRole('button', { name: '确认模拟支付', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: '付款结果尚未确认' })).toBeVisible()
    await expect(page.getByRole('button', { name: '取消订单', exact: true })).toBeDisabled()
    const stored = await page.evaluate(() => Object.entries(sessionStorage).filter(([key]) => key.startsWith('order-payment:')))
    expect(stored).toHaveLength(1); expect(stored[0]![1]).not.toContain('180.00'); expect(stored[0]![1]).not.toContain('支付快照测试路')
    expect(JSON.parse(stored[0]![1]).input).toEqual(JSON.parse(original))
    await page.reload()
    await expect(page.getByRole('alert').filter({ hasText: '付款结果尚未确认' })).toBeVisible()
    unavailable = false
    await page.getByRole('button', { name: '刷新订单', exact: true }).first().click()
    await expect(selectedStatus(page)).toHaveText('待开工')
    await openPaymentRecord(page)
    await expect(page.getByText(paidFlow, { exact: true })).toBeVisible()
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('order-payment:')))).toHaveLength(0)
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('双端付款复用唯一流水，付款前延迟的旧详情不能覆盖已付款状态', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  let releaseOld = () => {}; let releasePayment = () => {}
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '双端付款买家')
    const order = await pendingOrder(page, creator, categoryId, '双端付款与旧响应验收')
    await adminContext.close()
    const second = await page.context().newPage()
    await page.goto(`/orders/${order.id}`); await second.goto(`/orders/${order.id}`)
    for (const tab of [page, second]) { await tab.getByRole('button', { name: '模拟支付', exact: true }).click(); await tab.getByLabel('我已阅读并同意定制支付条款', { exact: true }).check() }
    let oldCaptured = () => {}; const captured = new Promise<void>(resolve => { oldCaptured = resolve })
    const oldGate = new Promise<void>(resolve => { releaseOld = resolve }); let hold = true
    await page.route(`**/api/orders/${order.id}`, async route => {
      if (!hold) { await route.continue(); return }
      hold = false; const response = await route.fetch(); expect((await response.json()).data.status).toBe('PENDING_PAY'); oldCaptured(); await oldGate; await route.fulfill({ response })
    })
    await expect(page.getByRole('button', { name: '刷新订单', exact: true })).toHaveCount(0)
    await page.evaluate(() => window.dispatchEvent(new Event('order-updated')))
    await captured
    let recorded = () => {}; const recordedPromise = new Promise<void>(resolve => { recorded = resolve })
    const paymentGate = new Promise<void>(resolve => { releasePayment = resolve }); let firstFlow = ''
    // 第二端尚未收到付款后核验结果时，保留它已确认的原支付输入以验证真实幂等。
    await second.route(`**/api/orders/${order.id}`, async route => { await paymentGate; await route.continue() })
    await page.route(`**/api/orders/${order.id}/payment`, async route => {
      const response = await route.fetch(); expect(response.status()).toBe(201); firstFlow = (await response.json()).data.payment.flowNo; recorded(); await paymentGate; await route.fulfill({ response })
    })
    await page.getByRole('button', { name: '确认模拟支付', exact: true }).click(); await recordedPromise
    await expect(page.getByRole('button', { name: '取消订单', exact: true })).toBeDisabled()
    const replay = second.waitForResponse(response => response.url().endsWith(`/orders/${order.id}/payment`))
    await second.getByRole('button', { name: '确认模拟支付', exact: true }).click()
    const replayResponse = await replay; expect(replayResponse.status()).toBe(200)
    expect((await replayResponse.json()).data).toMatchObject({ status: 'PAID', payment: { flowNo: firstFlow } })
    await expect(second.locator('.request-summary')).toContainText('等待创作者确认开工')
    releasePayment(); await expect(selectedStatus(page)).toHaveText('待开工')
    const oldReturned = page.waitForResponse(response => response.url().endsWith(`/api/orders/${order.id}`))
    releaseOld(); await oldReturned
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(selectedStatus(page)).toHaveText('待开工')
    await openPaymentRecord(page)
    await expect(page.getByText(firstFlow, { exact: true })).toBeVisible()
    const latest = (await (await page.request.get(`${api}/orders/${order.id}`)).json()).data
    expect(latest.history.filter((item: { toStatus: string }) => item.toStatus === 'PAID')).toHaveLength(1)
    expect(latest.progressNodes).toHaveLength(5)
  } finally { releaseOld(); releasePayment(); await adminContext.close(); await creatorContext.close() }
})

test('未知付款仅可核验后以原确认重试，跨订单与退出账号不串用确认', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '隔离付款买家')
    const first = await pendingOrder(page, creator, categoryId, '未知付款原确认验收')
    const second = await pendingOrder(page, creator, categoryId, '独立订单确认验收')
    await adminContext.close()
    await page.goto(`/orders/${first.id}`); await page.getByRole('button', { name: '模拟支付', exact: true }).click(); await page.getByLabel('我已阅读并同意定制支付条款', { exact: true }).check()
    const bodies: string[] = []; let reject = true
    await page.route(`**/api/orders/${first.id}/payment`, async route => {
      bodies.push(route.request().postData() || '')
      if (reject) { reject = false; await route.abort('failed') }
      else await route.continue()
    })
    await page.getByRole('button', { name: '确认模拟支付', exact: true }).click()
    await expect(page.getByRole('button', { name: '重试确认支付结果', exact: true })).toBeEnabled()
    await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '我的订单', exact: true }).click()
    await page.getByRole('link', { name: second.title, exact: true }).click()
    await expect(page.getByRole('heading', { name: second.title, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '重试确认支付结果', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '模拟支付', exact: true })).toBeEnabled()
    await page.goto(`/orders/${first.id}`)
    await expect(page.getByRole('button', { name: '重试确认支付结果', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '重试确认支付结果', exact: true }).click()
    await expect(selectedStatus(page)).toHaveText('待开工')
    expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0])
    await page.goto(`/orders/${second.id}`); await page.getByRole('button', { name: '模拟支付', exact: true }).click(); await page.getByLabel('我已阅读并同意定制支付条款', { exact: true }).check()
    await page.route(`**/api/orders/${second.id}/payment`, route => route.abort('failed'))
    await page.getByRole('button', { name: '确认模拟支付', exact: true }).click()
    await expect(page.getByRole('button', { name: '重试确认支付结果', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '退出登录', exact: true }).click(); await expect(page).toHaveURL('/login')
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('order-payment:')))).toHaveLength(0)
    await register(page, mailbox.codes, '另一位付款买家'); await page.goto(`/orders/${second.id}`)
    await expect(page.getByRole('heading', { name: second.title, exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '重试确认支付结果', exact: true })).toHaveCount(0)
    await expect(page.getByText('支付快照测试路一号', { exact: false })).toHaveCount(0)
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('未知付款遇到无流水的已取消投影仍保留确认，原支付重试核验真实成功结果', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '截止投影付款买家')
    const order = await pendingOrder(page, creator, categoryId, '未知付款与到期投影验收')
    await adminContext.close()
    await page.goto(`/orders/${order.id}`)
    const unpaidEnvelope = await (await page.request.get(`${api}/orders/${order.id}`)).json()
    await page.getByRole('button', { name: '模拟支付', exact: true }).click(); await page.getByLabel('我已阅读并同意定制支付条款', { exact: true }).check()
    let projectCancelled = false; let loseFirstResponse = true; let paidFlow = ''; const bodies: string[] = []
    // 只模拟查询在截止时刻投影取消而未读到在途付款的边界，支付始终真实请求后端。
    await page.route(`**/api/orders/${order.id}`, async route => {
      if (projectCancelled) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...unpaidEnvelope, data: { ...unpaidEnvelope.data, status: 'CANCELLED', canPay: false, canCancel: false, paymentPreview: null, payment: null, paidAt: null, paidAmount: null } }) })
      else await route.continue()
    })
    await page.route(`**/api/orders/${order.id}/payment`, async route => {
      bodies.push(route.request().postData() || '')
      if (loseFirstResponse) {
        loseFirstResponse = false
        const response = await route.fetch(); expect(response.status()).toBe(201); paidFlow = (await response.json()).data.payment.flowNo
        projectCancelled = true; await route.abort('failed')
      } else {
        projectCancelled = false
        const response = await route.fetch(); expect(response.status()).toBe(200); expect((await response.json()).data.payment.flowNo).toBe(paidFlow)
        await route.fulfill({ response })
      }
    })
    await page.getByRole('button', { name: '确认模拟支付', exact: true }).click()
    await expect(page.getByRole('button', { name: '取消订单', exact: true })).toHaveCount(0)
    await expect(selectedStatus(page)).toHaveText('已取消')
    await expect(page.getByRole('alert').filter({ hasText: '付款结果尚未确认' })).toBeVisible()
    await expect(page.getByRole('button', { name: '重试确认支付结果', exact: true })).toBeEnabled()
    const stored = await page.evaluate(() => Object.entries(sessionStorage).filter(([key]) => key.startsWith('order-payment:')))
    expect(stored).toHaveLength(1); expect(JSON.parse(stored[0]![1]).input).toEqual(JSON.parse(bodies[0]!))
    await page.getByRole('button', { name: '重试确认支付结果', exact: true }).click()
    await expect(selectedStatus(page)).toHaveText('待开工')
    await openPaymentRecord(page)
    await expect(page.getByText(paidFlow, { exact: true })).toBeVisible()
    expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0])
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('order-payment:')))).toHaveLength(0)
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('浏览器付款确认存储异常不发送支付且恢复操作，清理存储异常不阻断退出', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    const email = await register(page, mailbox.codes, '存储故障付款买家')
    const order = await pendingOrder(page, creator, categoryId, '浏览器确认存储故障验收')
    await adminContext.close()
    let paymentRequests = 0
    page.on('request', request => { if (request.method() === 'PUT' && request.url().endsWith(`/api/orders/${order.id}/payment`)) paymentRequests++ })
    for (const failureName of ['SecurityError', 'QuotaExceededError']) {
      await page.goto(`/orders/${order.id}`)
      await page.getByRole('button', { name: '模拟支付', exact: true }).click(); await page.getByLabel('我已阅读并同意定制支付条款', { exact: true }).check()
      // 仅拒绝本功能写入，其他业务存储及真实HTTP均保持原有行为。
      await page.evaluate(name => {
        const original = Storage.prototype.setItem
        Storage.prototype.setItem = function (key, value) { if (this === sessionStorage && key.startsWith('order-payment:')) throw new DOMException('测试注入：付款确认无法保存', name); original.call(this, key, value) }
        ;(window as Window & { restorePaymentStorage?: () => void }).restorePaymentStorage = () => { Storage.prototype.setItem = original }
      }, failureName)
      await page.getByRole('button', { name: '确认模拟支付', exact: true }).click()
      await expect(page.getByRole('alert').filter({ hasText: '存储' })).toBeVisible()
      expect(paymentRequests).toBe(0)
      await expect(page.getByRole('button', { name: '取消订单', exact: true })).toBeEnabled()
      await expect(page.getByRole('button', { name: '确认模拟支付', exact: true })).toBeEnabled()
      await expect(page.getByRole('button', { name: '刷新订单', exact: true }).first()).toBeEnabled()
      await page.evaluate(() => (window as Window & { restorePaymentStorage?: () => void }).restorePaymentStorage?.())
      const refreshed = page.waitForResponse(response => response.url().endsWith(`/api/orders/${order.id}`))
      await page.getByRole('button', { name: '刷新订单', exact: true }).first().click(); expect((await refreshed).status()).toBe(200)
      await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '我的订单', exact: true }).click()
      await expect(page).toHaveURL('/orders')
    }
    for (const failureStage of ['removeItem', 'keys']) {
      if (failureStage === 'keys') expect((await mutate(page, '/sessions', { email, password: 'CraftTest123' })).status()).toBe(201)
      await page.goto(`/orders/${order.id}`)
      await page.getByRole('button', { name: '模拟支付', exact: true }).click(); await page.getByLabel('我已阅读并同意定制支付条款', { exact: true }).check()
      await page.route(`**/api/orders/${order.id}/payment`, route => route.abort('failed'))
      await page.getByRole('button', { name: '确认模拟支付', exact: true }).click()
      await expect(page.getByRole('button', { name: '重试确认支付结果', exact: true })).toBeEnabled()
      await page.evaluate(stage => {
        const remove = Storage.prototype.removeItem; const keys = Object.keys
        if (stage === 'removeItem') Storage.prototype.removeItem = function (key) { if (this === sessionStorage && key.startsWith('order-payment:')) throw new DOMException('测试注入：付款确认无法删除', 'SecurityError'); remove.call(this, key) }
        else Object.keys = function (value: object) { if (value === sessionStorage) throw new DOMException('测试注入：存储无法枚举', 'SecurityError'); return keys(value) }
        ;(window as Window & { restorePaymentStorage?: () => void }).restorePaymentStorage = () => { Storage.prototype.removeItem = remove; Object.keys = keys }
      }, failureStage)
      await page.getByRole('button', { name: '退出登录', exact: true }).click(); await expect(page).toHaveURL('/login')
      await page.evaluate(() => { (window as Window & { restorePaymentStorage?: () => void }).restorePaymentStorage?.(); sessionStorage.clear() })
    }
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('未知付款核验遇到权限或可见性失效时清空详情、重试和浏览器确认记录', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '付款权限核验买家')
    const order = await pendingOrder(page, creator, categoryId, '付款确认权限失效验收')
    await adminContext.close()
    let denied = 0
    await page.route(`**/api/orders/${order.id}`, async route => {
      if (denied) await route.fulfill({ status: denied, contentType: 'application/json', body: JSON.stringify({ code: denied, message: `测试注入：订单访问失效 ${denied}`, data: null }) })
      else await route.continue()
    })
    await page.route(`**/api/orders/${order.id}/payment`, route => route.abort('failed'))
    for (const status of [403, 404, 401]) {
      denied = 0; await page.goto(`/orders/${order.id}`)
      await page.getByRole('button', { name: '模拟支付', exact: true }).click(); await page.getByLabel('我已阅读并同意定制支付条款', { exact: true }).check()
      await page.getByRole('button', { name: '确认模拟支付', exact: true }).click()
      await expect(page.getByRole('button', { name: '重试确认支付结果', exact: true })).toBeEnabled()
      expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('order-payment:')))).toHaveLength(1)
      denied = status
      const deniedResponse = page.waitForResponse(response => response.url().endsWith(`/api/orders/${order.id}`) && response.status() === status)
      await page.getByRole('button', { name: '刷新订单', exact: true }).first().click(); await deniedResponse
      await expect(page.getByRole('heading', { name: order.title, exact: true })).toHaveCount(0)
      await expect(page.getByText('支付快照测试路一号', { exact: false })).toHaveCount(0)
      await expect(page.getByRole('button', { name: '重试确认支付结果', exact: true })).toHaveCount(0)
      expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('order-payment:')))).toHaveLength(0)
      if (status === 401) await expect(page).toHaveURL(/\/login\?/)
    }
  } finally { await adminContext.close(); await creatorContext.close() }
})
