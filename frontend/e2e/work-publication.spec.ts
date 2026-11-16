import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

import { api, origin } from './environment'
const image = readFileSync(new URL('./avatar.png', import.meta.url))
test.use({ storageMode: 'receiver', actionTimeout: 15_000 })

/** 走真实注册及会话，不依赖开发账号或浏览器持久化令牌。 */
async function register(page: Page, codes: Map<string, string>, nickname = '作品访客') {
  const email = `works-${randomBytes(6).toString('hex')}@qq.com`
  async function post(path: string, data: object) {
    const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
    return page.request.post(`${api}${path}`, { data, headers: { [csrf.headerName]: csrf.token } })
  }
  expect((await post('/email-verification-codes', { email })).status()).toBe(201)
  await expect.poll(() => codes.get(email)).toMatch(/^\d{6}$/)
  expect((await post('/accounts', { email, nickname, password: 'CraftTest123', verificationCode: codes.get(email) })).status()).toBe(201)
  expect((await post('/sessions', { email, password: 'CraftTest123' })).status()).toBe(201)
  return email
}

test('买家进入作品发现首页，保留当前账号、搜索及退出入口', async ({ page, mailbox }) => {
  await register(page, mailbox.codes)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '发现手作之美' })).toBeVisible()
  await expect(page.getByRole('link', { name: /作品访客/ })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: '搜索作品' })).toBeVisible()
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
  return { categoryId, categoryName }
}
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
  const adminContext = await browser.newContext({ baseURL: origin })
  const buyerContext = await browser.newContext({ baseURL: origin })
  page.on('dialog', dialog => dialog.accept())
  try {
    const admin = await adminContext.newPage()
    admin.on('dialog', dialog => dialog.accept())
    const { categoryId } = await prepareCreator(page, admin, mailbox.codes, mailbox.promoteAdmin)
    await page.goto('/creator/works/new')
    await fillWork(page, categoryId)
    for (const width of [1366, 1440, 1920, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath('editor-390.png'), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(page).toHaveURL(/\/creator\/works\/\d+\/edit$/)
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
    await admin.getByRole('link', { name: /审核作品/ }).click()
    await expect(admin).toHaveURL(`/admin/works/${workId}`)
    for (const width of [1366, 1440, 1920, 390]) {
      await admin.setViewportSize({ width, height: 1000 })
      expect(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await admin.setViewportSize({ width: 1440, height: 1000 })
    await admin.screenshot({ path: testInfo.outputPath('admin-work-1440.png'), fullPage: true })
    await admin.getByLabel('审核意见', { exact: true }).fill('请补充表面处理和保养说明。')
    await admin.getByRole('button', { name: '驳回作品', exact: true }).click()
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
    await expect(admin.getByRole('status')).toContainText('作品已上架')
    await page.reload()
    await page.getByLabel('成品售价（元）', { exact: true }).fill('138.60')
    await page.getByLabel('同类定制参考周期（天）', { exact: true }).fill('15')
    await page.getByRole('button', { name: '即时更新交易设置', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('作品保持上架')
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
    for (const width of [1366, 1440, 1920, 390]) {
      await buyer.setViewportSize({ width, height: 1000 })
      expect(await buyer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await buyer.getByRole('link', { name: /木间手作.*查看主页/ }).click()
    await expect(buyer.getByRole('heading', { level: 1, name: '木间手作' })).toBeVisible()
    await expect(buyer.getByText('暂无评价', { exact: true })).toBeVisible()
    await expect(buyer.getByText('手作测试', { exact: true })).toHaveCount(0)
    await page.getByLabel('作品标题', { exact: true }).fill('原木手工圆杯垫')
    // 请求未到服务器：旧 ONLINE 记录不能被误认成本次修改成功。
    await page.route(`**/api/me/works/${workId}/submission`, route => route.abort('failed'))
    await page.getByRole('button', { name: '提交修改并重新审核', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('输入仍保留')
    await expect(page.getByLabel('作品标题', { exact: true })).toHaveValue('原木手工圆杯垫')
    await page.unroute(`**/api/me/works/${workId}/submission`)
    await page.getByRole('button', { name: '提交修改并重新审核', exact: true }).click()
    await expect(page.getByRole('heading', { name: '待审核作品', exact: true })).toBeVisible()
    expect((await buyer.request.get(`${api}/works/${workId}`)).status()).toBe(404)
    await admin.reload()
    await admin.getByRole('button', { name: '审核通过并上架', exact: true }).click()
    await expect(admin.getByRole('status')).toContainText('作品已上架')
    await admin.getByLabel('审核意见', { exact: true }).fill('管理员验收下架，停止公开展示。')
    await admin.getByRole('button', { name: '下架作品', exact: true }).click()
    await expect(admin.getByRole('status')).toContainText('已下架')
    expect((await buyer.request.get(`${api}/works/${workId}`)).status()).toBe(404)
    await buyer.goto('/?keyword=原木手工圆杯垫')
    await expect(buyer.getByText('还没有符合条件的作品')).toBeVisible()
    await page.goto('/account/notifications')
    await expect(page.getByRole('article').filter({ hasText: '管理员验收下架' })).toBeVisible()
  } finally { await adminContext.close(); await buyerContext.close() }
})

test('草稿响应丢失、断网保留、续签、撤回删除与初始化失败保护', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  page.on('dialog', dialog => dialog.accept())
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
    page.removeAllListeners('dialog')
    page.once('dialog', dialog => dialog.dismiss())
    await page.getByRole('link', { name: '我的作品', exact: true }).first().click()
    await expect(page).toHaveURL(editUrl)
    await expect(page.getByLabel('作品标题', { exact: true })).toHaveValue('竹编收纳篮补充')
    page.on('dialog', dialog => dialog.accept())
    await page.route(`**/api/me/works/${workId}`, route => route.abort('failed'))
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('网络中断')
    await expect(page.getByLabel('作品标题', { exact: true })).toHaveValue('竹编收纳篮补充')
    await expect(page.getByRole('button', { name: '提交审核', exact: true })).toBeDisabled()
    await page.unroute(`**/api/me/works/${workId}`)
    await page.getByRole('button', { name: '核验最新状态', exact: true }).click()
    await page.getByRole('button', { name: '提交审核', exact: true }).click()
    await expect(page.getByRole('heading', { name: '待审核作品', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '撤回审核', exact: true }).click()
    await expect(page.getByLabel('作品标题', { exact: true })).toHaveValue('竹编收纳篮补充')
    await page.getByRole('link', { name: '我的作品', exact: true }).first().click()
    await page.getByRole('button', { name: '删除草稿', exact: true }).click()
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
  const adminContext = await browser.newContext({ baseURL: origin })
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
