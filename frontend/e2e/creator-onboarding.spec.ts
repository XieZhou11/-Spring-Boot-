import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { errors } from '@playwright/test'
import type { Page } from '@playwright/test'
import { test, expect, frontendOrigin } from './fixtures'

import { api } from './environment'
const portfolioImage = readFileSync(new URL('./avatar.png', import.meta.url))

// 入驻验收通过真实 OSS SDK 对接本地协议接收器，不伪造图片上传响应。
test.use({ storageMode: 'receiver' })

/** 注册隔离账号并建立真实会话，测试不读取本地真实个人凭据。 */
async function createApplicant(page: Page, codes: Map<string, string>) {
  const email = `onboard-${randomBytes(6).toString('hex')}@qq.com`
  async function post(path: string, data: object) {
    const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
    return page.request.post(`${api}${path}`, { data, headers: { [csrf.headerName]: csrf.token } })
  }
  expect((await post('/email-verification-codes', { email })).status()).toBe(201)
  await expect.poll(() => codes.get(email)).toMatch(/^\d{6}$/)
  expect((await post('/accounts', { email, nickname: '原创手作', password: 'CraftTest123', verificationCode: codes.get(email) })).status()).toBe(201)
  expect((await post('/sessions', { email, password: 'CraftTest123' })).status()).toBe(201)
  return email
}

async function fillMaterials(page: Page, category: string) {
  await page.getByLabel('申请人姓名', { exact: true }).fill('原创测试')
  await page.getByLabel('联系电话', { exact: true }).fill('13800138000')
  await page.getByLabel('手动填写省市区').check()
  await page.getByLabel('省 / 自治区 / 直辖市').fill('北京市')
  await page.getByLabel('市', { exact: true }).fill('市辖区')
  await page.getByLabel('区 / 县').fill('东城区')
  await page.getByLabel(category, { exact: true }).check()
  await page.getByLabel('从业年限', { exact: true }).fill('6')
  await page.getByLabel('手艺与个人介绍').fill('我专注于传统陶艺与手工制作，习惯记录每一道工序，从选材、塑形到完成，都由本人独立制作。希望用扎实的手艺分享日常生活的温度。')
  await page.getByLabel('支付宝账号', { exact: true }).fill('13800138000')
  await page.getByLabel('收款人姓名', { exact: true }).fill('原创测试')
  for (let index = 1; index <= 3; index++) {
    for (const kind of ['成品图', '过程图']) {
      const response = page.waitForResponse(r => r.url().endsWith('/creator-application-images') && r.request().method() === 'POST')
      await page.getByLabel(`上传作品${index}${kind}`, { exact: true }).setInputFiles({ name: 'portfolio.png', mimeType: 'image/png', buffer: portfolioImage })
      expect((await response).status()).toBe(201)
      await expect(page.getByLabel(`上传作品${index}${kind}`, { exact: true })).toBeEnabled()
    }
  }
}

async function submitMaterials(page: Page) {
  const result = page.waitForResponse(r => r.url().endsWith('/me/creator-applications') && r.request().method() === 'POST')
  await page.getByRole('button', { name: '提交入驻申请', exact: true }).click()
  const response = await result
  expect(response.status()).toBe(201)
  const application = (await response.json()).data as { id: string }
  await expect(page.locator('.certification-overview .status-pill')).toHaveText('待审核')
  return application.id
}

test('入驻、通知及后台路由未登录保留目标地址', async ({ page }) => {
  for (const path of ['/account/creator-certification', '/messages/notifications', '/admin/creator-applications', '/admin/categories']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login\?redirect=/)
    expect(new URL(page.url()).searchParams.get('redirect')).toBe(path)
  }
})

test('普通买家可填写入驻材料且错误保留输入，不能访问后台', async ({ page, mailbox }) => {
  await createApplicant(page, mailbox.codes)
  await page.goto('/account/creator-certification')
  await expect(page.getByRole('heading', { level: 1, name: '创作者入驻' })).toBeVisible()
  await page.getByRole('button', { name: '开始申请', exact: true }).click()
  await page.getByLabel('申请人姓名', { exact: true }).fill('原创测试')
  await page.getByRole('button', { name: '提交入驻申请', exact: true }).click()
  await expect(page.getByLabel('联系电话', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('申请人姓名', { exact: true })).toHaveValue('原创测试')
  await expect(page.getByRole('group', { name: /^原创作品/ })).toHaveCount(3)
  await page.getByRole('button', { name: /添加一件原创作品/ }).click()
  await page.getByRole('button', { name: /添加一件原创作品/ }).click()
  await expect(page.getByRole('group', { name: /^原创作品/ })).toHaveCount(5)
  await expect(page.getByRole('button', { name: /添加一件原创作品/ })).toHaveCount(0)
  await page.goto('/admin/categories')
  await expect(page).toHaveURL('/')
  expect((await page.request.get(`${api}/admin/categories`)).status()).toBe(403)
})

test('入驻撤回重提、管理员驳回补正通过、实时通知及会话身份切换', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1366, height: 1000 })
  const adminContext = await browser.newContext({ baseURL: frontendOrigin, viewport: { width: 1366, height: 1000 } })
  const secondContext = await browser.newContext({ baseURL: frontendOrigin })
  try {
    const admin = await adminContext.newPage()
    const adminEmail = await createApplicant(admin, mailbox.codes)
    await mailbox.promoteAdmin(adminEmail)
    await admin.goto('/admin/categories')
    await expect(admin.getByRole('heading', { level: 1, name: '手作品类管理' })).toBeVisible()
    await expect(admin.locator('.identity-label')).toHaveText('管理员身份')
    await admin.getByRole('button', { name: '新增一级品类', exact: false }).click()
    const categoryName = `陶艺${randomBytes(3).toString('hex')}`
    const categoryEditor = admin.getByRole('dialog')
    await categoryEditor.getByLabel('品类名称', { exact: true }).fill(categoryName)
    await categoryEditor.getByRole('button', { name: '保存品类', exact: true }).click()
    await expect(admin.getByRole('article').filter({ hasText: categoryName })).toBeVisible()

    const applicantEmail = await createApplicant(page, mailbox.codes)
    const originalSession = (await (await page.request.get(`${api}/sessions/current`)).json()).data
    const second = await secondContext.newPage()
    const csrf = (await (await second.request.get(`${api}/csrf`)).json()).data
    expect((await second.request.post(`${api}/sessions`, { headers: { [csrf.headerName]: csrf.token }, data: { email: applicantEmail, password: 'CraftTest123' } })).status()).toBe(201)
    await page.goto('/account/creator-certification')
    await page.getByRole('button', { name: '开始申请', exact: true }).click()
    await page.getByLabel('上传作品1成品图', { exact: true }).setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') })
    await expect(page.getByRole('alert')).toContainText('JPEG、PNG 或 WebP')
    // 路径上传保留相同超限边界，避免把大文件经浏览器协议反复编码拷贝。
    const oversizedImage = testInfo.outputPath('large.png')
    writeFileSync(oversizedImage, Buffer.alloc(5 * 1024 * 1024 + 1))
    await page.getByLabel('上传作品1成品图', { exact: true }).setInputFiles(oversizedImage)
    await expect(page.getByRole('alert')).toContainText('5 MiB')
    await fillMaterials(page, categoryName)
    await expect(page.getByRole('img', { name: '作品1成品图 1', exact: true })).toBeVisible()
    // 使用有效图片触发上传请求并模拟网络中断，核对服务端已上传的图片和表单内容均保留。
    const imageUpload = '**/api/creator-application-images'
    await page.route(imageUpload, route => route.abort('failed'), { times: 1 })
    await page.getByLabel('上传作品1成品图', { exact: true }).setInputFiles({ name: 'retry.png', mimeType: 'image/png', buffer: portfolioImage })
    await expect(page.getByRole('alert')).toContainText('请检查网络后重试')
    await expect(page.getByLabel('申请人姓名', { exact: true })).toHaveValue('原创测试')
    await expect(page.getByLabel(categoryName, { exact: true })).toBeChecked()
    await expect(page.getByRole('img', { name: '作品1成品图 1', exact: true })).toBeVisible()
    await expect(page.getByRole('img', { name: '作品1过程图 1', exact: true })).toBeVisible()
    const firstId = await submitMaterials(page)
    await expect(page.getByLabel('申请人姓名', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '撤回申请', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确认撤回', exact: true }).click()
    await expect(page.locator('.application-history')).toContainText('已撤回')
    await page.getByRole('button', { name: '补正并重新申请', exact: true }).click()
    await expect(page.getByLabel('申请人姓名', { exact: true })).toHaveValue('原创测试')
    const secondId = await submitMaterials(page)
    expect(secondId).not.toBe(firstId)

    await admin.goto(`/admin/creator-applications/${secondId}`)
    await expect(admin.locator('.application-materials')).toContainText(`与上次申请 #${firstId} 比较`)
    await admin.getByRole('button', { name: '驳回并说明原因', exact: true }).click()
    await expect(admin.getByLabel('审核意见', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await admin.getByLabel('审核意见', { exact: true }).fill('请补充原创制作方法的文字说明。')
    await admin.getByRole('button', { name: '驳回并说明原因', exact: true }).click()
    await admin.getByRole('dialog').getByRole('button', { name: '确认审核', exact: true }).click()
    await expect(admin.locator('.material-summary .status-pill')).toHaveText('已驳回')
    // 保持申请人页面打开，必须由实际 WebSocket 推送触发状态更新。
    await expect(page.locator('.certification-overview .status-pill')).toHaveText('已驳回')
    await expect(page.locator('.notification-link .unread-badge')).toHaveText('1')
    await page.getByRole('button', { name: '补正并重新申请', exact: true }).click()
    await page.getByLabel('补充证明说明（选填）').fill('补充说明：作品由本人手工塑形与修整，过程图记录从陶土到成品的完整工序。')

    // 真实提交成功后丢弃响应，页面须查询服务端结论，避免误报失败或重复建单。
    let thirdId = ''
    await page.route('**/api/me/creator-applications', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      const response = await route.fetch()
      expect(response.status()).toBe(201)
      thirdId = (await response.json()).data.id
      await route.abort('failed')
    })
    await page.getByRole('button', { name: '提交入驻申请', exact: true }).click()
    await expect(page.locator('.certification-overview .status-pill')).toHaveText('待审核')
    expect(thirdId).not.toBe(secondId)
    await page.unroute('**/api/me/creator-applications')
    await admin.goto(`/admin/creator-applications/${thirdId}`)
    await expect(admin.locator('.material-fields .changed')).toContainText('补充说明')
    await expect(admin.locator('.comparison-note').first()).toContainText('请补充原创制作方法')
    expect(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await admin.screenshot({ path: testInfo.outputPath('admin-review-comparison-1366.png'), fullPage: true })
    await admin.getByRole('button', { name: '通过入驻审核', exact: false }).click()
    await admin.getByRole('dialog').getByRole('button', { name: '确认审核', exact: true }).click()
    await expect(admin.locator('.material-summary .status-pill')).toHaveText('已认证')
    await expect(page.locator('.certification-overview .status-pill')).toHaveText('已认证')
    await expect(page.getByRole('button', { name: '补正并重新申请', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '撤回申请', exact: true })).toHaveCount(0)
    await expect(page.locator('.application-history .history-row')).toHaveCount(3)
    await expect(page.getByRole('button', { name: '切换为创作者', exact: true })).toBeVisible()
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])

    await page.goto('/messages/notifications')
    await expect(page.getByRole('article')).toHaveCount(2)
    await expect(page.getByRole('button', { name: '标为已读', exact: true })).toHaveCount(2)
    const approvalNotice = page.getByRole('article').filter({ has: page.getByRole('heading', { name: '创作者认证已通过' }) })
    const rejectionNotice = page.getByRole('article').filter({ has: page.getByRole('heading', { name: '创作者申请需补正' }) })
    // 先后选择两条通知，只允许最新操作跳转，离开通知页后即使最新操作也不应跳转。
    const releases: Array<() => void> = []
    const responseGates = [0, 1].map(() => new Promise<void>(resolve => { releases.push(resolve) }))
    let responseIndex = 0
    const readPath = '**/api/me/notifications/*/read'
    await page.route(readPath, async route => {
      if (route.request().method() === 'PUT') await responseGates[responseIndex++]
      await route.continue()
    })
    const nextRead = () => page.waitForRequest(request => request.method() === 'PUT' && /\/notifications\/\d+\/read$/.test(request.url()))
    async function releaseWithoutRedirect(index: number, requestUrl: string) {
      const response = page.waitForResponse(response => response.request().method() === 'PUT' && response.url() === requestUrl)
      releases[index]!()
      expect((await response).ok()).toBe(true)
      const redirected = await page.waitForURL(url => url.pathname === '/account/creator-certification', { timeout: 1_500 }).then(() => true, (error: unknown) => {
        if (!(error instanceof errors.TimeoutError)) throw error
        return false
      })
      expect(redirected).toBe(false)
    }
    try {
      const firstRead = nextRead()
      await approvalNotice.getByRole('button', { name: /查看申请/ }).click()
      const firstRequest = await firstRead
      const latestRead = nextRead()
      await rejectionNotice.getByRole('button', { name: /查看申请/ }).click()
      const latestRequest = await latestRead
      await releaseWithoutRedirect(0, firstRequest.url())
      await expect(page).toHaveURL('/messages/notifications')
      await page.getByRole('link', { name: '交易会话', exact: true }).click()
      await expect(page).toHaveURL('/messages/conversations')
      await releaseWithoutRedirect(1, latestRequest.url())
    } finally {
      releases.forEach(release => release())
      await page.unroute(readPath)
    }
    await page.goto('/messages/notifications')
    await expect(page.getByRole('button', { name: '标为已读', exact: true })).toHaveCount(0)
    await expect(page.locator('.notification-link .unread-badge')).toHaveCount(0)
    await rejectionNotice.getByRole('button', { name: /查看申请/ }).click()
    await expect(page).toHaveURL(`/account/creator-certification?applicationId=${secondId}`)
    await expect(page.locator('.current-application .review-note')).toContainText('请补充原创制作方法的文字说明。')
    await page.getByRole('button', { name: '切换为创作者', exact: true }).click()
    await expect(page).toHaveURL('/creator/works')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('我的作品')
    const switched = (await (await page.request.get(`${api}/sessions/current`)).json()).data
    const otherSession = (await (await second.request.get(`${api}/sessions/current`)).json()).data
    expect(switched.activeRole).toBe('CREATOR')
    expect(switched.expiresAt).toBe(originalSession.expiresAt)
    expect(otherSession.activeRole).toBe('BUYER')
    expect(otherSession.roles).toContain('CREATOR')
  } finally {
    await adminContext.close()
    await secondContext.close()
  }
})

test('管理员维护两级品类、保留层级并使停用父品类退出新申请选项', async ({ page, mailbox }) => {
  const email = await createApplicant(page, mailbox.codes)
  await mailbox.promoteAdmin(email)
  await page.goto('/admin/categories')
  const suffix = randomBytes(3).toString('hex')
  const rootName = `编织${suffix}`
  const childName = `织物${suffix}`
  const dialog = page.getByRole('dialog')
  await page.getByRole('button', { name: '新增一级品类', exact: false }).click()
  await dialog.getByLabel('品类名称', { exact: true }).fill(rootName)
  await dialog.getByRole('button', { name: '保存品类', exact: true }).click()
  const root = page.getByRole('article').filter({ hasText: rootName })
  await root.getByRole('button', { name: '新增二级品类', exact: false }).click()
  await dialog.getByLabel('品类名称', { exact: true }).fill(childName)
  await dialog.getByRole('button', { name: '保存品类', exact: true }).click()
  await expect(root).toContainText(childName)
  await root.getByRole('button', { name: `编辑${childName}`, exact: true }).click()
  await expect(dialog.getByLabel('所属层级', { exact: true })).toBeDisabled()
  await dialog.getByLabel('品类名称', { exact: true }).fill(`${childName}新`)
  await dialog.getByLabel('展示排序', { exact: true }).fill('-2')
  await dialog.getByRole('button', { name: '保存品类', exact: true }).click()
  await expect(root).toContainText(`${childName}新`)
  await root.getByRole('button', { name: '编辑一级品类', exact: true }).click()
  await dialog.getByLabel('启用品类', { exact: true }).uncheck()
  await dialog.getByRole('button', { name: '保存品类', exact: true }).click()
  await expect(root).toContainText('父品类已停用')
  const visible = (await (await page.request.get(`${api}/categories`)).json()).data as { name: string }[]
  expect(visible.some(c => c.name === rootName)).toBe(false)
  await page.goto('/account/creator-certification')
  await expect(page.getByRole('button', { name: '开始申请', exact: true })).toHaveCount(0)
  await createApplicant(page, mailbox.codes)
  await page.goto('/account/creator-certification')
  await page.getByRole('button', { name: '开始申请', exact: true }).click()
  await expect(page.getByLabel(rootName, { exact: true })).toHaveCount(0)
})

test('通知空状态与入驻页面在 PC 上无横向溢出', async ({ page, mailbox }, testInfo) => {
  await createApplicant(page, mailbox.codes)
  await page.setViewportSize({ width: 1366, height: 1000 })
  for (const path of ['/account/creator-certification', '/messages/notifications']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/正在读取入驻资料…|正在读取通知…/)).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`${path.split('/').pop()}-1366.png`), fullPage: true })
  }
})
