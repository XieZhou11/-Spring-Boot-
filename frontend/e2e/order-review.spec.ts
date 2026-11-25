import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { api, image, mutate, origin, prepareCreator, register } from './custom-request-support'
import { expect, test } from './fixtures'
import { refundOrder } from './refund-support'
import type { OrderVO } from '../src/types/quote'
import type { RefundApplicationVO } from '../src/types/refund'

test.use({ storageMode: 'receiver', actionTimeout: 10_000 })

/** 使用真实现货作品、审核和订单接口准备已收货订单。 */
async function completedStock(buyer: Page, creator: Page, admin: Page, categoryId: string) {
  const csrf = (await (await creator.request.get(`${api}/csrf`)).json()).data
  const upload = await creator.request.post(`${api}/work-images`, {
    headers: { [csrf.headerName]: csrf.token },
    multipart: { file: { name: 'stock.png', mimeType: 'image/png', buffer: image } },
  })
  expect(upload.status()).toBe(201)
  const work = {
    title: '评价验收现货杯垫', categoryId, description: '保留天然木纹的手工杯垫，尺寸适合日常茶具，边缘打磨圆润。',
    mainImageIds: [(await upload.json()).data.id], specificationImageIds: [], material: '天然胡桃木',
    specification: '直径十厘米', processDescription: '', saleEnabled: true, customEnabled: false,
    stockPrice: '180.00', customReferenceDays: null,
  }
  const draft = await mutate(creator, '/me/works', { ...work, requestKey: randomUUID() })
  expect(draft.status()).toBe(201)
  const { id, version } = (await draft.json()).data
  const submitted = await mutate(creator, `/me/works/${id}/submission`, { ...work, version }, 'put')
  expect(submitted.status()).toBe(200)
  expect((await mutate(admin, `/admin/works/${id}/review`, { version: (await submitted.json()).data.version, decision: 'APPROVED', reason: '' }, 'put')).status()).toBe(200)
  const address = await mutate(buyer, '/me/addresses', {
    recipientName: '评价验收买家', phone: '13800138000', province: '北京市', city: '市辖区', district: '东城区',
    detailAddress: '评价验收路一号', isDefault: true,
  })
  expect(address.status()).toBe(201)
  const ordered = await mutate(buyer, `/works/${id}/orders`, { requestKey: randomUUID(), addressId: (await address.json()).data.id })
  expect(ordered.status()).toBe(201)
  const order = (await ordered.json()).data as OrderVO
  const preview = order.paymentPreview!
  expect((await mutate(buyer, `/orders/${order.id}/payment`, { termsConfirmed: true, termsVersion: preview.termsVersion, confirmedShipDate: preview.shipDate }, 'put')).status()).toBe(201)
  expect((await mutate(creator, `/orders/${order.id}/shipment`, { requestKey: randomUUID(), trackingNo: 'REVIEW2026112501', content: '', imageIds: [] }, 'put')).status()).toBe(201)
  expect((await mutate(buyer, `/orders/${order.id}/receipt`, undefined, 'put')).status()).toBe(201)
  return order
}

/** 买家使用同一个真实订单在售后与评价之间切换。 */
async function requestRefund(buyer: Page, orderId: string) {
  const response = await mutate(buyer, `/orders/${orderId}/refund-applications`, {
    requestKey: randomUUID(), reasonCode: 'QUALITY', description: '实际成品边缘存在开裂，已通过订单会话与创作者沟通质量与退回问题。', imageIds: [],
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as RefundApplicationVO
}

test('定制与现货图文评价、未知结果只读核验和退款后的公开口碑', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(150_000)
  const creatorContext = await browser.newContext({ baseURL: origin })
  const adminContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const admin = await adminContext.newPage()
    const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '图文评价买家')
    const custom = await refundOrder(page, creator, categoryId, '定制图文评价验收书签')
    expect((await mutate(page, `/orders/${custom.id}/receipt`, undefined, 'put')).status()).toBe(201)
    await page.goto(`/orders/${custom.id}`)
    const panel = page.getByRole('region', { name: '订单评价' })
    const submit = panel.getByRole('button', { name: '提交评价', exact: true })
    const customReview = '成品刻字清晰，但边缘有细小开裂，整体体验仍有改善空间。'
    await panel.getByLabel('交易体验').fill(customReview)
    await panel.getByRole('radio', { name: '2 星', exact: true }).check()
    const initialRefund = await requestRefund(page, custom.id)
    await page.evaluate(() => window.dispatchEvent(new Event('order-updated')))
    await expect(panel.getByText('售后处理中，暂不可提交评价。')).toBeVisible()
    await expect(submit).toHaveCount(0)
    expect((await mutate(page, `/refund-applications/${initialRefund.id}/withdrawal`, undefined, 'put')).status()).toBe(200)
    await page.evaluate(() => window.dispatchEvent(new Event('order-updated')))
    await expect(panel.getByLabel('交易体验')).toHaveValue(customReview)
    await expect(panel.getByRole('radio', { name: '2 星', exact: true })).toBeChecked()
    await panel.getByLabel('评价图片', { exact: false }).setInputFiles({ name: 'review.png', mimeType: 'image/png', buffer: image })
    await expect(panel.getByRole('img', { name: '待提交的评价图片 1' })).toBeVisible()
    await panel.screenshot({ path: testInfo.outputPath('review-order-form.png') })
    await submit.click()
    await expect(panel.getByText(customReview, { exact: true })).toBeVisible()
    await expect(panel.getByRole('img', { name: '评价图片 1', exact: true })).toBeVisible()
    await expect(submit).toHaveCount(0)

    const stock = await completedStock(page, creator, admin, categoryId)
    await page.goto(`/orders/${stock.id}`)
    const stockReview = '现货杯垫尺寸与展示一致，包装完整，木纹自然细腻。'
    await panel.getByLabel('交易体验').fill(stockReview)
    await panel.getByRole('radio', { name: '5 星', exact: true }).check()
    let writes = 0
    let failVerification = true
    await page.route(`${api}/orders/${stock.id}/reviews`, async route => {
      writes++
      const response = await route.fetch()
      expect(response.status()).toBe(201)
      await route.abort('failed')
    })
    await page.route(`${api}/orders/${stock.id}/review`, async route => {
      if (failVerification && writes > 0) await route.abort('failed')
      else await route.continue()
    })
    await submit.click()
    const verify = panel.getByRole('button', { name: '核验评价结果' })
    await expect(verify).toBeVisible()
    await expect(panel.getByLabel('交易体验')).toHaveValue(stockReview)
    await expect(submit).toBeDisabled()
    failVerification = false
    await verify.click()
    await expect(panel.getByText(stockReview, { exact: true })).toBeVisible()
    expect(writes).toBe(1)

    const profileUrl = `/creators/${custom.creatorId}`
    // 用真实服务端分页的一条页容量模拟已有多页公开评价，仍由数据库决定内容和统计。
    await page.route(url => url.pathname === `/api/creators/${custom.creatorId}/reviews`, async route => {
      const url = new URL(route.request().url())
      url.searchParams.set('size', '1')
      await route.continue({ url: url.toString() })
    })
    await page.goto(profileUrl)
    const stats = page.locator('.creator-public-stats')
    const publicReviews = page.getByRole('region', { name: '交易评价' })
    await expect(stats.getByText('3.5', { exact: true })).toBeVisible()
    await expect(stats.getByText(/50(?:\.0)?%/)).toBeVisible()
    await expect(publicReviews.getByText(stockReview, { exact: true })).toBeVisible()
    const reviewPages = publicReviews.getByRole('navigation', { name: '评价分页' })
    await reviewPages.getByRole('button', { name: '下一页' }).click()
    await expect(publicReviews.getByText(customReview, { exact: true })).toBeVisible()
    await expect(publicReviews.getByRole('img', { name: '订单评价图片 1', exact: true })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await publicReviews.screenshot({ path: testInfo.outputPath('public-reviews-390.png') })

    const finalRefund = await requestRefund(page, custom.id)
    const approved = await mutate(admin, `/admin/refund-applications/${finalRefund.id}/decision`, {
      expectedVersion: finalRefund.version, decision: 'APPROVE', reason: '已核实图文和会话，确认成品质量问题，批准退款。',
      returnRequired: false, returnedConfirmed: false, returnEvidenceImageIds: [],
      noReturnBasis: '双方在会话中确认原成品损坏，创作者已同意免退。',
    }, 'put')
    expect(approved.status()).toBe(200)
    await page.reload()
    await expect(stats.getByText('5.0', { exact: true })).toBeVisible()
    await expect(stats.getByText(/100(?:\.0)?%/)).toBeVisible()
    await expect(stats.getByText('1', { exact: true })).toHaveCount(2)
    await expect(publicReviews.getByText(customReview, { exact: true })).toHaveCount(0)
    await expect(reviewPages).toHaveCount(0)

    await page.goto(`/orders/${custom.id}`)
    await expect(panel.getByText(customReview, { exact: true })).toBeVisible()
    await expect(submit).toHaveCount(0)
    await creator.goto(`/orders/${custom.id}`)
    await expect(creator.getByRole('region', { name: '订单评价' }).getByText(customReview, { exact: true })).toBeVisible()
  } finally {
    await creatorContext.close()
    await adminContext.close()
  }
})

test('混合举报队列分流评价裁定、恢复口碑并通知关联用户', async ({ page, browser, mailbox }) => {
  test.setTimeout(150_000)
  const creatorContext = await browser.newContext({ baseURL: origin })
  const adminContext = await browser.newContext({ baseURL: origin })
  const visitorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const admin = await adminContext.newPage()
    const visitor = await visitorContext.newPage()
    const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '评价处置买家')
    await register(visitor, mailbox.codes, '评价处置访客')
    const order = await completedStock(page, creator, admin, categoryId)
    const content = '杯垫整体符合约定，期待创作者继续推出更多花样。'
    const review = await mutate(page, `/orders/${order.id}/reviews`, { rating: 3, content, imageIds: [] })
    expect(review.status()).toBe(201)
    const reviewId = (await review.json()).data.id
    const profile = `/creators/${order.creatorId}`
    await visitor.goto(profile)
    const region = visitor.getByRole('region', { name: '交易评价' })
    await region.getByRole('button', { name: '举报评价', exact: true }).click()
    const description = '请结合实际交易和公开记录核查这条评价。'
    await region.getByLabel('说明', { exact: true }).fill(description)
    await visitor.route(url => url.pathname === `/api/reviews/${reviewId}/reports`, async route => {
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      await route.abort('failed')
    }, { times: 1 })
    await region.getByRole('button', { name: '提交举报', exact: true }).click()
    await expect(region.getByLabel('说明', { exact: true })).toHaveValue(description)
    await region.getByRole('button', { name: '核对材料' }).click()
    await expect(region.getByText('已核对到提交的举报。')).toBeVisible()
    await visitor.goto('/me/reports')
    await visitor.getByRole('article').filter({ hasText: description }).getByRole('link', { name: '查看详情', exact: true }).click()
    await expect(visitor).toHaveURL(/\/review-reports\/\d+$/)
    const reportId = visitor.url().split('/').at(-1)!
    await visitor.getByRole('button', { name: '补充证据', exact: true }).click()
    await visitor.getByLabel('材料说明', { exact: true }).fill('补充订单评价截图相关说明。')
    await visitor.getByRole('button', { name: '提交补充证据', exact: true }).click()
    await expect(visitor.getByText('补充订单评价截图相关说明。')).toBeVisible()

    await admin.goto('/admin/content-reports?status=PENDING&type=REVIEW')
    await admin.getByRole('button', { name: /举报评价/ }).filter({ hasText: content }).click()
    await expect(admin).toHaveURL(new RegExp(`/admin/review-reports\\?.*reportId=${reportId}`))
    await expect(admin.getByRole('link', { name: order.orderNo })).toHaveAttribute('href', `/admin/orders?orderId=${order.id}`)
    await expect(admin.getByRole('button', { name: '更正并恢复评价' })).toHaveCount(0)
    await admin.getByLabel('处理依据', { exact: true }).fill('核查发现评价与交易记录不符，暂予隐藏。')
    await admin.getByRole('button', { name: '隐藏评价', exact: true }).click()
    await expect(admin.getByText('HIDDEN', { exact: true })).toBeVisible()
    await visitor.goto(profile)
    await expect(region.getByText(content, { exact: true })).toHaveCount(0)
    await expect(region.getByText('0 条有效评价')).toBeVisible()
    await creator.goto('/messages/notifications')
    const reviewNotice = creator.getByRole('article').filter({ hasText: '评价举报已处理' })
    await reviewNotice.getByRole('button', { name: '查看举报', exact: true }).click()
    await expect(creator).toHaveURL(new RegExp(`/review-reports/${reportId}$`))
    await expect(creator.getByRole('button', { name: '对处置结论提出异议' })).toBeVisible()

    await admin.getByLabel('处理依据', { exact: true }).fill('补充证据证明属于有效交易评价，予以恢复。')
    await admin.getByRole('button', { name: '更正并恢复评价' }).click()
    await expect(admin.getByText('VISIBLE', { exact: true })).toBeVisible()
    await admin.getByRole('link', { name: '返回内容举报' }).click()
    await expect(admin.getByRole('combobox', { name: '举报类型筛选' })).toHaveValue('REVIEW')
    await expect(admin.getByRole('combobox', { name: '举报状态筛选' })).toHaveValue('PENDING')
    await visitor.reload()
    await expect(region.getByText(content, { exact: true })).toBeVisible()
    await expect(region.getByText('1 条有效评价')).toBeVisible()
  } finally {
    await visitorContext.close()
    await creatorContext.close()
    await adminContext.close()
  }
})
