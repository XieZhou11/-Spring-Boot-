import { api, origin } from './environment'
import { expect, test } from './fixtures'
import { image, mutate, publishWork, register } from './interaction-helpers'
import type { OrderVO } from '../src/types/quote'

test.use({ storageMode: 'receiver', actionTimeout: 15_000 })

test('已发货现货全额退款后仍已售出，创作者确认退回才能恢复直购', async ({ page: buyer, browser, mailbox }) => {
  test.setTimeout(240_000)
  const creatorContext = await browser.newContext({ baseURL: origin })
  const adminContext = await browser.newContext({ baseURL: origin })
  const nextBuyerContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const admin = await adminContext.newPage()
    const nextBuyer = await nextBuyerContext.newPage()
    const { workId } = await publishWork(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    const title = '山间手工木杯垫'
    await creator.goto(`/creator/works/${workId}/edit`)
    await creator.getByLabel('出售现货', { exact: true }).check()
    await creator.getByLabel('成品售价（元）', { exact: true }).fill('138.60')
    await creator.getByRole('button', { name: '即时更新交易设置', exact: true }).click()
    await expect(creator.getByRole('status')).toContainText('作品保持上架')

    for (const [page, nickname] of [[buyer, '首位售后买家'], [nextBuyer, '第二位现货买家']] as const) {
      await register(page, mailbox.codes, nickname)
      const address = await mutate(page, '/me/addresses', 'post', {
        recipientName: nickname, phone: '13800138000', province: '北京市', city: '市辖区',
        district: '东城区', detailAddress: '现货售后验收路一号', isDefault: true,
      })
      expect(address.status()).toBe(201)
    }

    // 从公开页建单、模拟支付，再由创作者从订单页发货。
    await buyer.goto(`/works/${workId}`)
    await buyer.getByRole('button', { name: '立即购买现货', exact: true }).click()
    await buyer.getByRole('dialog', { name: '确认现货直购订单' }).getByRole('button', { name: /^确认购买/ }).click()
    await expect(buyer).toHaveURL(/\/orders\/\d+$/)
    const orderPath = new URL(buyer.url()).pathname
    const order = (await (await buyer.request.get(`${api}${orderPath}`)).json()).data as OrderVO
    const originalImage = order.agreementSnapshot.mainImageIds?.[0]
    expect(originalImage).toBeTruthy()
    expect((await nextBuyer.request.get(`${api}${orderPath}/stock-images/${originalImage}`)).status()).toBe(404)
    await buyer.getByRole('button', { name: '模拟支付', exact: true }).click()
    await buyer.getByLabel('我已阅读并同意现货支付条款', { exact: true }).check()
    await buyer.getByRole('button', { name: '确认模拟支付', exact: true }).click()
    await expect(buyer.locator('.work-section-heading .work-status')).toHaveText('待发货')
    const paid = (await (await buyer.request.get(`${api}${orderPath}`)).json()).data as OrderVO
    expect(Date.parse(paid.shipDeadlineAt!) - Date.parse(paid.paidAt!)).toBe(48 * 60 * 60 * 1000)
    expect(paid.startDeadlineAt).toBeNull()
    await expect(buyer.locator(`.order-facts time[datetime="${paid.shipDeadlineAt}"]`)).toHaveText(/\d{2}:\d{2}:\d{2}/)
    await creator.goto(orderPath)
    await expect(creator.locator(`.order-facts time[datetime="${paid.shipDeadlineAt}"]`)).toHaveText(/\d{2}:\d{2}:\d{2}/)
    await creator.getByRole('button', { name: '填写运单并发货', exact: true }).click()
    await creator.getByLabel('运单号', { exact: true }).fill('STOCK2026112501')
    await creator.getByRole('button', { name: '确认发货', exact: true }).click()
    await expect(creator.locator('.work-section-heading .work-status')).toHaveText('已发货')
    await buyer.reload()
    await expect(buyer.locator('.work-section-heading .work-status')).toHaveText('已发货')

    const buyerPanel = buyer.getByRole('region', { name: '订单售后' })
    const creatorPanel = creator.getByRole('region', { name: '订单售后' })
    await buyerPanel.getByRole('button', { name: '申请普通退款', exact: true }).click()
    await buyerPanel.getByLabel('退款说明', { exact: true }).fill('成品边缘与约定不符，已和创作者沟通寄回商品，请核对图片并退还原实付金额。')
    await buyerPanel.getByLabel('售后凭证', { exact: true }).setInputFiles({ name: 'stock-refund.png', mimeType: 'image/png', buffer: image })
    await expect(buyerPanel.getByRole('button', { name: /^移除售后凭证/ })).toHaveCount(1)
    const applicationResponse = buyer.waitForResponse(response => response.url() === `${api}${orderPath}/refund-applications` && response.request().method() === 'POST')
    await buyerPanel.getByRole('button', { name: '确认申请全额退款', exact: true }).click()
    await buyer.getByRole('dialog').getByRole('button', { name: '确认申请', exact: true }).click()
    expect((await applicationResponse).status()).toBe(201)
    await expect(buyer.locator('.work-section-heading .work-status')).toHaveText('售后中')
    await expect(creator.locator('.work-section-heading .work-status')).toHaveText('售后中')
    await expect(buyer.getByRole('button', { name: '确认收货', exact: true })).toHaveCount(0)

    await buyerPanel.getByRole('button', { name: '追加售后证据', exact: true }).click()
    await buyerPanel.getByLabel('补充证据说明', { exact: true }).fill('退回运单已交给承运人，请创作者签收。')
    await buyerPanel.getByRole('button', { name: '提交补充证据', exact: true }).click()
    await expect(creatorPanel.getByText('退回运单已交给承运人，请创作者签收。', { exact: true })).toBeVisible()
    await creatorPanel.getByRole('button', { name: '追加售后证据', exact: true }).click()
    await creatorPanel.getByLabel('补充证据说明', { exact: true }).fill('已签收退回原成品，已检查实物。')
    await creatorPanel.getByRole('button', { name: '提交补充证据', exact: true }).click()
    await expect(buyerPanel.getByText('已签收退回原成品，已检查实物。', { exact: true })).toBeVisible()

    const current = (await (await buyer.request.get(`${api}${orderPath}`)).json()).data.currentRefund
    await admin.goto(`/admin/orders?orderId=${order.id}`)
    await expect(admin.getByRole('heading', { name: '会话摘要', exact: true })).toBeVisible()
    const summary = (await (await admin.request.get(`${api}/admin/orders/${order.id}`)).json()).data
    expect(summary.conversationSummary?.conversationId).toBe(order.conversationId)
    expect(summary.messages).toEqual([])
    expect(summary.refundApplicationId).toBe(current.id)
    await admin.getByRole('link', { name: '前往售后查证', exact: true }).click()
    await expect(admin).toHaveURL(new RegExp(`/admin/refunds/${current.id}(?:\\?|$)`))
    await expect(admin.getByRole('heading', { name: '现货作品快照' })).toBeVisible()
    const originalStockImage = admin.getByRole('img', { name: '成交主图 1', exact: true })
    await expect.poll(() => originalStockImage.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0)
    await expect(admin.getByText('制作节点与追加记录', { exact: true })).toHaveCount(0)
    const initialEvidence = admin.getByRole('region', { name: '售后初始申请' }).getByRole('img', { name: '初始售后凭证 1' })
    await expect(initialEvidence).toBeVisible()
    await expect.poll(() => initialEvidence.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    await expect(admin.getByRole('region', { name: '双方补证' })).toContainText('已签收退回原成品')

    const decision = admin.getByRole('region', { name: '管理员退款裁定' })
    await decision.getByLabel('裁定结果').selectOption('APPROVE')
    await decision.getByLabel('裁定原因').fill('核对了现货快照、双方补证及运单，确认原成品已退回，批准全额退款。')
    await decision.getByLabel('退货核查').selectOption('true')
    await decision.getByLabel('已核实原成品确已退回').check()
    await decision.getByLabel('退回运单号').fill('STOCKRETURN20261125')
    await decision.getByRole('button', { name: '已重新查阅当前材料' }).click()
    await expect(decision).toContainText('全额退款 ¥ 138.60')
    await decision.getByRole('button', { name: '确认裁定', exact: true }).click()
    await admin.getByRole('dialog').getByRole('button', { name: '确认裁定', exact: true }).click()
    await expect(admin.getByRole('region', { name: '售后处理结论' })).toContainText('STOCKRETURN20261125')
    await expect(buyer.locator('.work-section-heading .work-status')).toHaveText('已退款')
    await expect(buyer.getByRole('link', { name: '进入订单沟通', exact: true })).toBeVisible()
    await expect(creator.getByRole('region', { name: '结算信息' })).toContainText('已取消')
    const refunded = (await (await admin.request.get(`${api}/admin/orders/${order.id}`)).json()).data as {
      fundFlows: { type: string; amount: string }[]
    }
    expect(refunded.fundFlows.filter(flow => flow.type === 'PAYMENT')).toEqual([expect.objectContaining({ amount: '138.60' })])
    expect(refunded.fundFlows.filter(flow => flow.type === 'REFUND')).toEqual([expect.objectContaining({ amount: '138.60' })])
    expect(refunded.fundFlows.filter(flow => flow.type === 'SETTLEMENT')).toHaveLength(0)

    for (const page of [buyer, creator]) {
      await page.goto('/messages/notifications')
      const approved = page.locator('.notification-card').filter({ hasText: '售后申请已批准并全额退款' })
      await approved.getByRole('button', { name: '查看订单', exact: true }).click()
      await expect(page).toHaveURL(orderPath)
    }

    for (const participant of [buyer, creator]) {
      await participant.goto('/messages/notifications')
      const cancelled = participant.locator('.notification-card').filter({
        has: participant.getByRole('heading', { name: '订单待结算已取消', exact: true }),
      })
      await expect(cancelled).toHaveCount(1)
      if (participant === creator) await expect(cancelled).toContainText('138.60')
      else await expect(cancelled).not.toContainText('138.60')
      await cancelled.getByRole('button', { name: '查看订单', exact: true }).click()
      await expect(participant).toHaveURL(orderPath)
    }

    // 退款不补库存，恢复后新订单应使用新售价，旧订单仍保留原实付。
    await nextBuyer.goto(`/works/${workId}`)
    await expect(nextBuyer.getByText('现货已售出', { exact: true })).toBeVisible()
    await expect(nextBuyer.getByRole('button', { name: '立即购买现货', exact: true })).toHaveCount(0)
    await creator.goto('/creator/works')
    const workRow = creator.getByRole('row').filter({ hasText: title })
    await expect(workRow).toContainText('已售出')
    await workRow.getByRole('button', { name: '恢复直购', exact: true }).click()
    const recovery = creator.getByRole('dialog', { name: '恢复直购', exact: true })
    await expect(recovery).toContainText(order.orderNo)
    await expect(recovery.getByRole('button', { name: '确认恢复直购', exact: true })).toBeDisabled()
    await recovery.getByLabel('现货售价（元）', { exact: true }).fill('145.00')
    await recovery.getByLabel('我确认原成品已退回且仍可销售', { exact: true }).check()
    await recovery.getByRole('button', { name: '确认恢复直购', exact: true }).click()
    await expect(workRow).toContainText('可购买')
    await expect(workRow).toContainText('145.00')
    await nextBuyer.reload()
    await nextBuyer.getByRole('button', { name: '立即购买现货', exact: true }).click()
    await nextBuyer.getByRole('dialog', { name: '确认现货直购订单' }).getByRole('button', { name: /^确认购买/ }).click()
    await expect(nextBuyer).toHaveURL(/\/orders\/\d+$/)
    const nextOrderPath = new URL(nextBuyer.url()).pathname
    expect(nextOrderPath).not.toBe(orderPath)
    const nextOrder = await nextBuyer.request.get(`${api}${nextOrderPath}`)
    expect((await nextOrder.json()).data).toMatchObject({ orderType: 'STOCK', status: 'PENDING_PAY', totalAmount: '145.00' })
    expect((await (await buyer.request.get(`${api}${orderPath}`)).json()).data).toMatchObject({ status: 'REFUNDED', paidAmount: '138.60' })
  } finally {
    await Promise.all([creatorContext.close(), adminContext.close(), nextBuyerContext.close()])
  }
})
