import { randomUUID } from 'node:crypto'
import { test, expect } from './fixtures'
import { api, mutate, origin, prepareCreator, register } from './custom-request-support'
import { refundOrder } from './refund-support'

test.use({ storageMode: 'receiver', viewport: { width: 1366, height: 900 } })

test('看板按北京时间查询新增指标，订单深链接返回原组合筛选', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(150_000)
  const adminContext = await browser.newContext({ baseURL: origin, viewport: { width: 1366, height: 900 } })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const admin = await adminContext.newPage()
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '后台查询买家')
    const before = (await (await admin.request.get(`${api}/admin/dashboard`)).json()).data
    const order = await refundOrder(page, creator, categoryId, '后台订单查询验收', false)
    await admin.goto('/admin/dashboard')
    await expect(admin.getByText('更新于', { exact: false })).toBeVisible()
    const paid = admin.getByRole('region', { name: '模拟资金' }).locator('dl > div').filter({ hasText: '模拟支付' })
    const expectedPaid = `¥ ${(Number(before.paymentAmount) + 180).toFixed(2)}`
    await expect(paid).toContainText(expectedPaid)
    await expect(admin.getByRole('region', { name: '订单统计' })).toContainText('待开工')
    await admin.getByLabel('新增统计起始日').fill('2001-01-01')
    await admin.getByLabel('新增统计结束日').fill('2001-01-01')
    await admin.getByRole('button', { name: '更新看板' }).click()
    await expect(admin.getByText('2001-01-01 至 2001-01-01')).toBeVisible()
    await expect(admin.getByText('所选期间新增 0', { exact: true })).toHaveCount(2)
    await expect(paid).toContainText(expectedPaid)
    expect(await admin.evaluate(() => document.documentElement.scrollWidth)).toBe(1366)
    await admin.screenshot({ path: testInfo.outputPath('admin-dashboard-1366.png'), fullPage: true })

    await admin.getByRole('navigation', { name: '后台管理' }).getByRole('link', { name: '订单查询' }).click()
    await admin.getByLabel('订单编号').fill(order.orderNo)
    await admin.getByLabel('订单类型').selectOption('CUSTOM')
    await admin.getByLabel('订单状态').selectOption('PAID')
    await admin.getByLabel('金额从').fill('180.00')
    await admin.getByRole('button', { name: '查询订单' }).click()
    await admin.getByRole('link', { name: order.orderNo, exact: true }).click()
    await expect(admin).toHaveURL(new RegExp(`[?&]orderId=${order.id}(?:&|$)`))
    await admin.reload()
    await expect(admin.getByRole('heading', { name: `订单详情 · ${order.orderNo}` })).toBeVisible()
    await expect(admin.getByText('售后验收测试路一号', { exact: false })).toBeVisible()
    await expect(admin.getByRole('heading', { name: '制作记录' })).toBeVisible()
    await admin.getByRole('link', { name: '返回订单查询' }).click()
    await expect(admin.getByLabel('订单编号')).toHaveValue(order.orderNo)
    await expect(admin.getByLabel('订单状态')).toHaveValue('PAID')
    await expect(admin.getByLabel('金额从')).toHaveValue('180.00')
    await expect(admin.getByRole('link', { name: order.orderNo, exact: true })).toBeVisible()
    await mailbox.expireFulfillmentBoundary(order.id, 'NO_START')
    await admin.reload()
    await expect(admin.getByRole('row').filter({ hasText: order.orderNo })).toContainText('开工超期')
    await page.goto(`/admin/orders?orderId=${order.id}`)
    await expect(page).toHaveURL(origin + '/')
    expect((await page.request.get(`${api}/admin/orders/${order.id}`)).status()).toBe(403)
  } finally {
    await adminContext.close()
    await creatorContext.close()
  }
})

test('后台暂停和本人暂停各自生效，已有订单仍可开工和沟通', async ({ page, browser, mailbox }) => {
  test.setTimeout(150_000)
  const adminContext = await browser.newContext({ baseURL: origin, viewport: { width: 1366, height: 900 } })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const admin = await adminContext.newPage()
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '后台处置买家')
    const order = await refundOrder(page, creator, categoryId, '后台暂停前旧订单', false)
    await admin.goto('/admin/users')
    const creatorProfile = (await (await creator.request.get(`${api}/sessions/current`)).json()).data
    await admin.getByLabel('邮箱').fill(creatorProfile.email.split('@')[0])
    await admin.getByLabel('认证状态').selectOption('APPROVED')
    await admin.getByRole('button', { name: '查询用户' }).click()
    const accountRows = admin.getByRole('region', { name: '账号列表' }).getByRole('link')
    await expect(accountRows).toHaveCount(1)
    await accountRows.filter({ hasText: creatorProfile.email }).click()
    await admin.getByRole('button', { name: '暂停新业务', exact: true }).click()
    const dialog = admin.getByRole('dialog')
    await dialog.getByLabel('操作原因').fill('平台核查交易凭证')
    await dialog.getByRole('button', { name: '确认暂停' }).click()
    await expect(dialog.getByText('请填写恢复条件')).toBeVisible()
    await dialog.getByLabel('恢复条件').fill('补齐履约材料并完成复核')
    await dialog.getByRole('button', { name: '确认暂停' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(admin.getByText('补齐履约材料并完成复核', { exact: false })).toBeVisible()

    const directRequest = {
      title: '处置后定向需求', categoryId, purpose: '定制礼物', materialPreference: '原木', specification: '十厘米',
      budgetMin: '100.00', budgetMax: '200.00', expectedShipDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      description: '需要定制一枚原木书签用于赠送朋友，刻上姓名并在制作前确认排版。', referenceImageIds: [], visibility: 'DIRECTED', invitedCreatorId: order.creatorId, sourceWorkId: null,
    }
    const draftResponse = await mutate(page, '/me/custom-requests', { ...directRequest, requestKey: randomUUID() })
    expect(draftResponse.status()).toBe(201)
    const draft = (await draftResponse.json()).data
    expect((await mutate(page, `/me/custom-requests/${draft.id}/publication`, { ...directRequest, version: draft.version }, 'put')).status()).toBe(403)

    await creator.goto(`/orders/${order.id}`)
    await creator.getByRole('button', { name: '确认开工', exact: true }).click()
    await expect(creator.locator('.work-section-heading .work-status')).toHaveText('制作中')
    const chat = await mutate(creator, `/conversations/${order.conversationId}/messages`, { clientMessageKey: randomUUID(), content: '旧单制作正常进行。', imageIds: [] })
    expect(chat.status()).toBe(201)
    await creator.goto('/messages/notifications')
    await expect(creator.getByText('管理员已暂停你的新业务资格', { exact: false })).toBeVisible()

    await creator.goto('/account/profile')
    await creator.getByRole('button', { name: '暂停接单', exact: true }).click()
    await creator.getByRole('button', { name: '恢复接单', exact: true }).click()
    await expect(creator.getByRole('button', { name: '暂停接单', exact: true })).toBeVisible()
    let state = (await (await creator.request.get(`${api}/me/creator-pause`)).json()).data
    expect(state).toMatchObject({ adminBusinessPaused: true, creatorPaused: false })
    await creator.getByRole('button', { name: '暂停接单', exact: true }).click()
    await expect(creator.getByRole('button', { name: '恢复接单', exact: true })).toBeVisible()
    await admin.getByRole('button', { name: '人工恢复新业务', exact: true }).click()
    await dialog.getByLabel('操作原因').fill('履约材料已复核')
    await dialog.getByRole('button', { name: '确认恢复' }).click()
    await expect(dialog).not.toBeVisible()
    state = (await (await creator.request.get(`${api}/me/creator-pause`)).json()).data
    expect(state).toMatchObject({ adminBusinessPaused: false, creatorPaused: true })
    await expect(admin.getByText('履约材料已复核', { exact: false })).toBeVisible()
  } finally {
    await adminContext.close()
    await creatorContext.close()
  }
})
