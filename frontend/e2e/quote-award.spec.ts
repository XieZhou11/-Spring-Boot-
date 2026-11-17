import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { api, image, mutate, origin, prepareCreator, register } from './custom-request-support'

test.use({ storageMode: 'receiver', actionTimeout: 15_000 })

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
    await expect(page.getByText('待付款', { exact: true }).first()).toBeVisible()
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
    await expect(page.getByText('已取消', { exact: true }).first()).toBeVisible()
    const oldOrderReturned = page.waitForResponse(response => response.url().endsWith(`/api/orders/${orderId}`))
    releaseOldOrder(); await oldOrderReturned
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(page.getByText('已取消', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '取消订单', exact: true })).toHaveCount(0)
    await page.getByRole('link', { name: '进入订单沟通', exact: true }).click()
    await expect(page.getByLabel('沟通内容', { exact: true })).toBeEnabled()
    await page.getByLabel('沟通内容', { exact: true }).fill('订单取消后仍可核对方案历史。')
    await page.getByRole('button', { name: '发送消息', exact: true }).click()
    await expect(page.getByRole('log')).toContainText('订单取消后仍可核对方案历史。')
    await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '我的订单', exact: true }).click()
    await page.getByLabel('订单状态', { exact: true }).selectOption('CANCELLED')
    await expect(page.locator('.request-card')).toHaveCount(1)
    await expect(page.locator('.request-card')).toContainText('已取消')
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
  await page.getByLabel('订单身份', { exact: true }).selectOption('CREATOR')
  expect((await historyResponse).status()).toBe(200)
  await expect(page).toHaveURL('/orders?side=CREATOR')
  await expect(page.getByRole('heading', { name: '暂无订单', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

/** 同一主品类的第二位真实认证创作者，图片与申请材料均由本人提交。 */
async function anotherCreator(page: Page, admin: Page, codes: Map<string, string>, categoryId: string) {
  await register(page, codes, '木间新作')
  const imageIds: string[] = []
  for (let index = 0; index < 6; index++) {
    const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
    const uploaded = await page.request.post(`${api}/creator-application-images`, { headers: { [csrf.headerName]: csrf.token }, multipart: { file: { name: 'creator.png', mimeType: 'image/png', buffer: image } } })
    expect(uploaded.status()).toBe(201)
    imageIds.push((await uploaded.json()).data.id)
  }
  const response = await mutate(page, '/me/creator-applications', { requestKey: randomUUID(), realName: '测试木匠', contactPhone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', categoryIds: [categoryId], experienceYears: 4, introduction: '专注于原创木作的手艺人，材料选用自然原木，每一件作品均经过手工锯切、打磨和上蜡，希望以耐用的手工器物陪伴生活。', originalWorks: [0, 1, 2].map(index => ({ finishedImageIds: [imageIds[index * 2]], processImageIds: [imageIds[index * 2 + 1]] })), alipayAccount: '13800138000', payeeName: '测试木匠', supportingDescription: '' })
  expect(response.status()).toBe(201)
  expect((await mutate(admin, `/admin/creator-applications/${(await response.json()).data.id}/review`, { decision: 'APPROVED', reason: '' }, 'put')).status()).toBe(200)
}

test('同表比较多份报价排序，无评价不计零分，创作者不可查看竞争方案', async ({ page, browser, mailbox }, testInfo) => {
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
    const firstQuote = await mutate(first, `/custom-requests/${draft.id}/quotes`, { requestKey: randomUUID(), goodsAmount: '180.00', durationDays: 10, proposal: '选用天然胡桃木，细致打磨并使用环保木蜡油，保留自然纹理，制作前提供草图确认尺寸和姓名刻印。', additionalAgreement: '', imageIds: [] })
    expect(firstQuote.status()).toBe(201)
    expect((await mutate(second, `/custom-requests/${draft.id}/quotes`, { requestKey: randomUUID(), goodsAmount: '120.00', durationDays: 20, proposal: '选用天然山毛榉木，手工锯切并逐级打磨表面，最后进行木蜡油养护，制作前与买家确认字体和位置。', additionalAgreement: '', imageIds: [] })).status()).toBe(201)
    await page.goto(`/requests/${draft.id}/quotes`)
    const rows = page.getByRole('table', { name: '报价方案对比' }).locator('tbody tr')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText('木间新作')
    await expect(rows.first()).toContainText('最低价')
    await expect(rows.locator('text=暂无评价')).toHaveCount(2)
    await page.getByLabel('报价排序', { exact: true }).selectOption('DURATION')
    await expect(rows.first()).toContainText('山间器物')
    await expect(rows.first()).toContainText('最短工期')
    await page.getByLabel('报价排序', { exact: true }).selectOption('RATING')
    await expect(rows.first()).toContainText('山间器物')
    await rows.first().getByRole('button', { name: '选择此方案', exact: true }).click()
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
  } finally { for (const context of contexts) await context.close() }
})
