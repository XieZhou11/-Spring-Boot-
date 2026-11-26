import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { api, image, mutate, origin, prepareCreator, register } from './custom-request-support'
import { refundOrder } from './refund-support'

test.use({ storageMode: 'receiver', actionTimeout: 15_000 })

/** 使用真实定制履约和收货准备授权订单，随后由相关账号通过通知进入订单。 */
async function completedOrder(buyer: Page, creator: Page, categoryId: string, title: string) {
  const order = await refundOrder(buyer, creator, categoryId, title)
  expect((await mutate(buyer, `/orders/${order.id}/receipt`, undefined, 'put')).status()).toBe(201)
  return order
}

async function openNotice(page: Page, title: string, id: string) {
  await page.goto('/messages/notifications')
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  await card.getByRole('button', { name: '查看订单' }).click()
  await expect(page).toHaveURL(`/orders/${id}#publication-consent`)
  await expect(page.getByRole('region', { name: '定制成品公开授权' })).toBeInViewport()
}

test('买家明确同意后可发布关联案例，审核通过才公开且只开放同类定制', async ({ page: buyer, browser, mailbox }, testInfo) => {
  test.setTimeout(180_000)
  const creatorContext = await browser.newContext({ baseURL: origin, viewport: { width: 1366, height: 900 } })
  const adminContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const admin = await adminContext.newPage()
    const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    const buyerEmail = await register(buyer, mailbox.codes, '案例授权买家')
    const order = await completedOrder(buyer, creator, categoryId, '原木书签成品授权')
    await creator.goto(`/orders/${order.id}`)
    // 后端已提交但应答丢失时，页面从只读订单接口核对实际授权。
    const consentUrl = `**/api/orders/${order.id}/publication-consent`
    await creator.route(consentUrl, async route => {
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      await route.abort('failed')
    }, { times: 1 })
    await creator.getByRole('button', { name: '申请公开成品案例' }).click()
    await creator.getByRole('dialog').getByRole('button', { name: '确认申请', exact: true }).click()
    await expect(creator.getByText('等待买家回复', { exact: true })).toBeVisible()
    await openNotice(buyer, '创作者申请公开定制成品', order.id)
    await expect(buyer.getByRole('link', { name: '发布定制成品案例' })).toHaveCount(0)
    await buyer.getByRole('button', { name: '同意公开', exact: true }).click()
    await buyer.getByRole('dialog').getByRole('button', { name: '确认同意', exact: true }).click()
    await expect(buyer.getByText('已同意公开', { exact: true })).toBeVisible()
    await openNotice(creator, '买家已同意公开定制成品', order.id)
    await expect(creator.getByRole('region', { name: '定制成品公开授权' })).toContainText('回复时间')
    await creator.screenshot({ path: testInfo.outputPath('consent-order-1366.png'), fullPage: true })
    await creator.getByRole('link', { name: /发布定制成品案例/ }).click()

    const source = creator.getByLabel('关联已授权的定制成品', { exact: true })
    await expect(source).toHaveValue(order.id)
    await expect(creator.getByLabel('作品标题', { exact: true })).toHaveValue('')
    await expect(creator.getByRole('switch', { name: '出售现货', exact: true })).toBeDisabled()
    const title = '原木书签定制案例'
    await creator.getByLabel('作品标题', { exact: true }).fill(title)
    await creator.getByLabel('所属品类', { exact: true }).selectOption(categoryId)
    await creator.getByLabel('作品主图', { exact: true }).setInputFiles({ name: 'case.png', mimeType: 'image/png', buffer: image })
    await expect(creator.getByRole('img', { name: '作品主图 1', exact: true })).toBeVisible()
    await creator.getByLabel('材质', { exact: true }).fill('胡桃木')
    await creator.getByLabel('尺寸规格', { exact: true }).fill('十二厘米')
    await creator.getByLabel('作品描述', { exact: true }).fill('这款手工书签保留细密木纹，边缘逐层打磨，适合夹在读物之中，日常使用请保持干燥。')
    await creator.getByRole('switch', { name: '接受定制', exact: true }).check()
    await creator.getByLabel('同类定制参考周期（天）', { exact: true }).fill('12')
    await creator.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(creator).toHaveURL(/\/creator\/works\/\d+\/edit$/)
    await expect(source).toHaveValue(order.id)
    await expect(source).toBeDisabled()
    const workId = new URL(creator.url()).pathname.split('/')[3]
    await creator.getByRole('button', { name: '提交审核', exact: true }).click()
    await expect(creator.getByRole('heading', { name: '待审核作品', exact: true })).toBeVisible()
    await buyer.goto(`/works/${workId}`)
    await expect(buyer.getByRole('heading', { name: title, exact: true })).toHaveCount(0)
    await admin.goto(`/admin/works/${workId}`)
    await expect(admin.getByText(`定制案例 · 来源订单 ${order.id}`)).toBeVisible()
    await admin.getByRole('button', { name: '审核通过并上架', exact: true }).click()
    await admin.getByRole('dialog').getByRole('button', { name: '确认通过', exact: true }).click()
    await expect(admin.getByRole('status')).toContainText('审核通过')
    await buyer.reload()
    await expect(buyer.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(buyer.getByRole('button', { name: /购买现货|立即购买/ })).toHaveCount(0)
    await expect(buyer.getByRole('link', { name: /定制/ }).filter({ hasText: '同类定制' })).toBeVisible()
    await expect(buyer.getByText('售后验收测试路一号')).toHaveCount(0)

    // 另一标签页换号后，即使仍停在来源链接，也须清除原创作者的案例表单。
    await creator.goto(`/creator/works/new?sourceOrderId=${order.id}`)
    await expect(source).toHaveValue(order.id)
    await creator.getByLabel('作品标题', { exact: true }).fill('原账号未保存的案例')
    // 明确经过旧会话失效的窗口，再恢复新账号，覆盖实时连接触发的会话复查顺序。
    const csrf = (await (await creator.request.get(`${api}/csrf`)).json()).data
    const signedOut = await creator.request.delete(`${api}/sessions/current`, { headers: { [csrf.headerName]: csrf.token } })
    expect(signedOut.ok()).toBe(true)
    await creator.evaluate(() => window.dispatchEvent(new Event('creator-certification-updated')))
    await expect(creator.getByLabel('作品标题', { exact: true })).toHaveCount(0)
    expect((await mutate(creator, '/sessions', { email: buyerEmail, password: 'CraftTest123' })).status()).toBe(201)
    await creator.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(creator.getByRole('alert')).toContainText('当前账号需要通过创作者认证')
    await expect(creator.getByLabel('作品标题', { exact: true })).toHaveCount(0)
    await creator.getByRole('link', { name: '查看创作者认证' }).click()
    await expect(creator).toHaveURL('/account/creator-certification')
  } finally {
    await creatorContext.close()
    await adminContext.close()
  }
})

test('明确拒绝后只有原回复，拒绝的来源链接无法进入案例编辑', async ({ page: buyer, browser, mailbox }) => {
  test.setTimeout(150_000)
  const creatorContext = await browser.newContext({ baseURL: origin })
  const adminContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const admin = await adminContext.newPage()
    const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    await register(buyer, mailbox.codes, '拒绝授权买家')
    const order = await completedOrder(buyer, creator, categoryId, '买家拒绝公开的手工作品')
    await creator.goto(`/orders/${order.id}`)
    await creator.getByRole('button', { name: '申请公开成品案例' }).click()
    await creator.getByRole('dialog').getByRole('button', { name: '确认申请', exact: true }).click()
    await openNotice(buyer, '创作者申请公开定制成品', order.id)
    await buyer.getByRole('button', { name: '不同意公开', exact: true }).click()
    await buyer.getByRole('dialog').getByRole('button', { name: '确认不同意', exact: true }).click()
    await expect(buyer.getByText(/已拒绝公开|买家不同意公开本次成品案例/)).toBeVisible()
    const replay = await mutate(buyer, `/orders/${order.id}/publication-consent`, { decision: 'APPROVED' }, 'put')
    expect((await replay.json()).data.publicationConsentStatus).toBe('REJECTED')
    await openNotice(creator, '买家不同意公开定制成品', order.id)
    await expect(creator.getByRole('link', { name: /发布定制成品案例/ })).toHaveCount(0)
    await creator.goto(`/creator/works/new?sourceOrderId=${order.id}`)
    await expect(creator.getByRole('alert')).toContainText('该订单当前无法关联')
    await expect(creator.getByRole('button', { name: '提交审核' })).toHaveCount(0)
    await creator.getByRole('link', { name: '发布普通作品', exact: true }).click()
    await expect(creator.getByLabel('关联已授权的定制成品', { exact: true })
      .getByRole('option', { name: '普通作品，不关联定制订单' })).toHaveJSProperty('selected', true)
  } finally {
    await creatorContext.close()
    await adminContext.close()
  }
})
