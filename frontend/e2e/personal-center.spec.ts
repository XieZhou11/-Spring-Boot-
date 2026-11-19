import type { Page } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test, expect, frontendOrigin } from './fixtures'

import { api } from './environment'
// 自有纯色 PNG 夹具，真实图片解码后再验证服务不可用，不使用损坏图片碰巧失败。
const avatarPng = readFileSync(new URL('./avatar.png', import.meta.url))

/** 通过真实邮箱协议与账号 API 准备本人会话，不绕过安全链或写入业务表。 */
async function createMember(page: Page, codes: Map<string, string>) {
  const email = `profile-${randomBytes(6).toString('hex')}@qq.com`
  async function post(path: string, input: object) {
    const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
    return page.request.post(`${api}${path}`, {
      headers: { [csrf.headerName]: csrf.token }, data: input,
    })
  }
  expect((await post('/email-verification-codes', { email })).status()).toBe(201)
  await expect.poll(() => codes.get(email)).toMatch(/^\d{6}$/)
  expect((await post('/accounts', {
    email, nickname: '手作测试', password: 'CraftTest123', verificationCode: codes.get(email),
  })).status()).toBe(201)
  expect((await post('/sessions', { email, password: 'CraftTest123' })).status()).toBe(201)
  return email
}

async function fillAddress(page: Page, recipient = '收件测试') {
  await page.getByLabel('收件人', { exact: true }).fill(recipient)
  await page.getByLabel('手机号', { exact: true }).fill('13800138000')
  await page.getByLabel('手动填写省市区').check()
  await page.getByLabel('省 / 自治区 / 直辖市').fill('北京市')
  await page.getByLabel('市', { exact: true }).fill('北京市')
  await page.getByLabel('区 / 县').fill('东城区')
  await page.getByLabel('详细地址', { exact: true }).fill('测试街道 1 号手作楼')
}

// 缺少受保护路由会丢失目标地址，登录后无法回到个人资料。
test('未登录不能读取个人中心，登录入口保留资料目标地址', async ({ page }) => {
  await page.goto('/account/profile')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/account/profile')
  expect((await page.request.get(`${api}/me/profile`)).status()).toBe(401)
  expect((await page.request.get(`${api}/me/addresses`)).status()).toBe(401)
})

// 捕获资料未持久化、Unicode 长度误判、上传失败覆盖头像/阻断保存等缺陷。
test('资料 Unicode 校验、保存刷新、独立头像失败后仍可保存资料', async ({ page, mailbox }) => {
  const email = await createMember(page, mailbox.codes)
  await page.goto('/')
  await page.getByRole('link', { name: /个人中心/ }).click()
  await expect(page.getByLabel('邮箱地址')).toHaveValue(email)
  await expect(page.getByLabel('邮箱地址')).toHaveAttribute('readonly', '')
  await page.getByLabel('昵称', { exact: true }).fill('𠮷作')
  await page.getByLabel('个人简介').fill('记录一针一线的日常。')
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('资料已保存')
  await page.reload()
  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('𠮷作')
  await expect(page.getByLabel('个人简介')).toHaveValue('记录一针一线的日常。')
  await page.getByLabel('昵称', { exact: true }).fill('作')
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  await expect(page.getByText('昵称需为 2—8 字')).toBeVisible()
  await page.getByLabel('昵称', { exact: true }).fill('新的手作')
  await page.getByLabel('个人简介').fill('作'.repeat(201))
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  await expect(page.getByText('个人简介最多 200 字')).toBeVisible()
  await page.getByLabel('个人简介').fill('未保存的简介')
  await page.getByLabel('选择头像文件').setInputFiles({ name: 'avatar.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('alert')).toContainText('JPEG 或 PNG')
  await page.getByLabel('选择头像文件').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })
  await expect(page.getByRole('alert')).toContainText('2 MiB')
  let releasePreview: (() => void) | undefined
  const previewGate = new Promise<void>((resolve) => { releasePreview = resolve })
  await page.route('**/api/me/avatar', async (route) => {
    await previewGate
    await route.continue()
  })
  const response = page.waitForResponse((r) => r.url().endsWith('/me/avatar'))
  await page.getByLabel('选择头像文件').setInputFiles({
    name: 'avatar.png', mimeType: 'image/png',
    buffer: avatarPng,
  })
  await expect(page.getByRole('img', { name: '所选头像预览' })).toBeVisible()
  await expect(page.getByLabel('默认文字头像')).toBeVisible()
  releasePreview!()
  expect((await response).status()).toBe(503)
  await expect(page.getByRole('img', { name: '所选头像预览' })).toHaveCount(0)
  await page.unroute('**/api/me/avatar')
  await expect(page.getByRole('alert')).toContainText('头像')
  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('新的手作')
  await page.route('**/api/me/avatar', async (route) => {
    // 请求确实到达真实服务端，仅丢弃响应，不伪造业务结果。
    await route.fetch()
    await route.abort('failed')
  })
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/me/profile') && r.request().method() === 'GET')
  await page.getByLabel('选择头像文件').setInputFiles({
    name: 'avatar.png', mimeType: 'image/png',
    buffer: avatarPng,
  })
  expect((await refreshed).status()).toBe(200)
  await expect(page.getByRole('alert')).toContainText('暂时无法确认上传结果')
  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('新的手作')
  await expect(page.getByLabel('个人简介')).toHaveValue('未保存的简介')
  await page.unroute('**/api/me/avatar')
  await page.getByLabel('个人简介').fill('')
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('资料已保存')
  await page.reload()
  await expect(page.getByLabel('个人简介')).toHaveValue('')
})

// 捕获第一条默认、编辑误取消默认、切换和删除替换未反映到列表等缺陷。
test('地址新增编辑、默认切换、确认删除及刷新保持一致', async ({ page, mailbox }) => {
  await createMember(page, mailbox.codes)
  await page.goto('/account/addresses')
  await page.getByRole('button', { name: '新增地址', exact: true }).click()
  await fillAddress(page, '第一位收件人')
  await page.getByRole('button', { name: '保存地址', exact: true }).click()
  const first = page.getByRole('article').filter({ hasText: '第一位收件人' })
  await expect(first).toContainText('默认地址')
  await page.getByRole('button', { name: '新增地址', exact: true }).click()
  await fillAddress(page, '第二位收件人')
  await page.getByRole('button', { name: '保存地址', exact: true }).click()
  const second = page.getByRole('article').filter({ hasText: '第二位收件人' })
  await second.getByRole('button', { name: '设为默认' }).click()
  await expect(second).toContainText('默认地址')
  await second.getByRole('button', { name: '编辑' }).click()
  await expect(page.getByLabel('设为默认地址')).toBeDisabled()
  await page.getByLabel('详细地址', { exact: true }).fill('新的测试街道 2 号')
  await page.getByRole('button', { name: '保存地址', exact: true }).click()
  await expect(second).toContainText('新的测试街道 2 号')
  await second.getByRole('button', { name: '删除' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '取消' }).click()
  await expect(second).toBeVisible()
  await second.getByRole('button', { name: '删除' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认删除' }).click()
  await expect(second).toHaveCount(0)
  await expect(first).toContainText('默认地址')
  await page.reload()
  await expect(first).toContainText('默认地址')
})

// 捕获地区联动无法使用、错误清空表单、断网保存虚假成功等缺陷。
test('省市区联动可选，字段错误与网络失败保留地址输入', async ({ page, mailbox }) => {
  await createMember(page, mailbox.codes)
  await page.goto('/account/addresses')
  await page.getByRole('button', { name: '新增地址', exact: true }).click()
  await page.getByRole('button', { name: '保存地址', exact: true }).click()
  await expect(page.getByLabel('收件人', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('combobox', { name: '所在地区' }).click()
  await page.getByRole('menuitem', { name: /北京市/ }).click()
  await page.getByRole('menuitem', { name: /市辖区/ }).click()
  await page.getByRole('menuitem', { name: /东城区/ }).click()
  await page.getByLabel('收件人', { exact: true }).fill('网络测试')
  await page.getByLabel('手机号', { exact: true }).fill('13800138000')
  await page.getByLabel('详细地址', { exact: true }).fill('测试街道 3 号')
  // 字段长度通过前端校验，但脚本标记应由真实服务端拒绝并回显字段说明。
  await page.getByLabel('收件人', { exact: true }).fill('<测试>')
  await page.getByRole('button', { name: '保存地址', exact: true }).click()
  await expect(page.getByLabel('收件人', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('收件人', { exact: true })).toHaveValue('<测试>')
  await page.getByLabel('收件人', { exact: true }).fill('网络测试')
  await page.route('**/api/me/addresses', (route) => route.abort('failed'))
  await page.getByRole('button', { name: '保存地址', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('暂时无法连接服务')
  await expect(page.getByLabel('详细地址', { exact: true })).toHaveValue('测试街道 3 号')
  await page.unroute('**/api/me/addresses')
  await page.getByRole('button', { name: '保存地址', exact: true }).click()
  await expect(page.getByRole('article')).toContainText('东城区')
})

// 真实后端批量准备十个地址，验证页面容量限制和他人地址拒绝均不泄露数据。
test('十条地址上限及他人地址统一拒绝', async ({ page, browser, mailbox }) => {
  await createMember(page, mailbox.codes)
  const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
  let addressId = ''
  for (let index = 1; index <= 10; index++) {
    const response = await page.request.post(`${api}/me/addresses`, {
      headers: { [csrf.headerName]: csrf.token },
      data: { recipientName: `收件人${index}`, phone: '13800138000', province: '北京市', city: '北京市', district: '东城区', detailAddress: `测试街道 ${index} 号`, isDefault: false },
    })
    expect(response.status()).toBe(201)
    addressId = (await response.json()).data.id
  }
  await page.goto('/account/addresses')
  await expect(page.getByRole('article')).toHaveCount(10)
  await expect(page.getByRole('button', { name: '新增地址', exact: true })).toBeDisabled()
  const otherContext = await browser.newContext()
  try {
    const other = await otherContext.newPage()
    await createMember(other, mailbox.codes)
    const otherCsrf = (await (await other.request.get(`${api}/csrf`)).json()).data
    const options = { headers: { [otherCsrf.headerName]: otherCsrf.token } }
    expect((await other.request.delete(`${api}/me/addresses/${addressId}`, options)).status()).toBe(404)
    expect((await other.request.put(`${api}/me/addresses/${addressId}/default`, options)).status()).toBe(404)
    await other.goto(`${frontendOrigin}/account/addresses`)
    await expect(other.getByRole('article')).toHaveCount(0)
  } finally {
    await otherContext.close()
  }
})

test('个人中心桌面布局无横向溢出并保存预览', async ({ page, mailbox }, testInfo) => {
  await createMember(page, mailbox.codes)
  const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
  expect((await page.request.post(`${api}/me/addresses`, {
    headers: { [csrf.headerName]: csrf.token },
    data: { recipientName: '手作收件人', phone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', detailAddress: '春日街道 18 号，手作工作室二层', isDefault: true },
  })).status()).toBe(201)
  for (const width of [1366, 1440, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const route of ['profile', 'addresses']) {
      await page.goto(`/account/${route}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      if (route === 'profile') await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('手作测试')
      if (route === 'addresses') {
        await expect(page.getByRole('article')).toContainText('手作收件人')
        await page.getByRole('button', { name: '编辑', exact: true }).click()
        await expect(page.getByRole('combobox', { name: '所在地区' })).toBeVisible()
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`${route}-${width}.png`), fullPage: true })
    }
  }
})
