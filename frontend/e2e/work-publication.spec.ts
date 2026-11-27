import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { test, expect, frontendOrigin } from './fixtures'

import { api } from './environment'
const image = readFileSync(new URL('./avatar.png', import.meta.url))
test.use({ storageMode: 'receiver', actionTimeout: 15_000 })

/** 宽屏用订单列表上的选中卡片核对状态。 */
const selectedStatus = (page: Page) => page.locator('.craftflow-order-item a[aria-current="page"] [data-status]')

/** 走真实注册及会话，不依赖开发账号或浏览器持久化令牌。 */
async function register(page: Page, codes: Map<string, string>, nickname = '作品访客', signIn = true) {
  const email = `works-${randomBytes(6).toString('hex')}@qq.com`
  async function post(path: string, data: object) {
    const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
    return page.request.post(`${api}${path}`, { data, headers: { [csrf.headerName]: csrf.token } })
  }
  expect((await post('/email-verification-codes', { email })).status()).toBe(201)
  await expect.poll(() => codes.get(email)).toMatch(/^\d{6}$/)
  expect((await post('/accounts', { email, nickname, password: 'CraftTest123', verificationCode: codes.get(email) })).status()).toBe(201)
  if (signIn) expect((await post('/sessions', { email, password: 'CraftTest123' })).status()).toBe(201)
  return email
}

test('买家进入作品发现首页，保留当前账号、搜索及退出入口', async ({ page, mailbox }) => {
  await register(page, mailbox.codes)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '作品广场', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /作品访客/ })).toBeVisible()
  // 其他业务套件可先发布作品；使用无匹配关键词验证空态，不依赖共享库执行顺序。
  await page.getByRole('searchbox', { name: '作品关键词', exact: true }).fill(`无匹配作品${randomBytes(6).toString('hex')}`)
  await page.getByRole('button', { name: '筛选', exact: true }).click()
  await expect(page.getByText('还没有符合条件的作品')).toBeVisible()
  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/\/login/)
})

/** 入驻前置通过真实接口创建，目标作品链路仍从浏览器逐项操作。 */
async function mutate(page: Page, path: string, method: 'post' | 'put' = 'post', data?: object) {
  const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
  return page.request[method](`${api}${path}`, { data, headers: { [csrf.headerName]: csrf.token } })
}
async function prepareCreator(page: Page, admin: Page, codes: Map<string, string>, promote: (email: string) => Promise<void>) {
  const adminEmail = await register(admin, codes, '作品审核')
  await promote(adminEmail)
  const categoryName = `手作${randomBytes(3).toString('hex')}`
  const categoryResponse = await mutate(admin, '/admin/categories', 'post', { name: categoryName, enabled: true, sortOrder: 1 })
  expect(categoryResponse.status()).toBe(201)
  const parentId = (await categoryResponse.json()).data.id as string
  const child = await mutate(admin, '/admin/categories', 'post', { parentId, name: '生活器物', enabled: true, sortOrder: 1 })
  expect(child.status()).toBe(201)
  const categoryId = (await child.json()).data.id as string
  await register(page, codes, '木间手作')
  const uploads: string[] = []
  for (let index = 0; index < 6; index++) {
    const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
    const response = await page.request.post(`${api}/creator-application-images`, { headers: { [csrf.headerName]: csrf.token }, multipart: { file: { name: 'original.png', mimeType: 'image/png', buffer: image } } })
    expect(response.status()).toBe(201)
    uploads.push((await response.json()).data.id)
  }
  const application = await mutate(page, '/me/creator-applications', 'post', { requestKey: randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5'), realName: '手作测试', contactPhone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', categoryIds: [parentId], experienceYears: 5, introduction: '专注于原创手作的创作者，从选材到设计和每一个制作工序都由本人独立完成，希望用传统工艺带来舒适温暖的日常。', originalWorks: [0, 1, 2].map(i => ({ finishedImageIds: [uploads[i * 2]], processImageIds: [uploads[i * 2 + 1]] })), alipayAccount: '13800138000', payeeName: '手作测试', supportingDescription: '' })
  expect(application.status()).toBe(201)
  const applicationId = (await application.json()).data.id
  expect((await mutate(admin, `/admin/creator-applications/${applicationId}/review`, 'put', { decision: 'APPROVED', reason: '' })).status()).toBe(200)
  return { categoryId, categoryName, parentId }
}

/** 通过上传、提交和审核建立组合筛选所需的公开作品。 */
async function publishBrowseWork(creator: Page, admin: Page, input: {
  title: string
  categoryId: string
  description: string
  stockPrice: string | null
  customReferenceDays: number | null
}) {
  const csrf = (await (await creator.request.get(`${api}/csrf`)).json()).data
  const upload = await creator.request.post(`${api}/work-images`, {
    headers: { [csrf.headerName]: csrf.token },
    multipart: { file: { name: 'browse.png', mimeType: 'image/png', buffer: image } },
  })
  expect(upload.status()).toBe(201)
  const content = {
    ...input,
    mainImageIds: [(await upload.json()).data.id],
    specificationImageIds: [],
    material: '胡桃木与天然木蜡油',
    specification: '直径十厘米',
    processDescription: '切割原木、修边打磨，涂蜡后晾干。',
    saleEnabled: input.stockPrice !== null,
    customEnabled: input.customReferenceDays !== null,
  }
  const draft = await mutate(creator, '/me/works', 'post', { ...content, requestKey: randomUUID() })
  expect(draft.status()).toBe(201)
  const { id, version } = (await draft.json()).data as { id: string; version: number }
  const submission = await mutate(creator, `/me/works/${id}/submission`, 'put', { ...content, version })
  expect(submission.status()).toBe(200)
  const review = await mutate(admin, `/admin/works/${id}/review`, 'put', { version: (await submission.json()).data.version, decision: 'APPROVED', reason: '' })
  expect(review.status()).toBe(200)
  return id
}

test('登录回到已上架作品并读取签名主图，详情刷新后可返回原筛选', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(90_000)
  const creatorContext = await browser.newContext({ baseURL: frontendOrigin })
  const adminContext = await browser.newContext({ baseURL: frontendOrigin })
  try {
    const creator = await creatorContext.newPage()
    const admin = await adminContext.newPage()
    const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    const title = `深链验收${randomBytes(3).toString('hex')}木盘`
    const workId = await publishBrowseWork(creator, admin, {
      title, categoryId, description: '手工制作的木盘，保留自然木纹，日常以天然木蜡油养护。',
      stockPrice: '78.60', customReferenceDays: 15,
    })
    const email = await register(page, mailbox.codes, '深链访客', false)
    const redirect = `/works/${workId}?from=saved#details`
    await page.setViewportSize({ width: 1366, height: 900 })
    await page.goto(redirect)
    await expect.poll(() => new URL(page.url()).searchParams.get('redirect')).toBe(redirect)
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.getByLabel('邮箱地址', { exact: true }).fill(email)
    await page.getByLabel('密码', { exact: true }).fill('CraftTest123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page).toHaveURL(redirect)
    const heading = page.getByRole('heading', { name: title, level: 1, exact: true })
    await expect(heading).toBeVisible()
    const mainImage = page.getByRole('img', { name: title, exact: true })
    await expect.poll(() => mainImage.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('work-detail-1366.png'), fullPage: true })
    await page.reload()
    await expect(page).toHaveURL(redirect)
    await expect(heading).toBeVisible()
    await expect.poll(() => mainImage.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)

    await page.getByRole('link', { name: '返回作品广场', exact: true }).click()
    await expect(page).toHaveURL('/')
    const filters = `/?keyword=${encodeURIComponent(title)}&categoryId=${categoryId}&purchasable=true&sort=PRICE_DESC&page=1#discover`
    await page.goto(filters)
    const card = page.getByRole('link', { name: `查看${title}`, exact: true })
    await card.click()
    await expect(heading).toBeVisible()
    await page.reload()
    await page.getByRole('link', { name: '返回作品广场', exact: true }).click()
    await expect(page).toHaveURL(filters)
    await expect(page.getByRole('searchbox', { name: '作品关键词', exact: true })).toHaveValue(title)
    await expect(card).toBeVisible()

    await admin.goto('/admin/dashboard')
    await admin.getByRole('link', { name: '查看前台作品', exact: true }).click()
    await expect(admin).toHaveURL('/discover')
    await admin.getByRole('link', { name: `查看${title}`, exact: true }).click()
    await expect(admin.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible()
    await expect(admin.getByRole('region', { name: '现货直购', exact: true })).toHaveCount(0)
    await expect(admin.getByRole('link', { name: /发起同类定制/ })).toHaveCount(0)
    await admin.getByRole('link', { name: '返回作品广场', exact: true }).click()
    await expect(admin).toHaveURL('/discover')
    await admin.getByRole('link', { name: '管理后台', exact: true }).click()
    await expect(admin).toHaveURL('/admin/dashboard')
  } finally {
    await Promise.all([creatorContext.close(), adminContext.close()])
  }
})

test('作品广场组合筛选两级品类和交易属性，价格排序将无可购价作品排在末尾', async ({ page, browser, mailbox }) => {
  test.setTimeout(90_000)
  const creatorContext = await browser.newContext({ baseURL: frontendOrigin })
  const adminContext = await browser.newContext({ baseURL: frontendOrigin })
  try {
    const creator = await creatorContext.newPage()
    const admin = await adminContext.newPage()
    const { categoryId, categoryName, parentId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    const sibling = await mutate(admin, '/admin/categories', 'post', { parentId, name: '装饰摆件', enabled: true, sortOrder: 2 })
    expect(sibling.status()).toBe(201)
    const siblingId = (await sibling.json()).data.id as string
    const keyword = `筛选${randomBytes(3).toString('hex')}`
    const description = `这是${keyword}作品，采用传统工艺手工打磨，成品以天然木蜡油养护。`
    const low = `${keyword}杯垫`
    const high = `${keyword}果盘`
    const custom = `${keyword}花器`
    const display = '原木手作展示盘'
    await publishBrowseWork(creator, admin, { title: low, categoryId, description, stockPrice: '35.00', customReferenceDays: 7 })
    await publishBrowseWork(creator, admin, { title: high, categoryId, description, stockPrice: '85.00', customReferenceDays: null })
    await publishBrowseWork(creator, admin, { title: custom, categoryId: siblingId, description, stockPrice: null, customReferenceDays: 10 })
    // 展示作品只在描述中包含关键词，必须可搜到且没有价格。
    await publishBrowseWork(creator, admin, { title: display, categoryId, description, stockPrice: null, customReferenceDays: null })

    await register(page, mailbox.codes, '筛选访客')
    await page.goto('/')
    const filters = page.getByRole('button', { name: '筛选', exact: true })
    const keywordInput = page.getByRole('searchbox', { name: '作品关键词', exact: true })
    const order = page.getByLabel('作品排序', { exact: true })
    const titles = page.locator('.work-card').getByRole('heading')
    await page.getByRole('navigation', { name: '一级品类' }).getByRole('button', { name: categoryName, exact: true }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('categoryId')).toBe(parentId)
    await keywordInput.fill(keyword)
    await order.selectOption('PRICE_ASC')
    await filters.click()
    await expect(titles).toHaveText([low, high, display, custom])
    const displayCard = page.locator('.work-card').filter({ has: page.getByRole('heading', { name: display, exact: true }) })
    await expect(displayCard).toContainText('作品展示')
    await expect(displayCard).not.toContainText(/[¥￥]/)
    const customCard = page.locator('.work-card').filter({ has: page.getByRole('heading', { name: custom, exact: true }) })
    await expect(customCard).toContainText('约 10 天')
    await order.selectOption('PRICE_DESC')
    await filters.click()
    await expect(titles).toHaveText([high, low, display, custom])

    await page.getByRole('navigation', { name: '二级品类' }).getByRole('button', { name: '生活器物', exact: true }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('categoryId')).toBe(categoryId)
    await expect(titles).toHaveText([high, low, display])
    await page.getByLabel('可直购', { exact: true }).check()
    await page.getByLabel('接受定制', { exact: true }).check()
    await page.getByLabel('最低价格', { exact: true }).fill('30')
    await page.getByLabel('最高价格', { exact: true }).fill('90')
    await filters.click()
    await expect(titles).toHaveText([low])
    await expect(page.locator('.work-card')).toContainText('35.00')
    await page.reload()
    await expect(titles).toHaveText([low])
    await expect(page.getByLabel('可直购', { exact: true })).toBeChecked()
    await expect(page.getByLabel('接受定制', { exact: true })).toBeChecked()
    await expect(page.getByLabel('最低价格', { exact: true })).toHaveValue('30')
    await expect(page.getByLabel('最高价格', { exact: true })).toHaveValue('90')
  } finally {
    await Promise.all([creatorContext.close(), adminContext.close()])
  }
})

async function fillWork(page: Page, categoryId: string, title = '原木手工杯垫') {
  await page.getByLabel('作品标题', { exact: true }).fill(title)
  await page.getByLabel('所属品类', { exact: true }).selectOption(categoryId)
  await page.getByLabel('作品主图', { exact: true }).setInputFiles({ name: 'craft.png', mimeType: 'image/png', buffer: image })
  await expect(page.getByRole('img', { name: '作品主图 1', exact: true })).toBeVisible()
  await page.getByLabel('材质', { exact: true }).fill('胡桃木与天然木蜡油')
  await page.getByLabel('尺寸规格', { exact: true }).fill('直径 10 厘米，厚 1 厘米')
  await page.getByLabel('作品描述', { exact: true }).fill('手工打磨的原木杯垫，保留自然木纹，使用天然木蜡油养护，日常使用请保持干燥，避免长时间浸泡。')
  await page.getByLabel('制作过程说明', { exact: true }).fill('从原木裁切开始，经过逐级打磨和手工涂油，反复干燥后完成。')
}

test('创作者草稿、驳回补正通过、即时交易设置、买家浏览、重审下架完整链路', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(240_000)
  const adminContext = await browser.newContext({ baseURL: frontendOrigin })
  const buyerContext = await browser.newContext({ baseURL: frontendOrigin })
  try {
    const admin = await adminContext.newPage()
    const { categoryId } = await prepareCreator(page, admin, mailbox.codes, mailbox.promoteAdmin)
    await page.goto('/creator/works/new')
    await fillWork(page, categoryId)
    await page.getByLabel('尺寸图', { exact: true }).setInputFiles({ name: 'stock-specification.png', mimeType: 'image/png', buffer: image })
    await expect(page.getByRole('img', { name: '尺寸图 1', exact: true })).toBeVisible()
    for (const width of [1366, 1440, 1920, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath('editor-390.png'), fullPage: true })
    await page.setViewportSize({ width: 1366, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('editor-1366.png'), fullPage: true })
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(page).toHaveURL(/\/creator\/works\/\d+\/edit$/)
    await expect(page.getByRole('status')).toContainText('草稿已保存')
    await expect(page.getByRole('status')).toBeInViewport()
    const workId = page.url().match(/works\/(\d+)/)![1]!
    await page.reload()
    await expect(page.getByLabel('作品标题', { exact: true })).toHaveValue('原木手工杯垫')
    await page.getByRole('switch', { name: '出售现货', exact: true }).check()
    await page.getByLabel('成品售价（元）', { exact: true }).fill('128.50')
    await page.getByRole('switch', { name: '接受定制', exact: true }).check()
    await page.getByLabel('同类定制参考周期（天）', { exact: true }).fill('12')
    await page.getByRole('button', { name: '提交审核', exact: true }).click()
    await expect(page.getByRole('heading', { name: '待审核作品', exact: true })).toBeVisible()
    await admin.goto('/admin/works')
    await admin.getByRole('button', { name: '全部作品', exact: true }).click()
    await expect(admin.locator('.managed-work-row').filter({ hasText: '原木手工杯垫' })).toBeVisible()
    await admin.locator('.managed-work-row').filter({ hasText: '原木手工杯垫' }).getByRole('link', { name: /审核作品/ }).click()
    // 材料页必须保留从队列选择的筛选范围。
    await expect(admin).toHaveURL(`/admin/works/${workId}?status=ALL`)
    for (const width of [1366, 1440, 1920, 390]) {
      await admin.setViewportSize({ width, height: 1000 })
      expect(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await admin.setViewportSize({ width: 1440, height: 1000 })
    await admin.screenshot({ path: testInfo.outputPath('admin-work-1440.png'), fullPage: true })
    await admin.getByLabel('审核意见', { exact: true }).fill('请补充表面处理和保养说明。')
    await admin.getByRole('button', { name: '驳回作品', exact: true }).click()
    await admin.getByRole('dialog').getByRole('button', { name: '确认驳回', exact: true }).click()
    await expect(admin.getByRole('status')).toContainText('已驳回')
    await page.reload()
    await expect(page.getByText('审核意见：请补充表面处理和保养说明。')).toBeVisible()
    await page.getByLabel('作品描述', { exact: true }).fill('手工打磨的原木杯垫，使用天然木蜡油涂饰，保留自然木纹；定期涂木蜡油保养，日常擦拭并保持干燥，切勿浸泡。')
    // 已成功提交后丢弃响应，页面必须自行核验本轮提交结果。
    await page.route(`**/api/me/works/${workId}/submission`, async route => { const response = await route.fetch(); expect(response.status()).toBe(200); await route.abort('failed') })
    await page.getByRole('button', { name: '提交审核', exact: true }).click()
    await expect(page.getByRole('heading', { name: '待审核作品', exact: true })).toBeVisible()
    await page.unroute(`**/api/me/works/${workId}/submission`)
    await admin.reload()
    await admin.locator('.work-history details').first().getByText('查看本次材料与修改比较').click()
    await expect(admin.locator('.work-history')).toContainText('表面处理和保养说明')
    await admin.getByRole('button', { name: '审核通过并上架', exact: true }).click()
    await admin.getByRole('dialog').getByRole('button', { name: '确认通过', exact: true }).click()
    await expect(admin.getByRole('status')).toContainText('作品已上架')
    await page.reload()
    await page.getByLabel('成品售价（元）', { exact: true }).fill('138.60')
    await page.getByLabel('同类定制参考周期（天）', { exact: true }).fill('15')
    await page.getByRole('button', { name: '即时更新交易设置', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('作品保持上架')
    await expect(page.getByRole('status')).toBeInViewport()
    await page.getByRole('link', { name: '我的作品', exact: true }).first().click()
    const managedWork = page.getByRole('row').filter({ hasText: '原木手工杯垫' })
    await expect(managedWork).toContainText('138.60')
    await expect(managedWork).toContainText('15 个自然日')
    await expect(managedWork).toContainText('已上架')
    await managedWork.getByRole('link', { name: '编辑', exact: true }).click()
    await expect(page).toHaveURL(`/creator/works/${workId}/edit`)
    await expect(page.getByLabel('成品售价（元）', { exact: true })).toHaveValue('138.60')
    const buyer = await buyerContext.newPage()
    await register(buyer, mailbox.codes, '看见手艺')
    await buyer.goto('/?keyword=原木手工杯垫&purchasable=true&customizable=true&sort=PRICE_ASC')
    await expect(buyer.locator('.work-card')).toHaveCount(1)
    await expect(buyer.locator('.work-card')).toContainText('138.60')
    await buyer.getByLabel('最低价格', { exact: true }).fill('140')
    await buyer.getByRole('button', { name: '筛选', exact: true }).click()
    await expect(buyer.getByText('还没有符合条件的作品')).toBeVisible()
    await buyer.getByLabel('最低价格', { exact: true }).fill('125')
    await buyer.getByLabel('最高价格', { exact: true }).fill('139')
    await buyer.getByLabel('作品排序', { exact: true }).selectOption('PRICE_DESC')
    await buyer.getByRole('button', { name: '筛选', exact: true }).click()
    await expect(buyer.locator('.work-card')).toHaveCount(1)
    for (const width of [1366, 1440, 1920, 390]) {
      await buyer.setViewportSize({ width, height: 1000 })
      expect(await buyer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await buyer.screenshot({ path: testInfo.outputPath(`discovery-${width}.png`), fullPage: true })
    }
    await buyer.getByRole('link', { name: '查看原木手工杯垫', exact: true }).click()
    await expect(buyer.getByRole('heading', { level: 1, name: '原木手工杯垫' })).toBeVisible()
    await expect(buyer.locator('.trade-summary')).toContainText('15 个自然日')
    await expect(buyer.getByRole('region', { name: '现货直购' })).toBeVisible()
    const buyStock = buyer.getByRole('button', { name: '立即购买现货', exact: true })
    const checkout = buyer.getByRole('dialog', { name: '确认现货直购订单', exact: true })
    await buyStock.focus()
    await buyer.keyboard.press('Enter')
    await expect(checkout).toBeVisible()
    await expect(checkout.getByRole('button', { name: /^确认购买/ })).toBeDisabled()
    await buyer.keyboard.press('Escape')
    await expect(checkout).toBeHidden()
    await expect(buyStock).toBeFocused()
    await buyStock.click()
    await checkout.getByRole('link', { name: /管理收货地址/ }).click()
    await expect(buyer).toHaveURL('/account/addresses')
    const address = await mutate(buyer, '/me/addresses', 'post', { recipientName: '直购验收收件人', phone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', detailAddress: '现货直购验收路一号', isDefault: true })
    expect(address.status()).toBe(201)
    await buyer.goBack()
    let stockCreateAttempts = 0
    await buyer.route(`**/api/works/${workId}/orders`, async route => {
      stockCreateAttempts++
      const response = await route.fetch()
      if (stockCreateAttempts === 1) { expect(response.status()).toBe(201); await route.abort('failed'); return }
      expect(response.status()).toBe(200)
      await route.fulfill({ response })
    })
    await buyer.setViewportSize({ width: 1366, height: 900 })
    await buyStock.click()
    await expect(checkout.getByRole('radio', { name: /直购验收收件人/ })).toBeChecked()
    await buyer.screenshot({ path: testInfo.outputPath('stock-checkout-1366.png'), fullPage: true })
    await checkout.getByRole('button', { name: /^确认购买/ }).click()
    await expect(checkout.getByRole('status')).toContainText('建单结果尚未确认')
    expect(await buyer.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('stock-order:')))).toHaveLength(1)
    await buyer.reload()
    await expect(buyer.getByRole('button', { name: '重试确认建单结果', exact: true })).toBeVisible()
    await buyer.getByRole('button', { name: '重试确认建单结果', exact: true }).click()
    await expect(buyer).toHaveURL(/\/orders\/\d+$/)
    expect(stockCreateAttempts).toBe(2)
    await buyer.unroute(`**/api/works/${workId}/orders`)
    await expect(buyer).toHaveURL(/\/orders\/\d+$/)
    const stockOrderId = buyer.url().match(/orders\/(\d+)$/)![1]!
    await expect(selectedStatus(buyer)).toHaveText('待付款')
    await buyer.getByRole('button', { name: '模拟支付', exact: true }).click()
    await expect(buyer.getByRole('region', { name: '确认模拟支付' })).toContainText('138.60')
    await expect(buyer.getByRole('region', { name: '确认模拟支付' })).toContainText('现货直购验收路一号')
    await buyer.getByLabel('我已阅读并同意现货支付条款', { exact: true }).check()
    await buyer.getByRole('button', { name: '确认模拟支付', exact: true }).click()
    await expect(selectedStatus(buyer)).toHaveText('待发货')
    const paidStock = (await (await buyer.request.get(`${api}/orders/${stockOrderId}`)).json()).data
    const deadline = new Date(Date.parse(paidStock.paidAt) + 48 * 60 * 60 * 1000)
    expect(Date.parse(paidStock.shipDeadlineAt)).toBe(deadline.getTime())
    const deadlineText = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short',
    }).format(deadline)
    await expect(buyer.locator(`time[datetime="${paidStock.shipDeadlineAt}"]`).first()).toHaveText(deadlineText)
    await buyer.screenshot({ path: testInfo.outputPath('stock-paid-1366.png'), fullPage: true })
    await expect(buyer.locator('.fulfillment-panel')).toContainText('现货不经过制作节点')
    await expect(buyer.locator('.order-progress')).toHaveCount(0)
    // 现货会话只关联订单，不能生成指向空需求编号的链接。
    await buyer.setViewportSize({ width: 390, height: 360 })
    await buyer.getByRole('link', { name: '进入订单沟通', exact: true }).click()
    await expect(buyer).toHaveURL(/\/messages\/conversations\/\d+$/)
    await expect(buyer.getByRole('log', { name: '沟通消息' })).toBeVisible()
    await expect(buyer.getByRole('region', { name: '当前会话' }).locator('a[href^="/requests/"]')).toHaveCount(0)
    await expect(buyer.getByRole('link', { name: /返回会话列表/ })).toBeVisible()
    await expect(buyer.getByRole('button', { name: '返回订单' })).toBeVisible()
    expect(await buyer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await buyer.screenshot({ path: testInfo.outputPath('stock-conversation-390.png'), fullPage: true })
    await buyer.getByRole('button', { name: '返回订单' }).click()
    await expect(buyer).toHaveURL(`/orders/${stockOrderId}`)
    await buyer.setViewportSize({ width: 390, height: 1000 })
    await page.goto(`/orders/${stockOrderId}`)
    await page.getByRole('button', { name: '填写运单并发货', exact: true }).click()
    await page.getByLabel('运单号', { exact: true }).fill('BROWSER123456')
    await page.getByRole('button', { name: '确认发货', exact: true }).click()
    await expect(page.getByRole('region', { name: '发货与物流信息', exact: true })).toContainText('BROWSER123456')
    expect((await (await page.request.get(`${api}/orders/${stockOrderId}`)).json()).data.status).toBe('SHIPPED')
    await buyer.getByRole('button', { name: '确认收货', exact: true }).click()
    await buyer.getByRole('dialog').getByRole('button', { name: '确认收货', exact: true }).click()
    await expect(buyer.getByRole('region', { name: '发货与物流信息' })).toContainText('最初完成时间')
    expect((await (await buyer.request.get(`${api}/orders/${stockOrderId}`)).json()).data.status).toBe('COMPLETED')
    for (const width of [1366, 1440, 1920, 390]) {
      await buyer.setViewportSize({ width, height: 1000 })
      expect(await buyer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await buyer.goto(`/works/${workId}`)
    await buyer.getByRole('link', { name: /木间手作.*查看主页/ }).click()
    await expect(buyer.getByRole('heading', { level: 1, name: '木间手作' })).toBeVisible()
    const rating = buyer.locator('.creator-public-stats > div').filter({ has: buyer.getByText('口碑评分', { exact: true }) })
    await expect(rating.getByText('暂无评价', { exact: true })).toBeVisible()
    await expect(buyer.getByText('手作测试', { exact: true })).toHaveCount(0)
    await page.goto(`/creator/works/${workId}/edit`)
    await page.getByLabel('作品标题', { exact: true }).fill('原木手工圆杯垫')
    const originalMain = paidStock.agreementSnapshot.mainImageIds[0]
    const originalSpec = paidStock.agreementSnapshot.specificationImageIds[0]
    await page.getByLabel('作品主图', { exact: true }).setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: image })
    await expect(page.getByRole('img', { name: '作品主图 2', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '删除作品主图第1张', exact: true }).click()
    // 请求未到服务器：旧 ONLINE 记录不能被误认成本次修改成功。
    await page.route(`**/api/me/works/${workId}/submission`, route => route.abort('failed'))
    await page.getByRole('button', { name: '提交修改并重新审核', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确认提交', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('输入仍保留')
    await expect(page.getByLabel('作品标题', { exact: true })).toHaveValue('原木手工圆杯垫')
    await page.unroute(`**/api/me/works/${workId}/submission`)
    await page.getByRole('button', { name: '提交修改并重新审核', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确认提交', exact: true }).click()
    await expect(page.getByRole('heading', { name: '待审核作品', exact: true })).toBeVisible()
    expect((await buyer.request.get(`${api}/works/${workId}`)).status()).toBe(404)
    await admin.reload()
    await admin.getByRole('button', { name: '审核通过并上架', exact: true }).click()
    await admin.getByRole('dialog').getByRole('button', { name: '确认通过', exact: true }).click()
    await expect(admin.getByRole('status')).toContainText('作品已上架')
    const publicWork = (await (await buyer.request.get(`${api}/works/${workId}`)).json()).data
    expect(publicWork.mainImageIds).toHaveLength(1)
    expect(publicWork.mainImageIds).not.toContain(originalMain)
    await admin.getByLabel('审核意见', { exact: true }).fill('管理员验收下架，停止公开展示。')
    await admin.getByRole('button', { name: '下架作品', exact: true }).click()
    await admin.getByRole('dialog').getByRole('button', { name: '确认下架', exact: true }).click()
    await expect(admin.getByRole('status')).toContainText('已下架')
    expect((await buyer.request.get(`${api}/works/${workId}`)).status()).toBe(404)
    // 成交图仍由原订单签发，并在买入与承接详情加载真实图片。
    for (const actor of [buyer, page]) {
      await actor.goto(`/orders/${stockOrderId}`)
      await actor.getByRole('link', { name: '现货作品快照', exact: true }).click()
      for (const [fileId, label] of [[originalMain, '成交主图 1'], [originalSpec, '成交规格图 1']]) {
        const signed = await actor.request.get(`${api}/orders/${stockOrderId}/stock-images/${fileId}`)
        expect(signed.status()).toBe(200)
        const signedImage = (await signed.json()).data
        const displayed = actor.getByRole('img', { name: label, exact: true })
        await expect.poll(() => displayed.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0)
        expect(new URL((await displayed.getAttribute('src'))!).pathname).toBe(new URL(signedImage.url).pathname)
      }
      expect((await actor.request.get(`${api}/orders/${stockOrderId}/stock-images/${publicWork.mainImageIds[0]}`)).status()).toBe(404)
    }
    await buyer.goto('/?keyword=原木手工圆杯垫')
    await expect(buyer.getByText('还没有符合条件的作品')).toBeVisible()
    await page.goto('/messages/notifications')
    await expect(page.getByRole('article').filter({ hasText: '管理员验收下架' })).toBeVisible()
  } finally { await adminContext.close(); await buyerContext.close() }
})

test('两位买家同时购买同一件现货，仅首个有效订单可支付', async ({ page: creator, browser, mailbox }) => {
  test.setTimeout(180_000)
  const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext({ baseURL: frontendOrigin })))
  try {
    const [admin, firstBuyer, secondBuyer] = await Promise.all(contexts.map(context => context.newPage()))
    const { categoryId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    const title = '并发现货验收木杯垫'
    const workId = await publishBrowseWork(creator, admin, {
      title, categoryId, stockPrice: '100.00', customReferenceDays: null,
      description: '圆形木制杯垫，保留原木纹理。边缘经过手工打磨并涂以透明木蜡油，可用于日常茶具。灵感来自自然原木。',
    })
    const buyers = await Promise.all([firstBuyer, secondBuyer].map(async (page, index) => {
      await register(page, mailbox.codes, index === 0 ? '首位并发买家' : '次位并发买家')
      const address = await mutate(page, '/me/addresses', 'post', {
        recipientName: '现货收件人', phone: '13800138000', province: '北京市', city: '市辖区',
        district: '东城区', detailAddress: '并发现货验收路一号', isDefault: true,
      })
      expect(address.status()).toBe(201)
      const { id: addressId } = (await address.json()).data as { id: string }
      const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
      return { page, addressId, headers: { [csrf.headerName]: csrf.token } }
    }))

    // 两个独立登录会话先准备地址和 CSRF，再并行向真实后端提交同一件现货。
    const orderPath = `/works/${workId}/orders`
    const responses = await Promise.all(buyers.map(({ page, addressId, headers }) => page.request.post(`${api}${orderPath}`, {
      data: { addressId, requestKey: randomUUID() }, headers,
    })))
    expect(responses.map(response => response.status()).sort()).toEqual([201, 409])
    const winnerIndex = responses[0].status() === 201 ? 0 : 1
    const winner = buyers[winnerIndex]
    const loser = buyers[1 - winnerIndex]
    const order = (await responses[winnerIndex].json()).data
    expect(order).toMatchObject({ orderType: 'STOCK', status: 'PENDING_PAY', totalAmount: '100.00' })

    const orders = await creator.request.get(`${api}/me/orders?side=CREATOR`)
    expect(orders.status()).toBe(200)
    expect((await orders.json()).data).toMatchObject({ total: 1, items: [{ id: order.id, status: 'PENDING_PAY' }] })
    const payment = { termsConfirmed: true, termsVersion: order.paymentPreview.termsVersion }
    expect((await mutate(loser.page, `/orders/${order.id}/payment`, 'put', payment)).status()).toBe(404)

    await winner.page.goto(`/orders/${order.id}`)
    await expect(selectedStatus(winner.page)).toHaveText('待付款')
    await winner.page.getByRole('button', { name: '模拟支付', exact: true }).click()
    await winner.page.getByLabel('我已阅读并同意现货支付条款', { exact: true }).check()
    await winner.page.getByRole('button', { name: '确认模拟支付', exact: true }).click()
    await expect(selectedStatus(winner.page)).toHaveText('待发货')
    const paid = await winner.page.request.get(`${api}/orders/${order.id}`)
    expect(paid.status()).toBe(200)
    expect((await paid.json()).data).toMatchObject({ status: 'PENDING_SHIP', payment: { result: 'SUCCESS', amount: '100.00' } })

    await loser.page.goto(`/works/${workId}`)
    await expect(loser.page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(loser.page.getByText('现货已售出', { exact: true })).toBeVisible()
    await expect(loser.page.getByRole('button', { name: '立即购买现货', exact: true })).toHaveCount(0)
    expect((await mutate(loser.page, orderPath, 'post', { addressId: loser.addressId, requestKey: randomUUID() })).status()).toBe(409)
    const rejectedBuyerOrders = await loser.page.request.get(`${api}/me/orders?side=BUYER`)
    expect(rejectedBuyerOrders.status()).toBe(200)
    expect((await rejectedBuyerOrders.json()).data.total).toBe(0)
  } finally {
    await Promise.all(contexts.map(context => context.close()))
  }
})

test('取消现货订单后另一位买家可下单，订单列表保留承接筛选和页码', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(180_000)
  const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext({
    baseURL: frontendOrigin, viewport: { width: 1366, height: 900 },
  })))
  try {
    const [admin, buyer, nextBuyer] = await Promise.all(contexts.map(context => context.newPage()))
    const { categoryId } = await prepareCreator(page, admin, mailbox.codes, mailbox.promoteAdmin)
    const title = '取消释放现货验收杯垫'
    const workId = await publishBrowseWork(page, admin, {
      title, categoryId, stockPrice: '88.00', customReferenceDays: null,
      description: '圆形木制杯垫，保留原木纹理。边缘经过手工打磨并涂以透明木蜡油，可用于日常茶具。灵感来自自然原木。',
    })
    await register(buyer, mailbox.codes, '首位现货买家')
    await register(nextBuyer, mailbox.codes, '后续现货买家')
    const addressFields = {
      recipientName: '现货收件人', phone: '13800138000', province: '北京市', city: '市辖区',
      district: '东城区', detailAddress: '现货验收路一号', isDefault: true,
    }
    const buyerAddress = await mutate(buyer, '/me/addresses', 'post', addressFields)
    expect(buyerAddress.status()).toBe(201)
    expect((await mutate(nextBuyer, '/me/addresses', 'post', addressFields)).status()).toBe(201)
    const { id: addressId } = (await buyerAddress.json()).data
    const create = () => mutate(buyer, `/works/${workId}/orders`, 'post', { addressId, requestKey: randomUUID() })

    const first = await create()
    expect(first.status()).toBe(201)
    const { id: firstOrderId } = (await first.json()).data
    await nextBuyer.goto(`/works/${workId}`)
    await expect(nextBuyer.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(nextBuyer.getByRole('button', { name: '立即购买现货', exact: true })).toHaveCount(0)
    await buyer.goto(`/orders/${firstOrderId}`)
    await buyer.getByRole('button', { name: '取消订单', exact: true }).click()
    await buyer.getByRole('dialog').getByRole('button', { name: '确认取消订单', exact: true }).click()
    await expect(selectedStatus(buyer)).toHaveText('已取消')
    await expect(buyer.getByRole('link', { name: '进入订单沟通', exact: true })).toBeVisible()

    // 通过真实建单、取消生成第二页，核验列表服务端分页与双方实际交易关系。
    for (let count = 0; count < 20; count++) {
      const created = await create()
      expect(created.status()).toBe(201)
      const { id } = (await created.json()).data
      expect((await mutate(buyer, `/orders/${id}/cancellation`, 'put')).status()).toBe(200)
    }
    await nextBuyer.reload()
    await nextBuyer.getByRole('button', { name: '立即购买现货', exact: true }).click()
    await nextBuyer.getByRole('dialog', { name: '确认现货直购订单', exact: true })
      .getByRole('button', { name: /^确认购买/ }).click()
    await expect(nextBuyer).toHaveURL(/\/orders\/\d+$/)
    expect(new URL(nextBuyer.url()).pathname).not.toBe(`/orders/${firstOrderId}`)

    await page.goto('/orders')
    await expect(page.getByRole('heading', { name: '暂无订单', exact: true })).toBeVisible()
    await page.getByRole('link', { name: '我承接的', exact: true }).click()
    const status = page.getByLabel('订单状态', { exact: true })
    await status.selectOption('CANCELLED')
    const orderList = page.getByRole('region', { name: '订单列表', exact: true })
    const firstOrder = orderList.getByRole('link', { name: title, exact: true })
    await expect(firstOrder).toHaveCount(20)
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    await expect(page).toHaveURL('/orders?side=CREATOR&status=CANCELLED&page=2')
    await expect(firstOrder).toHaveCount(1)
    await expect(firstOrder).toHaveAttribute('href', `/orders/${firstOrderId}?side=CREATOR&status=CANCELLED&page=2`)
    await expect(orderList).not.toContainText(/工期|个自然日/)
    await firstOrder.click()
    await expect(page).toHaveURL(`/orders/${firstOrderId}?side=CREATOR&status=CANCELLED&page=2`)
    await expect(firstOrder).toHaveAttribute('aria-current', 'page')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('order-collection-detail-1366.png'), fullPage: true })
    await page.getByRole('link', { name: /返回订单列表/ }).click()
    await expect(page).toHaveURL('/orders?side=CREATOR&status=CANCELLED&page=2')
    await expect(status).toHaveValue('CANCELLED')
    await expect(firstOrder).toHaveCount(1)

    await buyer.goto('/orders?status=CANCELLED')
    await expect(buyer.getByRole('link', { name: '我购买的', exact: true })).toBeVisible()
    await expect(buyer.getByRole('region', { name: '订单列表' }).getByRole('link', { name: title, exact: true })).toHaveCount(20)
    await nextBuyer.goto(`/orders/${firstOrderId}`)
    await expect(nextBuyer.getByRole('alert')).toBeVisible()
    await expect(nextBuyer.getByRole('heading', { name: title, exact: true })).toHaveCount(0)
  } finally {
    await Promise.all(contexts.map(context => context.close()))
  }
})

test('草稿响应丢失、断网保留、续签、撤回删除与初始化失败保护', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: frontendOrigin })
  try {
    const admin = await adminContext.newPage()
    const { categoryId } = await prepareCreator(page, admin, mailbox.codes, mailbox.promoteAdmin)
    await page.goto('/creator/works/new')
    await page.getByRole('button', { name: '提交审核', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('请检查')
    await page.clock.install()
    let signatures = 0
    await page.route('**/api/work-images/*', async route => {
      signatures++
      const response = await route.fetch()
      const body = await response.json()
      body.data.expiresAt = new Date(Date.now() + 26_000).toISOString()
      await route.fulfill({ response, json: body })
    })
    await fillWork(page, categoryId, '竹编收纳篮')
    await page.clock.fastForward(7000)
    await expect.poll(() => signatures).toBeGreaterThanOrEqual(2)
    await page.unroute('**/api/work-images/*')
    await page.clock.resume()
    let releaseUpload!: () => void
    const uploadGate = new Promise<void>(resolve => { releaseUpload = resolve })
    await page.route('**/api/work-images', async route => { await uploadGate; const response = await route.fetch(); await route.fulfill({ response }) })
    await page.getByLabel('作品主图', { exact: true }).setInputFiles({ name: 'detail.png', mimeType: 'image/png', buffer: image })
    await expect(page.getByRole('button', { name: '提交审核', exact: true })).toBeDisabled()
    releaseUpload()
    await expect(page.getByRole('img', { name: '作品主图 2', exact: true })).toBeVisible()
    await page.unroute('**/api/work-images')
    // 创建确已成功但响应丢失，重试必须复用原请求键。
    let creates = 0
    await page.route('**/api/me/works', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      creates++
      const response = await route.fetch()
      if (creates === 1) { expect(response.status()).toBe(201); return route.abort('failed') }
      expect(response.status()).toBe(200)
      await route.fulfill({ response })
    })
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('输入仍保留')
    expect((await (await page.request.get(`${api}/me/works`)).json()).data.total).toBe(1)
    await page.unroute('**/api/me/works')
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(page).toHaveURL(/\/creator\/works\/\d+\/edit$/)
    const editUrl = page.url()
    const workId = editUrl.match(/works\/(\d+)/)![1]!
    await page.getByLabel('作品标题', { exact: true }).fill('竹编收纳篮补充')
    await page.getByRole('link', { name: '我的作品', exact: true }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click()
    await expect(page).toHaveURL(editUrl)
    await expect(page.getByLabel('作品标题', { exact: true })).toHaveValue('竹编收纳篮补充')
    await page.route(`**/api/me/works/${workId}`, route => route.abort('failed'))
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('网络中断')
    await expect(page.getByRole('alert')).toBeInViewport()
    const reconcile = page.getByRole('button', { name: '核验最新状态', exact: true })
    await expect(reconcile).toBeInViewport()
    await expect(page.getByLabel('作品标题', { exact: true })).toHaveValue('竹编收纳篮补充')
    await expect(page.getByRole('button', { name: '提交审核', exact: true })).toBeDisabled()
    await page.unroute(`**/api/me/works/${workId}`)
    await reconcile.click()
    await page.getByRole('button', { name: '提交审核', exact: true }).click()
    await expect(page.getByRole('heading', { name: '待审核作品', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '撤回审核', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确认撤回', exact: true }).click()
    await expect(page.getByLabel('作品标题', { exact: true })).toHaveValue('竹编收纳篮补充')
    await page.getByRole('link', { name: '我的作品', exact: true }).first().click()
    await page.getByRole('button', { name: '删除草稿', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确认删除', exact: true }).click()
    await expect(page.locator('.managed-work-row')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    // 已删除或初始化失败的编辑链接不能悄悄创建另一件作品。
    await page.goto(editUrl)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('button', { name: '保存草稿', exact: true })).toHaveCount(0)
    expect((await (await page.request.get(`${api}/me/works`)).json()).data.total).toBe(0)
  } finally { await adminContext.close() }
})

test('作品详情、创作者主页与管理页均要求真实登录，安全回跳保留目标', async ({ page }) => {
  for (const path of ['/works/123', '/creators/123', '/creator/works/new', '/admin/works/123']) {
    await page.goto(path)
    await expect.poll(() => new URL(page.url()).searchParams.get('redirect')).toBe(path)
    expect(new URL(page.url()).pathname).toBe('/login')
  }
})

test('编辑未保存或上传中仍可退出，会话过期不能被离开确认阻挡', async ({ page, browser, mailbox }) => {
  test.setTimeout(120_000)
  const adminContext = await browser.newContext({ baseURL: frontendOrigin })
  let releaseUpload: (() => void) | undefined
  // 身份失效后的跳转不应再询问是否留在受保护表单。
  page.on('dialog', dialog => dialog.dismiss())
  try {
    const admin = await adminContext.newPage()
    await prepareCreator(page, admin, mailbox.codes, mailbox.promoteAdmin)
    const email = (await (await page.request.get(`${api}/sessions/current`)).json()).data.email as string
    async function reopen() {
      expect((await mutate(page, '/sessions', 'post', { email, password: 'CraftTest123' })).status()).toBe(201)
      await page.goto('/creator/works/new')
      await expect(page.getByLabel('作品标题', { exact: true })).toBeVisible()
    }
    await page.goto('/creator/works/new')
    await page.getByLabel('作品标题', { exact: true }).fill('退出前未保存作品')
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)

    await reopen()
    const uploadGate = new Promise<void>(resolve => { releaseUpload = resolve })
    let uploadStarted = false
    let finishUpload!: () => void
    const uploadHandled = new Promise<void>(resolve => { finishUpload = resolve })
    await page.route('**/api/work-images', async route => {
      uploadStarted = true
      await uploadGate
      try { await route.abort('failed') } finally { finishUpload() }
    })
    await page.getByLabel('作品主图', { exact: true }).setInputFiles({ name: 'uploading.png', mimeType: 'image/png', buffer: image })
    await expect.poll(() => uploadStarted).toBe(true)
    await expect(page.getByRole('button', { name: '提交审核', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    releaseUpload!()
    await uploadHandled
    await page.unroute('**/api/work-images')

    await reopen()
    await page.getByLabel('作品标题', { exact: true }).fill('会话到期前未保存作品')
    const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
    expect((await page.request.delete(`${api}/sessions/current`, { headers: { [csrf.headerName]: csrf.token } })).status()).toBe(200)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(page).toHaveURL(/\/login\?redirect=.*reason=expired/)
    await expect(page.getByLabel('作品标题', { exact: true })).toHaveCount(0)
  } finally { releaseUpload?.(); await adminContext.close() }
})
