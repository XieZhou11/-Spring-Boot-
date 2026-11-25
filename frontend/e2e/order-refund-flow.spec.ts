import { test, expect } from './fixtures'
import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { api, image, mutate, origin, prepareCreator, register } from './custom-request-support'
import { refundOrder } from './refund-support'
import type { AdminRefundDetailVO, RefundApplicationVO, RefundEvidenceVO } from '../src/types/refund'
import type { OrderVO } from '../src/types/quote'

test.use({ storageMode: 'receiver', actionTimeout: 15_000 })

const application = { description: '制作细节与原始约定存在差异，请管理员核查原始约定与照片。' }

/** 真实接口读取当前事实，浏览器流程不直接修改订单业务状态。 */
async function readOrder(page: Page, orderId: string): Promise<OrderVO> {
  const response = await page.request.get(`${api}/orders/${orderId}`)
  expect(response.status()).toBe(200)
  return (await response.json()).data
}

async function applyInBrowser(buyer: Page, description = application.description) {
  const panel = buyer.getByRole('region', { name: '订单售后' })
  await panel.getByRole('button', { name: '申请普通退款', exact: true }).click()
  await panel.getByLabel('退款说明', { exact: true }).fill(description)
  await panel.getByRole('button', { name: '确认申请全额退款', exact: true }).click()
  await expect(buyer.locator('.work-section-heading .work-status')).toHaveText('售后中')
}

/** 上传仍通过真实SDK协议接收器，仅用于准备应被管理员拒绝的临时图和会话图。 */
async function uploadImage(page: Page, path: string, name: string): Promise<string> {
  const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
  const response = await page.request.post(`${api}${path}`, { headers: { [csrf.headerName]: csrf.token }, multipart: { file: { name, mimeType: 'image/png', buffer: image } } })
  expect(response.status()).toBe(201)
  return (await response.json()).data.id
}

test.describe('真实订单普通售后', () => {
  test('双方图文补证、管理员版本冲突重阅、驳回恢复、撤回及退回核验退款', async ({ page, browser, mailbox }, testInfo) => {
    test.setTimeout(240_000)
    const creatorContext = await browser.newContext({ baseURL: origin }); const adminContext = await browser.newContext({ baseURL: origin })
    try {
      const creator = await creatorContext.newPage(); const admin = await adminContext.newPage()
      const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
      await register(page, mailbox.codes, '售后验收买家')
      const order = await refundOrder(page, creator, categoryId, '完整普通售后与管理员退款裁定')
      page.on('dialog', dialog => dialog.accept()); admin.on('dialog', dialog => dialog.accept())
      await page.goto(`/orders/${order.id}`); await creator.goto(`/orders/${order.id}`)
      const buyerPanel = page.getByRole('region', { name: '订单售后' }); const creatorPanel = creator.getByRole('region', { name: '订单售后' })
      await buyerPanel.getByRole('button', { name: '申请普通退款', exact: true }).click()
      await buyerPanel.getByLabel('退款说明', { exact: true }).fill(application.description)
      await buyerPanel.getByLabel('售后凭证', { exact: true }).setInputFiles({ name: 'refund.png', mimeType: 'image/png', buffer: image })
      await expect(buyerPanel.getByRole('button', { name: '确认申请全额退款', exact: true })).toBeEnabled()
      await buyerPanel.getByRole('button', { name: '确认申请全额退款', exact: true }).click()
      await expect(page.locator('.work-section-heading .work-status')).toHaveText('售后中')
      await expect(creator.locator('.work-section-heading .work-status')).toHaveText('售后中')
      await expect(page.getByRole('button', { name: '确认收货', exact: true })).toHaveCount(0)
      await expect(creator.getByRole('button', { name: '更正运单号', exact: true })).toHaveCount(0)
      await creatorPanel.getByRole('button', { name: '追加售后证据', exact: true }).click()
      await creatorPanel.getByLabel('售后凭证', { exact: true }).setInputFiles({ name: 'creator-evidence.png', mimeType: 'image/png', buffer: image })
      await expect(creatorPanel.getByRole('button', { name: '提交补充证据', exact: true })).toBeEnabled()
      await creatorPanel.getByRole('button', { name: '提交补充证据', exact: true }).click()
      await expect(buyerPanel.getByText('创作者追加证据')).toBeVisible()
      const current = (await (await page.request.get(`${api}/orders/${order.id}`)).json()).data.currentRefund as RefundApplicationVO
      await admin.goto(`/admin/refunds/${current.id}?status=WAIT_ADMIN&applicationType=NORMAL&orderNo=${order.orderNo}`)
      const decision = admin.getByRole('region', { name: '管理员退款裁定' })
      await expect(admin.getByRole('region', { name: '双方补证' }).getByText('创作者追加证据')).toBeVisible()
      await decision.getByLabel('裁定原因').fill('双方现有材料表明作品仍可按约履行，请继续原订单流程。')
      await decision.getByRole('button', { name: '已重新查阅当前材料' }).click()
      let first = true
      await admin.route(`${api}/admin/refund-applications/${current.id}/decision`, async route => {
        if (first) { first = false; const extra = await mutate(creator, `/refund-applications/${current.id}/evidence`, { requestKey: randomUUID(), content: '裁定前追加实际说明，管理员应重新核对当前材料。', imageIds: [] }); expect(extra.status()).toBe(201) }
        await route.continue()
      })
      await decision.getByRole('button', { name: '确认裁定', exact: true }).click()
      await expect(decision.getByRole('button', { name: '确认裁定', exact: true })).toBeDisabled()
      await expect(decision.getByLabel('裁定原因')).toHaveValue('双方现有材料表明作品仍可按约履行，请继续原订单流程。')
      await expect(admin.getByRole('region', { name: '双方补证' })).toContainText('裁定前追加实际说明')
      await decision.getByRole('button', { name: '已重新查阅当前材料' }).click()
      await decision.getByRole('button', { name: '确认裁定', exact: true }).click()
      await expect(page.locator('.work-section-heading .work-status')).toHaveText('已发货')
      const restored = (await (await page.request.get(`${api}/orders/${order.id}`)).json()).data
      expect(restored.shippedAt).toBe(order.shippedAt); expect(Date.parse(restored.autoConfirmAt)).toBeGreaterThan(Date.parse(order.autoConfirmAt!))
      // 驳回后新申请再撤回，证明原申请保留、恢复状态且不重开窗口。
      await buyerPanel.getByRole('button', { name: '申请普通退款', exact: true }).click(); await buyerPanel.getByLabel('退款说明', { exact: true }).fill('补充核查原始约定与商品实际情况，先申请管理员再次核对双方材料。'); await buyerPanel.getByRole('button', { name: '确认申请全额退款', exact: true }).click()
      await buyerPanel.getByRole('button', { name: '撤回退款申请', exact: true }).click()
      await expect(page.locator('.work-section-heading .work-status')).toHaveText('已发货')
      await applyInBrowser(page, '原成品已协商退回，需要管理员核查退回运单与双方证据后执行全额退款。')
      const finalApplication = (await (await page.request.get(`${api}/orders/${order.id}`)).json()).data.currentRefund as RefundApplicationVO
      await admin.goto(`/admin/refunds/${finalApplication.id}?orderNo=${order.orderNo}`)
      await decision.getByLabel('裁定结果').selectOption('APPROVE'); await decision.getByLabel('裁定原因').fill('已核实原成品退回，依据交易约定批准退还原实付金额。'); await decision.getByLabel('退货核查').selectOption('true')
      await decision.getByRole('button', { name: '已重新查阅当前材料' }).click()
      await decision.getByRole('button', { name: '确认裁定', exact: true }).click(); await expect(admin.getByRole('alert')).toContainText('必须确认原成品已退回')
      await decision.getByLabel('已核实原成品确已退回').check(); await decision.getByLabel('退回运单号').fill('RETURN20261119001')
      await admin.route(`${api}/admin/refund-applications/${finalApplication.id}/decision`, async route => { const response = await route.fetch(); expect(response.status()).toBe(200); await route.abort() })
      await decision.getByRole('button', { name: '确认裁定', exact: true }).click()
      await expect(admin.getByText('已精确核验原管理员及完整裁定参数，原裁定提交成功。')).toBeVisible()
      await expect(page.locator('.work-section-heading .work-status')).toHaveText('已退款')
      await expect(creator.locator('.work-section-heading .work-status')).toHaveText('已退款')
      const final = (await (await creator.request.get(`${api}/orders/${order.id}`)).json()).data
      expect(final.settlement.status).toBe('CANCELLED'); expect(final.settlement.paidAmount).toBe('180.00')
      await expect(page.getByRole('link', { name: '进入订单沟通', exact: true })).toBeVisible()
      await admin.setViewportSize({ width: 1366, height: 1000 })
      await admin.getByRole('region', { name: '售后处理结论' }).scrollIntoViewIfNeeded()
      await admin.screenshot({ path: testInfo.outputPath('refund-returned-decision.png') })
    } finally { await creatorContext.close(); await adminContext.close() }
  })

  test('已付款双方证据边界、管理员私图及聊天只读查证后免退批准', async ({ page, browser, mailbox }, testInfo) => {
    test.setTimeout(240_000)
    const creatorContext = await browser.newContext({ baseURL: origin }); const adminContext = await browser.newContext({ baseURL: origin })
    try {
      const creator = await creatorContext.newPage(); const admin = await adminContext.newPage()
      const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
      await register(page, mailbox.codes, '补证边界买家')
      const order = await refundOrder(page, creator, categoryId, '未开工普通售后图文证据验收', false)
      page.on('dialog', dialog => dialog.accept()); admin.on('dialog', dialog => dialog.accept())
      await page.goto(`/orders/${order.id}`); await creator.goto(`/orders/${order.id}`)
      const buyerPanel = page.getByRole('region', { name: '订单售后' }); const sellerPanel = creator.getByRole('region', { name: '订单售后' })
      await buyerPanel.getByRole('button', { name: '申请普通退款', exact: true }).click()
      await buyerPanel.getByLabel('退款说明', { exact: true }).fill('核'.repeat(19))
      await buyerPanel.getByRole('button', { name: '确认申请全额退款', exact: true }).click()
      await expect(buyerPanel.getByRole('alert')).toContainText('20—500')
      expect((await readOrder(page, order.id)).status).toBe('PAID')
      const upload = buyerPanel.getByLabel('售后凭证', { exact: true })
      const files = Array.from({ length: 4 }, (_, i) => ({ name: `initial-${i}.png`, mimeType: 'image/png', buffer: image }))
      await upload.setInputFiles(files)
      await expect(buyerPanel.getByRole('alert').filter({ hasText: '最多上传' })).toHaveText('最多上传 3 张图片')
      await upload.setInputFiles(files.slice(0, 3))
      await expect(buyerPanel.getByRole('button', { name: /^移除售后凭证/ })).toHaveCount(3)
      await expect(upload).toBeDisabled()
      await buyerPanel.getByLabel('退款说明', { exact: true }).fill('核'.repeat(20))
      await buyerPanel.getByRole('button', { name: '确认申请全额退款', exact: true }).click()
      await expect(page.locator('.work-section-heading .work-status')).toHaveText('售后中')
      await expect(creator.locator('.work-section-heading .work-status')).toHaveText('售后中')
      const current = (await readOrder(page, order.id)).currentRefund!
      expect(current.originalOrderStatus).toBe('PAID'); expect(current.imageIds).toHaveLength(3)
      await expect(creator.getByRole('button', { name: '确认开工', exact: true })).toHaveCount(0)

      await buyerPanel.getByRole('button', { name: '追加售后证据', exact: true }).click()
      await buyerPanel.getByRole('button', { name: '提交补充证据', exact: true }).click()
      await expect(buyerPanel.getByRole('alert')).toContainText('至少一项')
      const boundaryText = '证'.repeat(500)
      await buyerPanel.getByLabel('补充证据说明', { exact: true }).fill(boundaryText)
      await buyerPanel.getByLabel('售后凭证', { exact: true }).setInputFiles(files.slice(0, 3).map(file => ({ ...file, name: `evidence-${file.name}` })))
      await expect(buyerPanel.getByRole('button', { name: /^移除售后凭证/ })).toHaveCount(3)
      await expect(buyerPanel.getByRole('button', { name: '提交补充证据', exact: true })).toBeEnabled()
      await buyerPanel.getByRole('button', { name: '提交补充证据', exact: true }).click()
      await expect(sellerPanel.getByText(boundaryText, { exact: true })).toBeVisible()
      await sellerPanel.getByRole('button', { name: '追加售后证据', exact: true }).click()
      await sellerPanel.getByLabel('售后凭证', { exact: true }).setInputFiles({ name: 'pure-image.png', mimeType: 'image/png', buffer: image })
      await expect(sellerPanel.getByRole('button', { name: '提交补充证据', exact: true })).toBeEnabled()
      await sellerPanel.getByRole('button', { name: '提交补充证据', exact: true }).click()
      await expect(buyerPanel.getByText('创作者追加证据', { exact: true })).toBeVisible()
      const evidence = (await (await page.request.get(`${api}/refund-applications/${current.id}/evidence`)).json()).data.items as RefundEvidenceVO[]
      expect(evidence).toHaveLength(2); expect(evidence[0]!.content).toHaveLength(500); expect(evidence[0]!.imageIds).toHaveLength(3)
      expect(evidence[1]!.content).toBe(''); expect(evidence[1]!.imageIds).toHaveLength(1)
      expect((await mutate(page, `/refund-applications/${current.id}/evidence`, { requestKey: randomUUID(), content: '证'.repeat(501), imageIds: [] })).status()).toBe(400)
      expect((await mutate(page, `/refund-applications/${current.id}/evidence`, { requestKey: randomUUID(), content: '', imageIds: [...current.imageIds, current.imageIds[0]] })).status()).toBe(400)
      const latest = (await (await page.request.get(`${api}/refund-applications/${current.id}`)).json()).data as RefundApplicationVO
      expect(latest.version).toBe(2)

      const chatImage = await uploadImage(page, `/conversations/${order.conversationId}/images`, 'chat-evidence.png')
      const message = await mutate(page, `/conversations/${order.conversationId}/messages`, { clientMessageKey: randomUUID(), content: '尚未开工，沟通中确认原方案的差异，请管理员只读查证。', imageIds: [chatImage] })
      expect(message.status()).toBe(201)
      // 每位参与方只发送十余条消息，保持真实限流下的两页会话。
      for (let index = 1; index <= 20; index++) {
        const sender = index % 2 ? creator : page
        const response = await mutate(sender, `/conversations/${order.conversationId}/messages`, {
          clientMessageKey: randomUUID(), content: `售后沟通记录 ${index}，用于核对双方说明。`, imageIds: [],
        })
        expect(response.status()).toBe(201)
      }
      const cursors = async () => Promise.all([page, creator].map(async actor =>
        (await (await actor.request.get(`${api}/conversations/${order.conversationId}`)).json()).data.readSeq))
      const beforeRead = await cursors()
      const unreadBefore = (await (await creator.request.get(`${api}/me/conversations/unread-count`)).json()).data.count
      expect(unreadBefore).toBeGreaterThan(0)
      const temporary = await uploadImage(page, `/orders/${order.id}/refund-images`, 'not-submitted.png')
      expect([403, 404]).toContain((await page.request.get(`${api}/admin/refund-applications/${current.id}`)).status())
      expect([403, 404]).toContain((await admin.request.get(`${api}/admin/refund-applications/${current.id}/images/${temporary}`)).status())
      await admin.goto(`/admin/refunds/${current.id}?orderNo=${order.orderNo}`)
      await expect(admin.getByRole('region', { name: '售后初始申请' }).getByRole('img')).toHaveCount(3)
      await expect(admin.getByRole('region', { name: '双方补证' }).getByRole('img')).toHaveCount(4)
      await admin.getByText('原订单会话（只读）', { exact: true }).click()
      const chat = admin.locator('.refund-readonly-chat')
      await expect(chat).toContainText('售后沟通记录 20')
      await expect(chat).not.toContainText('尚未开工，沟通中确认原方案的差异')
      await admin.getByRole('button', { name: '读取更早会话', exact: true }).click()
      await expect(chat.getByText('尚未开工，沟通中确认原方案的差异，请管理员只读查证。', { exact: true })).toHaveCount(1)
      await expect(chat.getByRole('img', { name: '会话凭证 1', exact: true })).toBeVisible()
      await expect.poll(() => chat.getByRole('img', { name: '会话凭证 1', exact: true }).evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0)
      await expect(admin.getByLabel('沟通内容', { exact: true })).toHaveCount(0)
      await expect(admin.getByRole('button', { name: '发送消息', exact: true })).toHaveCount(0)
      expect(await cursors()).toEqual(beforeRead)
      expect((await (await creator.request.get(`${api}/me/conversations/unread-count`)).json()).data.count).toBe(unreadBefore)
      const signed = await admin.request.get(`${api}/admin/refund-applications/${current.id}/images/${chatImage}`)
      expect(signed.status()).toBe(200)

      const decision = admin.getByRole('region', { name: '管理员退款裁定' })
      await decision.getByLabel('裁定结果').selectOption('APPROVE')
      await decision.getByLabel('裁定原因').fill('已核对原方案、双方证据及会话，未发货订单批准退还原实付。')
      await expect(decision.getByLabel('退货核查')).toHaveCount(0)
      await decision.getByRole('button', { name: '已重新查阅当前材料' }).click()
      await expect(decision).toContainText('全额退款 ¥ 180.00')
      await decision.getByRole('button', { name: '确认裁定', exact: true }).click()
      await expect(page.locator('.work-section-heading .work-status')).toHaveText('已退款')
      await expect(creator.locator('.work-section-heading .work-status')).toHaveText('已退款')
      const result = (await (await admin.request.get(`${api}/admin/refund-applications/${current.id}`)).json()).data as AdminRefundDetailVO
      expect(result.application.status).toBe('REFUNDED'); expect(result.application.returnRequired).toBe(false)
      expect(result.application.noReturnBasis).toContain('从未发货')
      expect(result.order.payment?.amount).toBe('180.00'); expect(result.order.settlement?.status).toBe('CANCELLED')
      expect((await readOrder(page, order.id)).settlement).toBeNull()
      await expect(buyerPanel.getByRole('button', { name: '追加售后证据', exact: true })).toHaveCount(0)
      await expect(buyerPanel.getByRole('link', { name: '进入原订单会话 ↗', exact: true })).toBeVisible()
      await admin.setViewportSize({ width: 1366, height: 1000 })
      await admin.getByRole('region', { name: '双方补证' }).scrollIntoViewIfNeeded()
      await admin.screenshot({ path: testInfo.outputPath('refund-admin-evidence.png') })
      await admin.getByRole('region', { name: '售后处理结论' }).scrollIntoViewIfNeeded()
      await admin.screenshot({ path: testInfo.outputPath('refund-admin-unshipped-decision.png') })
      await page.setViewportSize({ width: 1366, height: 1000 })
      await buyerPanel.evaluate(node => node.scrollIntoView({ block: 'start' }))
      await page.screenshot({ path: testInfo.outputPath('refund-buyer-history.png') })
    } finally { await creatorContext.close(); await adminContext.close() }
  })

  test('已完成售后撤回和驳回保留原完成时间，原窗口过期后禁止重开', async ({ page, browser, mailbox }) => {
    test.setTimeout(240_000)
    const creatorContext = await browser.newContext({ baseURL: origin }); const adminContext = await browser.newContext({ baseURL: origin })
    try {
      const creator = await creatorContext.newPage(); const admin = await adminContext.newPage()
      const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
      await register(page, mailbox.codes, '完成窗口验收买家')
      const order = await refundOrder(page, creator, categoryId, '完成时间不得因售后恢复重开')
      page.on('dialog', dialog => dialog.accept()); admin.on('dialog', dialog => dialog.accept())
      await page.goto(`/orders/${order.id}`)
      await page.getByRole('button', { name: '确认收货', exact: true }).click()
      await expect(page.locator('.work-section-heading .work-status')).toHaveText('已完成')
      const original = await readOrder(page, order.id)
      expect(original.originalCompletedAt).toBeTruthy(); expect(original.refundWindowEndsAt).toBeTruthy()
      const panel = page.getByRole('region', { name: '订单售后' })
      await applyInBrowser(page)
      await panel.getByRole('button', { name: '撤回退款申请', exact: true }).click()
      await expect(page.locator('.work-section-heading .work-status')).toHaveText('已完成')
      const withdrawn = await readOrder(page, order.id)
      expect(withdrawn.originalCompletedAt).toBe(original.originalCompletedAt); expect(withdrawn.refundWindowEndsAt).toBe(original.refundWindowEndsAt)
      await applyInBrowser(page, '收到作品后补充请求核对原方案，售后窗口应始终从最初确认完成时间起算。')
      const current = (await readOrder(page, order.id)).currentRefund!
      expect(current.originalOrderStatus).toBe('COMPLETED')
      await admin.goto(`/admin/refunds/${current.id}?orderNo=${order.orderNo}`)
      const decision = admin.getByRole('region', { name: '管理员退款裁定' })
      await decision.getByLabel('裁定原因').fill('双方交付与原方案一致，证据不足以支持全额退款，恢复原完成状态。')
      await decision.getByRole('button', { name: '已重新查阅当前材料' }).click()
      await decision.getByRole('button', { name: '确认裁定', exact: true }).click()
      await expect(page.locator('.work-section-heading .work-status')).toHaveText('已完成')
      const rejected = await readOrder(page, order.id)
      expect(rejected.originalCompletedAt).toBe(original.originalCompletedAt); expect(rejected.refundWindowEndsAt).toBe(original.refundWindowEndsAt)
      // 仅在隔离数据库移动时间边界；业务完成/恢复状态始终由真实接口产生。
      await mailbox.expireFulfillmentBoundary(order.id, 'COMPLETION')
      await page.reload()
      const expired = await readOrder(page, order.id)
      expect(expired.canRequestRefund).toBe(false)
      await expect(panel.getByRole('button', { name: '申请普通退款', exact: true })).toHaveCount(0)
      const history = (await (await page.request.get(`${api}/orders/${order.id}/refund-applications`)).json()).data.items as RefundApplicationVO[]
      expect(history.map(row => row.status).sort()).toEqual(['REJECTED', 'WITHDRAWN'])
      await expect(panel).toContainText('不重开原申请期限')
      expect((await mutate(page, `/orders/${order.id}/refund-applications`, { requestKey: randomUUID(), reasonCode: 'OTHER', description: application.description, imageIds: [] })).status()).toBe(409)
    } finally { await creatorContext.close(); await adminContext.close() }
  })

  test('曾发货订单批准免退必须填写依据，保存服务端退款和核实结论', async ({ page, browser, mailbox }) => {
    test.setTimeout(240_000)
    const creatorContext = await browser.newContext({ baseURL: origin }); const adminContext = await browser.newContext({ baseURL: origin })
    try {
      const creator = await creatorContext.newPage(); const admin = await adminContext.newPage()
      const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
      await register(page, mailbox.codes, '发货免退验收买家')
      const order = await refundOrder(page, creator, categoryId, '原成品无需退回管理员核验')
      page.on('dialog', dialog => dialog.accept()); admin.on('dialog', dialog => dialog.accept())
      await page.goto(`/orders/${order.id}`); await creator.goto(`/orders/${order.id}`)
      await applyInBrowser(page)
      const current = (await readOrder(page, order.id)).currentRefund!
      await admin.goto(`/admin/refunds/${current.id}?orderNo=${order.orderNo}`)
      const decision = admin.getByRole('region', { name: '管理员退款裁定' })
      await decision.getByLabel('裁定结果').selectOption('APPROVE')
      await decision.getByLabel('裁定原因').fill('根据双方证据核对作品质量问题，批准全额退款并记录免退依据。')
      await decision.getByLabel('退货核查').selectOption('false')
      await decision.getByRole('button', { name: '已重新查阅当前材料' }).click()
      await decision.getByRole('button', { name: '确认裁定', exact: true }).click()
      await expect(admin.getByRole('alert')).toContainText('填写核查依据')
      expect((await readOrder(page, order.id)).status).toBe('AFTER_SALE')
      const basis = '已核验双方会话确认成品损坏，创作者同意无需退回原成品，相关原证据保留。'
      await decision.getByLabel('无需退货依据').fill(basis)
      await decision.getByRole('button', { name: '确认裁定', exact: true }).click()
      await expect(page.locator('.work-section-heading .work-status')).toHaveText('已退款')
      await expect(creator.locator('.work-section-heading .work-status')).toHaveText('已退款')
      const result = (await (await admin.request.get(`${api}/admin/refund-applications/${current.id}`)).json()).data as AdminRefundDetailVO
      expect(result.application.returnRequired).toBe(false); expect(result.application.noReturnBasis).toBe(basis)
      expect(result.application.returnTrackingNo).toBeNull(); expect(result.application.returnConfirmedAt).toBeNull()
      expect(result.order.settlement?.paidAmount).toBe('180.00'); expect(result.order.settlement?.status).toBe('CANCELLED')
      expect(result.order.shippedAt).toBe(order.shippedAt)
      await expect(admin.getByRole('region', { name: '售后处理结论' })).toContainText(basis)
      await expect(admin.getByRole('region', { name: '管理员退款裁定' })).toHaveCount(0)
    } finally { await creatorContext.close(); await adminContext.close() }
  })
})

