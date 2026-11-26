import { randomUUID } from 'node:crypto'
import { test, expect } from './fixtures'
import { anotherCreator, api, image, mutate, origin, prepareCreator, register } from './custom-request-support'

test.use({ storageMode: 'receiver', actionTimeout: 15_000 })

test('已选报价到期时定标返回冲突，刷新后仍能选择另一份有效报价', async ({ page: buyer, browser, mailbox }) => {
  test.setTimeout(180_000)
  const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext({ baseURL: origin })))
  try {
    const admin = await contexts[0]!.newPage()
    const first = await contexts[1]!.newPage()
    const second = await contexts[2]!.newPage()
    const { categoryId, applicationId } = await prepareCreator(first, admin, mailbox.codes, mailbox.promoteAdmin)
    const application = (await (await first.request.get(`${api}/me/creator-applications/${applicationId}`)).json()).data
    await anotherCreator(second, admin, mailbox.codes, application.categoryIds[0])
    await register(buyer, mailbox.codes, '到期定标买家')
    const address = await mutate(buyer, '/me/addresses', {
      recipientName: '到期测试收件人', phone: '13800138000', province: '北京市', city: '市辖区',
      district: '东城区', detailAddress: '到期定标测试路一号', isDefault: true,
    })
    expect(address.status()).toBe(201)
    const content = {
      title: '两位创作者的书签方案', categoryId, purpose: '生日礼物', materialPreference: '天然原木',
      specification: '十二厘米', budgetMin: '100.00', budgetMax: '300.00',
      expectedShipDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      description: '希望为朋友制作保留自然木纹的原木书签，边角打磨圆润，在木片正面刻上名字，制作前先确认文字排版。',
      referenceImageIds: [], visibility: 'PUBLIC', invitedCreatorId: null, sourceWorkId: null,
    }
    const creation = await mutate(buyer, '/me/custom-requests', { ...content, requestKey: randomUUID() })
    expect(creation.status()).toBe(201)
    const draft = (await creation.json()).data
    expect((await mutate(buyer, `/me/custom-requests/${draft.id}/publication`, { ...content, version: draft.version }, 'put')).status()).toBe(200)
    const proposal = '选择颜色均匀且纹理清晰的原木，沿木纹切割并打磨圆角，先与买家确认尺寸和刻字排版，最后涂环保木蜡油。'
    const expiredQuote = await mutate(first, `/custom-requests/${draft.id}/quotes`, {
      requestKey: randomUUID(), goodsAmount: '150.00', durationDays: 10, proposal, additionalAgreement: '', imageIds: [],
    })
    expect(expiredQuote.status()).toBe(201)
    const expiredQuoteId = (await expiredQuote.json()).data.id
    const validQuote = await mutate(second, `/custom-requests/${draft.id}/quotes`, {
      requestKey: randomUUID(), goodsAmount: '180.00', durationDays: 12, proposal, additionalAgreement: '', imageIds: [],
    })
    expect(validQuote.status()).toBe(201)
    const validQuoteId = (await validQuote.json()).data.id

    await buyer.goto(`/requests/${draft.id}/quotes`)
    const table = buyer.getByRole('table', { name: '报价方案对比' })
    const choose = table.getByRole('button', { name: '选择此方案', exact: true })
    await expect(choose).toHaveCount(2)
    await choose.first().click()
    await expect(buyer.getByRole('region', { name: '定标确认' })).toContainText('山间器物')
    const confirm = buyer.getByRole('button', { name: '确认定标并生成订单', exact: true })
    await expect(confirm).toBeEnabled()

    // 在浏览器已经展示有效报价后才推进截止时间，复现提交过期方案的入口。
    await mailbox.expireQuote(expiredQuoteId)
    const awardResponse = buyer.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname === `/api/custom-requests/${draft.id}/award`)
    await confirm.click()
    expect((await awardResponse).status()).toBe(409)
    await expect(buyer.getByText(/本次请求已被拒绝/)).toBeVisible()
    await expect(choose).toHaveCount(1)
    await expect(table).not.toContainText('山间器物')
    await expect(buyer.locator('.quote-record')).toContainText('山间器物')
    const rejectedOrders = await buyer.request.get(`${api}/me/orders`)
    expect((await rejectedOrders.json()).data.total).toBe(0)
    const rejectedNotices = await first.request.get(`${api}/me/notifications`)
    expect((await rejectedNotices.json()).data.items.map((item: { eventType: string }) => item.eventType)).not.toContain('QUOTE_AWARDED')

    await choose.click()
    await expect(buyer.getByRole('region', { name: '定标确认' })).toContainText('木间新作')
    await confirm.click()
    await expect(buyer).toHaveURL(/\/orders\/\d+$/)
    const order = await buyer.request.get(`${api}${new URL(buyer.url()).pathname}`)
    expect((await order.json()).data).toMatchObject({ quoteId: validQuoteId, requestId: draft.id })
    const orders = await buyer.request.get(`${api}/me/orders`)
    expect((await orders.json()).data.total).toBe(1)
  } finally { await Promise.all(contexts.map(context => context.close())) }
})

/** 捕获报价无法提交、撤回历史丢失、未知定标响应重复建单及取消后会话失效。 */
test('报价撤回重报、地址定标未知响应重试、订单取消与历史沟通', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(240_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '方案买家')
    const content = { title: '原木书签报价验收', categoryId, purpose: '生日礼物', materialPreference: '天然原木', specification: '十二厘米', budgetMin: '100.00', budgetMax: '300.00', expectedShipDate: new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10), description: '希望为爱读书的朋友制作一枚原木书签，保留自然木纹，边角打磨圆润并刻上名字作为生日纪念。', referenceImageIds: [], visibility: 'PUBLIC', invitedCreatorId: null, sourceWorkId: null }
    const draft = await mutate(page, '/me/custom-requests', { ...content, requestKey: randomUUID() })
    expect(draft.status()).toBe(201)
    const request = (await draft.json()).data
    expect((await mutate(page, `/me/custom-requests/${request.id}/publication`, { ...content, version: request.version }, 'put')).status()).toBe(200)
    await creator.goto(`/requests/${request.id}`)
    await creator.getByLabel('报价金额（元）', { exact: true }).fill('220.00')
    await creator.getByLabel('工期（自然日）', { exact: true }).fill('12')
    await creator.getByLabel('方案说明', { exact: true }).fill('选用天然胡桃木，手工锯切与细磨后涂抹木蜡油，书签顶部雕刻姓名，制作前确认字体和位置。')
    await creator.getByLabel('材料与修改约定', { exact: true }).fill('雕刻前可修改一次字体')
    await creator.getByLabel('方案图片', { exact: true }).setInputFiles({ name: 'proposal.png', mimeType: 'image/png', buffer: image })
    await expect(creator.getByRole('img', { name: '方案图片 1', exact: true })).toBeVisible()
    let quoteResponseLost = false; let rejectRequestRefresh = false
    const submittedQuoteBodies: string[] = []
    await creator.route(`**/api/custom-requests/${request.id}`, async route => {
      if (route.request().method() === 'GET' && rejectRequestRefresh) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: '测试注入：需求读取暂时不可用', data: null }) })
      else await route.continue()
    })
    await creator.route(`**/api/custom-requests/${request.id}/quotes`, async route => {
      if (route.request().method() === 'POST') submittedQuoteBodies.push(route.request().postData() || '')
      if (route.request().method() === 'POST' && !quoteResponseLost) { quoteResponseLost = true; expect((await route.fetch()).status()).toBe(201); await route.abort('failed') }
      else await route.continue()
    })
    await creator.getByRole('button', { name: '提交报价', exact: true }).click()
    await expect(creator.getByRole('alert')).toContainText('结果未知')
    await expect(creator.getByLabel('报价金额（元）', { exact: true })).toBeDisabled()
    rejectRequestRefresh = true
    await creator.evaluate(() => window.dispatchEvent(new Event('custom-request-updated')))
    await expect(creator.getByRole('alert').filter({ hasText: '需求读取暂时不可用' })).toBeVisible()
    await expect(creator.getByLabel('报价金额（元）', { exact: true })).toHaveValue('220.00')
    await expect(creator.getByRole('button', { name: '重试确认报价结果', exact: true })).toBeVisible()
    rejectRequestRefresh = false
    await creator.getByRole('button', { name: '刷新详情', exact: true }).click()
    await creator.getByRole('button', { name: '重试确认报价结果', exact: true }).click()
    await expect.poll(() => submittedQuoteBodies.length).toBe(2)
    expect(submittedQuoteBodies[1]).toBe(submittedQuoteBodies[0])
    await expect(creator.locator('.quote-record')).toContainText('有效报价')
    expect((await (await creator.request.get(`${api}/me/quotes`)).json()).data.total).toBe(1)
    creator.once('dialog', dialog => dialog.accept())
    await creator.getByRole('button', { name: '撤回报价', exact: true }).click()
    await expect(creator.locator('.quote-record')).toContainText('已失效')
    await creator.locator('.quote-record').getByText('查看方案与约定', { exact: true }).click()
    await expect(creator.locator('.quote-record').getByRole('img', { name: '方案效果图 1', exact: true })).toBeVisible()
    await creator.getByLabel('报价金额（元）', { exact: true }).fill('180.00')
    await creator.getByLabel('工期（自然日）', { exact: true }).fill('10')
    await creator.getByLabel('方案说明', { exact: true }).fill('重新调整为天然山毛榉木，手工精细打磨并雕刻姓名，保留边缘圆角与木纹，制作前确认设计草图。')
    await creator.getByLabel('方案图片', { exact: true }).setInputFiles({ name: 'revised.png', mimeType: 'image/png', buffer: image })
    await expect(creator.getByRole('img', { name: '方案图片 1', exact: true })).toBeVisible()
    await creator.getByRole('button', { name: '提交报价', exact: true }).click()
    await expect(creator.locator('.quote-record')).toHaveCount(2)
    const address = await mutate(page, '/me/addresses', { recipientName: '验收收件人', phone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', detailAddress: '手作测试路一号', isDefault: true })
    expect(address.status()).toBe(201)
    await page.goto('/messages/notifications')
    await page.getByRole('button', { name: /^查看报价/ }).first().click()
    await expect(page).toHaveURL(`/requests/${request.id}#quotes`)
    await expect(page.getByLabel('报价金额（元）', { exact: true })).toHaveCount(0)
    await page.getByRole('link', { name: '查看报价对比', exact: true }).click()
    await expect(page.getByRole('table', { name: '报价方案对比' })).toContainText('暂无评价')
    await expect(page.getByRole('table', { name: '报价方案对比' })).toContainText('180.00')
    await expect(page.getByText('发货日期以实际付款时间确定', { exact: false })).toBeVisible()
    await page.getByRole('table', { name: '报价方案对比' }).getByRole('button', { name: '放大方案图片 1', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('img', { name: '方案图片大图', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '关闭大图', exact: true }).last().click()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({ path: testInfo.outputPath('quote-comparison.png'), fullPage: true })
    await page.getByRole('button', { name: '选择此方案', exact: true }).click()
    await expect(page.getByRole('button', { name: '确认定标并生成订单', exact: true })).toBeDisabled()
    await page.getByLabel('我接受晚于期望的预计发货日期').check()
    // 定标开始前的慢刷新不得在建单后覆盖已冻结的确认上下文。
    let releaseComparison = () => {}
    const comparisonGate = new Promise<void>(resolve => { releaseComparison = resolve })
    await page.route(`**/api/custom-requests/${request.id}/quote-comparison?*`, async route => { await comparisonGate; await route.continue() })
    await page.getByRole('button', { name: '刷新方案', exact: true }).click()
    // 真正请求后端并丢弃首次响应，重试必须使用原键与原内容。
    let lost = false
    await page.route(`**/api/custom-requests/${request.id}/award`, async route => {
      if (!lost) { lost = true; expect((await route.fetch()).status()).toBe(201); await route.abort('failed'); releaseComparison() }
      else await route.continue()
    })
    await page.getByRole('button', { name: '确认定标并生成订单', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('结果未知')
    await expect(page.getByLabel('选择收货地址', { exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '重试确认定标结果', exact: true }).click()
    await expect(page).toHaveURL(/\/orders\/\d+$/)
    const detailStatus = page.locator('.work-section-heading .work-status')
    await expect(detailStatus).toHaveText('待付款')
    await expect(page.getByText('手作测试路一号', { exact: false })).toBeVisible()
    await expect(page.getByRole('img', { name: '方案效果图 1', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('order-detail.png'), fullPage: true })
    const orderId = page.url().split('/').at(-1)!
    const orders = (await (await page.request.get(`${api}/me/orders`)).json()).data
    expect(orders.total).toBe(1)
    const addressId = (await address.json()).data.id
    expect((await mutate(page, `/me/addresses/${addressId}`, { recipientName: '修改后的收件人', phone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', detailAddress: '修改后的个人地址', isDefault: true }, 'put')).status()).toBe(200)
    await page.reload()
    await expect(page.getByText('手作测试路一号', { exact: false })).toBeVisible()
    await expect(page.getByText('修改后的个人地址', { exact: false })).toHaveCount(0)
    await creator.goto(`/orders/${orderId}`)
    await expect(creator.getByText('手作测试路一号', { exact: false })).toHaveCount(0)
    // 取消前取得的旧订单响应，即使最后返回也不能恢复待付款状态。
    let releaseOldOrder = () => {}; let capturedOldOrder = () => {}; let holdOrder = true
    const oldOrderGate = new Promise<void>(resolve => { releaseOldOrder = resolve })
    const oldOrderCaptured = new Promise<void>(resolve => { capturedOldOrder = resolve })
    await page.route(`**/api/orders/${orderId}`, async route => {
      if (!holdOrder) { await route.continue(); return }
      holdOrder = false
      const response = await route.fetch()
      expect((await response.json()).data.status).toBe('PENDING_PAY')
      capturedOldOrder(); await oldOrderGate; await route.fulfill({ response })
    })
    await page.getByRole('button', { name: '刷新订单', exact: true }).click()
    await oldOrderCaptured
    let releaseCancellation = () => {}
    const cancellationGate = new Promise<void>(resolve => { releaseCancellation = resolve })
    await page.route(`**/api/orders/${orderId}/cancellation`, async route => { await cancellationGate; await route.continue() })
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: '取消订单', exact: true }).click()
    await expect(page.getByRole('button', { name: '正在取消…', exact: true })).toBeDisabled()
    await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '我的订单', exact: true }).click()
    await expect(page).toHaveURL(`/orders/${orderId}`)
    releaseCancellation()
    await expect(detailStatus).toHaveText('已取消')
    const oldOrderReturned = page.waitForResponse(response => response.url().endsWith(`/api/orders/${orderId}`))
    releaseOldOrder(); await oldOrderReturned
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(detailStatus).toHaveText('已取消')
    await expect(page.getByRole('button', { name: '取消订单', exact: true })).toHaveCount(0)
    await page.getByRole('link', { name: '进入订单沟通', exact: true }).click()
    await expect(page.getByLabel('沟通内容', { exact: true })).toBeEnabled()
    await page.getByLabel('沟通内容', { exact: true }).fill('订单取消后仍可核对方案历史。')
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    await expect(page.getByRole('log')).toContainText('订单取消后仍可核对方案历史。')
    await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '我的订单', exact: true }).click()
    await page.getByLabel('订单状态', { exact: true }).selectOption('CANCELLED')
    const cancelledOrders = page.getByRole('region', { name: '订单列表' }).getByRole('listitem')
    await expect(cancelledOrders).toHaveCount(1)
    await expect(cancelledOrders).toContainText('已取消')
    await page.goto('/messages/notifications')
    await page.getByRole('button', { name: /^查看订单/ }).first().click()
    await expect(page).toHaveURL(`/orders/${orderId}`)
    await creator.goto('/creator/quotes')
    await expect(creator.locator('.quote-record')).toHaveCount(2)
    await expect(creator.locator('.quote-record').filter({ hasText: '180.00' })).toContainText('已中标')
    await expect(creator.getByText('今日已提交 2 / 20 次', { exact: true })).toBeVisible()
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('本人报价与承接订单历史仅需登录，未认证身份没有寻找需求的新业务入口', async ({ page, mailbox }) => {
  await register(page, mailbox.codes, '历史报价读者')
  await page.goto('/creator/quotes')
  await expect(page).toHaveURL('/creator/quotes')
  await expect(page.getByRole('heading', { name: '我的报价', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '暂无报价记录', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /寻找需求|需求大厅/ })).toHaveCount(0)
  await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '我的订单', exact: true }).click()
  const historyResponse = page.waitForResponse(response => response.url().includes('/api/me/orders?') && new URL(response.url()).searchParams.get('side') === 'CREATOR')
  await page.getByRole('link', { name: '我承接的', exact: true }).click()
  expect((await historyResponse).status()).toBe(200)
  await expect(page).toHaveURL('/orders?side=CREATOR')
  await expect(page.getByRole('heading', { name: '暂无订单', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('同表比较多份报价与访问权限，定标沿用中标会话并归档落选会话', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(180_000)
  const contexts = await Promise.all([browser.newContext({ baseURL: origin }), browser.newContext({ baseURL: origin }), browser.newContext({ baseURL: origin })])
  try {
    const admin = await contexts[0]!.newPage(); const first = await contexts[1]!.newPage(); const second = await contexts[2]!.newPage()
    const { categoryId, applicationId } = await prepareCreator(first, admin, mailbox.codes, mailbox.promoteAdmin)
    const application = (await (await first.request.get(`${api}/me/creator-applications/${applicationId}`)).json()).data
    await anotherCreator(second, admin, mailbox.codes, application.categoryIds[0])
    await register(page, mailbox.codes, '比较方案买家')
    const content = { title: '多位手艺人的制作方案', categoryId, purpose: '日常使用', materialPreference: '原木', specification: '十二厘米', budgetMin: '100.00', budgetMax: '300.00', expectedShipDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), description: '希望制作一枚保留原木纹理的书签，适合日常阅读，要求边缘细腻圆润并进行环保木蜡油处理。', referenceImageIds: [], visibility: 'PUBLIC', invitedCreatorId: null, sourceWorkId: null }
    const draft = (await (await mutate(page, '/me/custom-requests', { ...content, requestKey: randomUUID() })).json()).data
    expect((await mutate(page, `/me/custom-requests/${draft.id}/publication`, { ...content, version: draft.version }, 'put')).status()).toBe(200)
    // 定标前为两位创作者各保留一段真实咨询记录，定标后验证原会话的读写资格。
    const firstConversation = await mutate(first, `/custom-requests/${draft.id}/conversations`)
    const secondConversation = await mutate(second, `/custom-requests/${draft.id}/conversations`)
    expect(firstConversation.status()).toBe(201)
    expect(secondConversation.status()).toBe(201)
    const winnerConversationId = (await firstConversation.json()).data.id
    const loserConversationId = (await secondConversation.json()).data.id
    const winnerHistory = '可以先确认木纹和书签尺寸。'
    const loserHistory = '也可以选颜色较浅的山毛榉。'
    expect((await mutate(first, `/conversations/${winnerConversationId}/messages`, { clientMessageKey: randomUUID(), content: winnerHistory, imageIds: [] })).status()).toBe(201)
    expect((await mutate(second, `/conversations/${loserConversationId}/messages`, { clientMessageKey: randomUUID(), content: loserHistory, imageIds: [] })).status()).toBe(201)
    const firstQuote = await mutate(first, `/custom-requests/${draft.id}/quotes`, { requestKey: randomUUID(), goodsAmount: '180.00', durationDays: 10, proposal: '选用天然胡桃木，细致打磨并使用环保木蜡油，保留自然纹理，制作前提供草图确认尺寸和姓名刻印。', additionalAgreement: '', imageIds: [] })
    expect(firstQuote.status()).toBe(201)
    expect((await mutate(second, `/custom-requests/${draft.id}/quotes`, { requestKey: randomUUID(), goodsAmount: '120.00', durationDays: 20, proposal: '选用天然山毛榉木，手工锯切并逐级打磨表面，最后进行木蜡油养护，制作前与买家确认字体和位置。', additionalAgreement: '', imageIds: [] })).status()).toBe(201)
    await page.goto(`/requests/${draft.id}/quotes`)
    const table = page.getByRole('table', { name: '报价方案对比' })
    const creatorHeaders = table.getByRole('columnheader').filter({ has: page.getByRole('link') })
    const comparisonRow = (name: string) => table.getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) })
    const firstSelect = comparisonRow('有效期与定标').getByRole('button', { name: '选择此方案', exact: true }).first()
    await expect(table).toHaveCount(1)
    await expect(page.getByText('有效报价 2 / 5', { exact: true })).toBeVisible()
    await expect(creatorHeaders).toHaveCount(2)
    await expect(creatorHeaders.first()).toContainText('木间新作')
    await expect(comparisonRow('商品成交金额').getByRole('cell').first()).toContainText('最低价')
    await expect(comparisonRow('创作者口碑').getByText('暂无评价', { exact: true })).toHaveCount(2)
    await page.getByLabel('报价排序', { exact: true }).selectOption('DURATION')
    await expect(creatorHeaders.first()).toContainText('山间器物')
    await expect(comparisonRow('工期与预计发货').getByRole('cell').first()).toContainText('最短工期')
    const ratingResponse = page.waitForResponse(response => new URL(response.url()).searchParams.get('sort') === 'RATING')
    await page.getByLabel('报价排序', { exact: true }).selectOption('RATING')
    expect((await ratingResponse).status()).toBe(200)
    await expect(creatorHeaders.first()).toContainText('山间器物')
    await firstSelect.click()
    await expect(page.getByText('没有可用地址，请先添加收货地址。', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '确认定标并生成订单', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '返回比较', exact: true }).click()
    await page.setViewportSize({ width: 1366, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('multi-quote-comparison.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await first.goto(`/requests/${draft.id}/quotes`)
    await expect(first.getByRole('alert').first()).toBeVisible()
    await expect(first.getByRole('table', { name: '报价方案对比' })).toHaveCount(0)
    expect((await first.request.get(`${api}/custom-requests/${draft.id}/quote-comparison`)).status()).toBe(404)
    const privateQuotes = (await (await first.request.get(`${api}/custom-requests/${draft.id}/quotes`)).json()).data
    expect(privateQuotes.total).toBe(1)
    expect(privateQuotes.items[0].goodsAmount).toBe('180.00')
    await page.setViewportSize({ width: 1366, height: 900 })
    const address = await mutate(page, '/me/addresses', { recipientName: '比较收件人', phone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', detailAddress: '手作测试路二号', isDefault: true })
    expect(address.status()).toBe(201)
    await firstSelect.click()
    await expect(page.getByRole('region', { name: '定标确认' })).toContainText('山间器物')
    await expect(page.getByLabel('选择收货地址', { exact: true })).toHaveValue((await address.json()).data.id)
    await page.getByRole('button', { name: '确认定标并生成订单', exact: true }).click()
    await expect(page).toHaveURL(/\/orders\/\d+$/)
    const orderId = page.url().split('/').at(-1)!
    const order = (await (await page.request.get(`${api}/orders/${orderId}`)).json()).data
    expect(order.conversationId).toBe(winnerConversationId)
    await page.getByRole('link', { name: '进入订单沟通', exact: true }).click()
    await expect(page).toHaveURL(`/messages/conversations/${winnerConversationId}`)
    await expect(page.getByRole('log')).toContainText(winnerHistory)
    await page.getByLabel('沟通内容', { exact: true }).fill('确认合作后继续在这里沟通。')
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    await expect(page.getByRole('log')).toContainText('确认合作后继续在这里沟通。')
    await second.goto(`/messages/conversations/${loserConversationId}`)
    await expect(second.getByRole('log')).toContainText(loserHistory)
    await expect(second.getByText(/会话已归档.*仅可查看历史/)).toBeVisible()
    await expect(second.getByLabel('沟通内容', { exact: true })).toHaveCount(0)
    expect((await mutate(second, `/conversations/${loserConversationId}/messages`, { clientMessageKey: randomUUID(), content: '落选后的消息应被拒绝。', imageIds: [] })).status()).toBe(409)
    await page.goto(`/requests/${draft.id}/quotes`)
    await expect(page.getByText('有效报价 0 / 5', { exact: true })).toBeVisible()
    await page.getByLabel('历史报价状态', { exact: true }).selectOption('AWARDED')
    await expect(page.locator('.quote-record')).toContainText('山间器物')
    await page.getByLabel('历史报价状态', { exact: true }).selectOption('LOST')
    await expect(page.locator('.quote-record')).toContainText('木间新作')
  } finally { for (const context of contexts) await context.close() }
})
