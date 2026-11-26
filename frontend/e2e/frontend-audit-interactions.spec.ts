import { expect, test, type Page } from '@playwright/test'
import { api } from './environment'

const pageResult = { items: [], total: 0, page: 1, size: 20 }
const work = {
  id: '1', creatorId: '11', creatorNickname: '测试创作者', title: '测试作品', categoryId: '5',
  categoryPath: ['木作'], mainImageIds: ['1'], specificationImageIds: [], reviewStatus: 'ONLINE',
  version: '1', description: '用来验证已上架的作品改价成功后清理对应字段提示的测试资料',
  processDescription: '', material: '木材', specification: '35 cm', stockStatus: 'AVAILABLE',
  saleEnabled: true, customEnabled: false, stockPrice: '15.00', customReferenceDays: null, sourceOrderId: null,
}
const pendingOrder = {
  id: '71', orderNo: 'STOCK71', orderType: 'STOCK', buyerId: '11', creatorId: '12',
  title: '取消确认测试现货', status: 'PENDING_PAY', owned: true, canCancel: true,
  totalAmount: '180.00', agreementSnapshot: { request: { title: '取消确认测试现货', materialPreference: '木材', specification: '35 cm', description: '测试现货' } },
  progressNodes: [], trackingHistory: [], history: [],
}
const application = {
  id: '11', userId: '5', nickname: '测试申请人', status: 'PENDING', realName: '测试姓名',
  categories: [], originalWorks: [], previousApplicationId: '10',
}

function deferred() {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  return { pending, release }
}

/** 受控接口验证交互分支，真实写入沿用对应业务用例。 */
async function mockSession(page: Page, role: 'BUYER' | 'CREATOR' | 'ADMIN' | 'GUEST') {
  await page.routeWebSocket('**/api/ws', ws => ws.onMessage(value => {
    if (value === 'PING') ws.send(JSON.stringify({ type: 'PONG' }))
  }))
  await page.route(api + '/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/sessions/current' && role === 'GUEST') {
      await route.fulfill({ status: 401, json: { code: 401, message: '请登录' } })
      return
    }
    let data: unknown = pageResult
    if (path === '/api/sessions/current') data = { userId: '11', email: '123456789@qq.com', nickname: '测试账号', roles: [role], activeRole: role }
    if (path.endsWith('/unread-count')) data = { count: 0 }
    if (path === '/api/me/creator-certification') data = { certificationStatus: 'NONE', currentApplicationId: null, approvedApplicationId: null }
    if (path === '/api/me/profile') data = { nickname: '测试账号', email: '123456789@qq.com' }
    if (path === '/api/csrf') data = { headerName: 'X-CSRF-TOKEN', token: 'test-token' }
    if (path === '/api/categories' || path === '/api/me/approved-publication-orders' || path === '/api/me/addresses' || path === '/api/admin/categories') data = []
    if (path === '/api/orders/71') data = pendingOrder
    if (path === '/api/me/works/1') data = work
    if (path === '/api/me/work-publication-quota') data = { used: 0, quota: 5, remaining: 5 }
    if (path === '/api/admin/creator-applications/11') data = application
    await route.fulfill({ json: { code: 0, data } })
  })
}

test('取消订单弹窗核对对象，取消不写入而确认仅写一次', async ({ page }) => {
  await mockSession(page, 'BUYER')
  let writes = 0
  let order = pendingOrder
  await page.route(api + '/orders/71', route => route.fulfill({ json: { code: 0, data: order } }))
  await page.route(api + '/orders/71/cancellation', async route => {
    writes++
    order = { ...pendingOrder, status: 'CANCELLED', canCancel: false }
    await route.fulfill({ json: { code: 0, data: order } })
  })
  await page.goto('/orders/71?side=BUYER')
  const open = page.getByRole('button', { name: '取消订单', exact: true })
  const dialog = page.getByRole('dialog', { name: '取消订单？' })
  await open.click()
  await expect(dialog).toContainText('STOCK71')
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  expect(writes).toBe(0)
  await expect(open).toBeFocused()
  await open.click()
  await dialog.getByRole('button', { name: '确认取消订单', exact: true }).click()
  await expect(page.locator('.work-section-heading .work-status')).toHaveText('已取消')
  expect(writes).toBe(1)
})

test('地址与品类编辑取消确认后保留未保存字段', async ({ page }) => {
  await mockSession(page, 'BUYER')
  await page.goto('/account/addresses')
  await page.getByRole('button', { name: '新增地址' }).click()
  const recipient = page.getByLabel('收件人', { exact: true })
  await recipient.fill('测试收件人')
  const confirmation = page.getByRole('dialog', { name: '离开编辑？' })
  await page.getByRole('navigation', { name: '个人中心' }).locator('[href="/account/profile"]').click()
  await confirmation.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/addresses$/)
  await expect(recipient).toHaveValue('测试收件人')
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await confirmation.getByRole('button', { name: '取消', exact: true }).click()
  await expect(recipient).toHaveValue('测试收件人')
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await confirmation.getByRole('button', { name: '确认离开' }).click()
  await expect(recipient).toHaveCount(0)

  await mockSession(page, 'ADMIN')
  await page.goto('/admin/categories')
  await page.getByRole('button', { name: '新增一级品类' }).click()
  const editor = page.getByRole('dialog', { name: '新增一级品类' })
  const name = editor.getByLabel('品类名称')
  await name.fill('测试品类')
  await page.keyboard.press('Escape')
  await confirmation.getByRole('button', { name: '取消', exact: true }).click()
  await expect(name).toHaveValue('测试品类')
  await editor.getByRole('button', { name: '取消', exact: true }).click()
  await confirmation.getByRole('button', { name: '确认离开' }).click()
  await expect(editor).toBeHidden()
})

test('入驻草稿仅在确认离开后清除', async ({ page }) => {
  await mockSession(page, 'BUYER')
  const imageData = 'R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
  const image = { id: '91', url: `data:image/gif;base64,${imageData}`, expiresAt: new Date(Date.now() + 900_000).toISOString() }
  await page.route(api + '/creator-application-images', route => route.fulfill({ status: 201, json: { code: 0, data: image } }))
  await page.route(api + '/creator-application-images/91', route => route.fulfill({ json: { code: 0, data: image } }))
  await page.goto('/account/creator-certification')
  await page.getByRole('button', { name: '开始申请' }).click()
  const name = page.getByLabel('申请人姓名')
  await name.fill('测试姓名')
  await page.getByLabel('上传作品1成品图', { exact: true }).setInputFiles({ name: 'portfolio.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf5sAAAAASUVORK5CYII=', 'base64') })
  const portfolio = page.getByRole('img', { name: '作品1成品图 1', exact: true })
  await expect(portfolio).toBeVisible()
  const profile = page.getByRole('navigation', { name: '个人中心' }).locator('[href="/account/profile"]')
  await profile.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 2500 })
  await expect(dialog.getByRole('button', { name: '取消' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(name).toHaveValue('测试姓名')
  await expect(portfolio).toBeVisible()
  await expect(profile).toBeFocused()
  const nativeConfirmation = page.waitForEvent('dialog')
  await page.evaluate(() => { setTimeout(() => window.location.reload(), 0) })
  const prompt = await nativeConfirmation
  expect(prompt.type()).toBe('beforeunload')
  await prompt.dismiss()
  await expect(name).toHaveValue('测试姓名')
  await expect(portfolio).toBeVisible()
  const closePrompt = page.waitForEvent('dialog')
  await page.close({ runBeforeUnload: true })
  const leavePrompt = await closePrompt
  expect(leavePrompt.type()).toBe('beforeunload')
  await leavePrompt.dismiss()
  await expect(name).toHaveValue('测试姓名')
  await expect(portfolio).toBeVisible()
  await profile.click()
  await dialog.getByRole('button', { name: '确认离开' }).click()
  await expect(page).toHaveURL(/\/account\/profile$/)
})

test('即时交易更新成功后清除修正字段的旧错误', async ({ page }) => {
  await mockSession(page, 'CREATOR')
  let writes = 0
  await page.route(api + '/me/works/1/trading-settings', async route => {
    writes++
    await route.fulfill({ json: { code: 0, data: { ...work, ...route.request().postDataJSON(), version: '2' } } })
  })
  await page.goto('/creator/works/1/edit')
  const price = page.getByLabel('成品售价（元）')
  const description = page.getByLabel('作品描述', { exact: true })
  const draft = '这段展示内容只在页面编辑，交易设置即时更新后仍保留草稿。'
  await description.fill(draft)
  const update = page.getByRole('button', { name: '即时更新交易设置' })
  await price.fill('0')
  await update.click()
  await expect(price).toHaveAttribute('aria-invalid', 'true')
  expect(writes).toBe(0)
  await price.fill('20.00')
  await update.click()
  await expect(page.getByText('交易设置已即时更新，作品保持上架', { exact: true }).first()).toBeVisible()
  await expect(price).toHaveAttribute('aria-invalid', 'false')
  await expect(description).toHaveValue(draft)
  expect(writes).toBe(1)
})

test('入驻历史暂不可读取时保留当前材料与意见，定向重试后继续审核', async ({ page }) => {
  await mockSession(page, 'ADMIN')
  let historyReads = 0
  await page.route(api + '/admin/creator-applications/10', async route => {
    historyReads++
    if (historyReads < 3) {
      const status = historyReads === 1 ? 404 : 403
      await route.fulfill({ status, json: { code: status, message: status === 404 ? '材料暂不可用' : '材料暂不可访问' } })
      return
    }
    await route.fulfill({ json: { code: 0, data: { ...application, id: '10', status: 'REJECTED', previousApplicationId: null } } })
  })
  await page.goto('/admin/creator-applications/11')
  const approve = page.getByRole('button', { name: '通过入驻审核' })
  const reject = page.getByRole('button', { name: '驳回并说明原因' })
  const retry = page.getByRole('button', { name: '重试读取历史材料' })
  await expect(page.getByRole('alert')).toContainText('无法比较上次申请 10 的材料')
  await expect(approve).toBeDisabled()
  await expect(reject).toBeDisabled()
  const reason = page.getByLabel('审核意见')
  await reason.fill('当前材料核验结果')
  await retry.click()
  await expect(page.getByRole('alert')).toContainText('材料暂不可访问')
  await expect(approve).toBeDisabled()
  await expect(reject).toBeDisabled()
  await expect(reason).toHaveValue('当前材料核验结果')
  await retry.click()
  await expect(reason).toHaveValue('当前材料核验结果')
  await expect(approve).toBeEnabled()
  await expect(reject).toBeEnabled()
  expect(historyReads).toBe(3)
})

test('发送验证码期间往返修改邮箱，迟到响应不更新当前发送提示', async ({ page }) => {
  await mockSession(page, 'GUEST')
  const send = deferred()
  let writes = 0
  await page.route(api + '/email-verification-codes', async route => {
    writes++
    await send.pending
    await route.fulfill({ json: { code: 0, data: { expiresAt: '2099-01-01T10:05:00+08:00' } } })
  })
  await page.goto('/register')
  const email = page.getByLabel('邮箱地址')
  await email.fill('123456789@qq.com')
  await page.getByRole('button', { name: '发送验证码' }).click()
  await expect(page.getByRole('button', { name: '发送中…' })).toBeDisabled()
  await email.fill('987654321@qq.com')
  await email.fill('123456789@qq.com')
  send.release()
  await expect(page.getByRole('button', { name: '发送验证码', exact: true })).toBeEnabled()
  await expect(page.getByText('验证码已发送', { exact: false })).toHaveCount(0)
  expect(writes).toBe(1)
})
