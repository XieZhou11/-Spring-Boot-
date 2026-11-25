import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { test, expect, frontendOrigin } from './fixtures'
import { api, image, mutate, prepareCreator, register } from './custom-request-support'

// 使用真实账号、MySQL 和存储协议接收器验证页面流转，不伪造业务接口。
test.use({ storageMode: 'receiver' })

/** 只在随机隔离库创建真实待审作品，用于审核交互验收。 */
async function pendingWork(creator: Page, categoryId: string) {
    const csrf = (await (await creator.request.get(`${api}/csrf`)).json()).data
    const upload = await creator.request.post(`${api}/work-images`, { headers: { [csrf.headerName]: csrf.token }, multipart: { file: { name: 'work.png', mimeType: 'image/png', buffer: image } } })
    expect(upload.status()).toBe(201)
    const content = { title: '双栏审核手工书签', categoryId, mainImageIds: [(await upload.json()).data.id], specificationImageIds: [], material: '胡桃木', specification: '十二厘米', description: '手工打磨的原木书签，保留天然木纹，使用天然木蜡油养护，日常使用请保持干燥，避免长时间浸泡。', processDescription: '', saleEnabled: false, customEnabled: false, stockPrice: null, customReferenceDays: null }
    const draft = (await (await mutate(creator, '/me/works', { ...content, requestKey: randomUUID() })).json()).data
    expect((await mutate(creator, `/me/works/${draft.id}/submission`, { ...content, version: draft.version }, 'put')).status()).toBe(200)
  return { content, draft }
}

test('买家一级导航独立承载需求与消息，个人中心只维护账号信息', async ({ page, mailbox }, testInfo) => {
  await register(page, mailbox.codes, '导航买家')
  await page.goto('/')
  const navigation = page.getByRole('navigation', { name: '主导航', exact: true })
  await expect(page).toHaveTitle('作品广场 · 匠心集 CraftFlow')
  await expect(navigation.getByRole('link', { name: '发现作品', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(navigation.getByRole('link', { name: '我的需求', exact: true })).toBeVisible()
  await expect(navigation.getByRole('link', { name: '需求大厅', exact: true })).toHaveCount(0)
  for (const width of [1366, 1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('banner').getByRole('link', { name: '发布定制需求', exact: true }).click()
  await expect(page).toHaveURL('/my-requests/new')
  await page.getByRole('link', { name: '我的需求', exact: true }).first().click()
  await expect(page).toHaveURL('/my-requests')
  await expect(navigation.getByRole('link', { name: '我的需求', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('link', { name: /个人中心/ }).click()
  const account = page.getByRole('navigation', { name: '个人中心', exact: true })
  await expect(account.getByRole('link', { name: /我的需求|需求沟通|系统通知/ })).toHaveCount(0)
  await page.getByRole('link', { name: '消息中心', exact: true }).click()
  await expect(page).toHaveURL('/messages/conversations')
  await expect(page.locator('.account-sidebar')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '消息中心', exact: true })).toBeVisible()
  await page.goto('/account/requests/new?creatorId=123#materials')
  await expect(page).toHaveURL('/my-requests/new?creatorId=123#materials')
  await page.goto('/account/notifications')
  await expect(page).toHaveURL('/messages/notifications')
})

test('管理员默认进入独立后台，审核队列与详情同时显示且保留筛选', async ({ page, browser, mailbox }, testInfo) => {
  const creatorContext = await browser.newContext({ baseURL: frontendOrigin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, page, mailbox.codes, mailbox.promoteAdmin)
    const { content } = await pendingWork(creator, categoryId)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page).toHaveURL('/admin/dashboard')
    await expect(page.getByRole('searchbox', { name: '搜索作品', exact: true })).toHaveCount(0)
    const adminNavigation = page.getByRole('navigation', { name: '后台管理' })
    await expect(adminNavigation).toBeVisible()
    const sidebar = page.locator('.admin-sidebar')
    expect(await sidebar.evaluate(node => getComputedStyle(node).position)).toBe('fixed')
    await adminNavigation.getByRole('link', { name: '作品审核', exact: true }).click()
    await expect(page).toHaveURL('/admin/works')
    await page.getByRole('searchbox', { name: '搜索作品', exact: false }).fill('双栏审核')
    await page.getByRole('button', { name: '搜索', exact: true }).click()
    await page.getByRole('link', { name: /审核作品/ }).click()
    await expect(page.locator('.review-queue .managed-work-row').filter({ hasText: content.title })).toBeVisible()
    await expect(page.locator('.review-detail').getByRole('heading', { name: content.title, exact: true })).toBeVisible()
    const queue = await page.locator('.review-queue').boundingBox()
    const detail = await page.locator('.review-detail').boundingBox()
    expect(queue!.x + queue!.width).toBeLessThan(detail!.x)
    await expect(page.getByRole('button', { name: '审核通过并上架', exact: true })).toBeInViewport()
    expect(new URL(page.url()).searchParams.get('keyword')).toBe('双栏审核')
    await page.screenshot({ path: testInfo.outputPath('admin-review-desktop.png'), fullPage: true })
    await page.reload()
    await expect(page.getByRole('searchbox', { name: '搜索作品', exact: false })).toHaveValue('双栏审核')
    await page.getByLabel('审核意见', { exact: true }).fill('请补充书签的边缘处理说明。')
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: '驳回作品', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('已驳回')
    await expect(page.locator('.review-queue .managed-work-row').filter({ hasText: content.title })).toHaveCount(0)
    await page.goBack()
    await expect(page.getByRole('searchbox', { name: '搜索作品', exact: false })).toHaveValue('双栏审核')
    await page.goto('/admin/creator-applications?status=APPROVED')
    await page.getByRole('link', { name: /查看材料/ }).first().click()
    await expect(page.locator('.review-queue .review-table')).toBeVisible()
    await expect(page.locator('.review-detail .application-materials')).toBeVisible()
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath('admin-review-mobile.png'), fullPage: true })
  } finally { await creatorContext.close() }
})

for (const kind of ['作品', '入驻'] as const) {
  test(`${kind}审核取消筛选保留原队列，退出登录清理未提交材料`, async ({ page, browser, mailbox }) => {
    const creatorContext = await browser.newContext({ baseURL: frontendOrigin })
    try {
      const creator = await creatorContext.newPage()
      const { categoryId, applicationId } = await prepareCreator(creator, page, mailbox.codes, mailbox.promoteAdmin, kind === '作品')
      const id = kind === '作品' ? String((await pendingWork(creator, categoryId)).draft.id) : applicationId
      const path = kind === '作品' ? `/admin/works/${id}` : `/admin/creator-applications/${id}`
      await page.goto(path)
      await page.getByLabel('审核意见', { exact: true }).fill('尚未提交的核对意见')
      page.on('dialog', dialog => dialog.dismiss())
      if (kind === '作品') {
        await page.getByRole('button', { name: '已上架', exact: true }).click()
        await expect.soft(page.getByRole('button', { name: '待审核', exact: true })).toHaveClass(/active/)
      } else {
        await page.getByLabel('审核状态', { exact: true }).selectOption('APPROVED')
        await expect.soft(page.getByLabel('审核状态', { exact: true })).toHaveValue('PENDING')
      }
      await expect(page).toHaveURL(path)
      await expect(page.getByLabel('审核意见', { exact: true })).toHaveValue('尚未提交的核对意见')
      await page.getByRole('button', { name: '退出登录', exact: true }).click()
      await expect(page).toHaveURL('/login')
      await expect(page.locator('.review-detail')).toHaveCount(0)
      expect((await page.request.get(`${api}/sessions/current`)).status()).toBe(401)
    } finally { await creatorContext.close() }
  })
}
