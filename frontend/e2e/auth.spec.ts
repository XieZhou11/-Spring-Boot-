import type { Page } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { test, expect, frontendOrigin } from './fixtures'

const password = 'CraftTest123'
const newEmail = (domain = 'qq.com') => `craft-${randomBytes(6).toString('hex')}@${domain}`

async function fillRegistration(page: Page, email: string) {
  await page.getByLabel('昵称').fill('手作测试')
  await page.getByLabel('邮箱地址').fill(email)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByLabel('确认密码', { exact: true }).fill(password)
}

async function requestCode(page: Page, email: string, codes: Map<string, string>) {
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/email-verification-codes') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /发送验证码|重新发送/ }).click()
  expect((await response).status()).toBe(201)
  await expect.poll(() => codes.get(email)).toMatch(/^\d{6}$/)
  return codes.get(email)!
}

async function registerAccount(page: Page, email: string, codes: Map<string, string>) {
  await page.goto('/register')
  await fillRegistration(page, email)
  await page.getByLabel('邮箱验证码').fill(await requestCode(page, email, codes))
  const response = page.waitForResponse(
    (response) => response.url().endsWith('/accounts') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '注册账号' }).click()
  expect((await response).status()).toBe(201)
  await expect(page).toHaveURL(/\/login\?notice=registered$/)
}

async function signIn(page: Page, email: string, value = password) {
  await page.getByLabel('邮箱地址').fill(email)
  await page.getByLabel('密码', { exact: true }).fill(value)
  await page.getByRole('button', { name: '登录', exact: true }).click()
}

// 此用例会捕获认证路由缺失、表单入口不可达和原型主题丢失。
test('登录和注册页面可直接访问，提供邮箱表单与互跳入口', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '欢迎回到拾作' })).toBeVisible()
  await expect(page.getByLabel('邮箱地址')).toBeVisible()
  await expect(page.getByLabel('密码', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '立即注册' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByRole('heading', { name: '在拾作，遇见手作之美' })).toBeVisible()
  await expect(page.getByLabel('昵称')).toBeVisible()
  await expect(page.getByLabel('邮箱验证码')).toBeVisible()
  await expect(page.getByRole('button', { name: '发送验证码' })).toBeVisible()
})

test('空值、邮箱域、昵称和确认密码错误就近提示，密码可切换可见性', async ({ page }) => {
  await page.goto('/register')
  await page.getByRole('button', { name: '注册账号' }).click()
  await expect(page.getByText('昵称需为 2—8 字')).toBeVisible()
  await expect(page.getByLabel('昵称')).toBeFocused()
  await fillRegistration(page, 'test@gmail.com')
  await page.getByLabel('邮箱验证码').fill('123456')
  await page.getByLabel('确认密码', { exact: true }).fill('Another123')
  await page.getByRole('button', { name: '注册账号' }).click()
  await expect(page.getByText('请输入 QQ 邮箱或 163 邮箱', { exact: true })).toBeVisible()
  await expect(page.getByText('两次输入的密码不一致')).toBeVisible()
  await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: '显示密码', exact: true }).click()
  await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute('type', 'text')
})

for (const domain of ['qq.com', '163.com']) {
  test(`${domain} 实际发码注册、登录、刷新恢复和退出闭环`, async ({ page, mailbox }) => {
    const email = newEmail(domain)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await registerAccount(page, email, mailbox.codes)
    await expect(page.getByRole('status')).toContainText('注册成功')
    // 注册不自动登录，密码错误须保留页面，不能把 401 当作成功。
    await signIn(page, email, 'Incorrect123')
    await expect(page.getByRole('alert')).toHaveText('邮箱或密码错误')
    await expect(page).toHaveURL(/\/login/)
    await signIn(page, email)
    await expect(page.getByRole('heading', { name: '发现手作之美' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('link', { name: '手作测试 · 个人中心' })).toBeVisible()
    expect((await (await page.request.get('http://localhost:18080/api/sessions/current')).json()).data.email).toBe(email)
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
    const session = (await page.context().cookies()).find((cookie) => cookie.name === 'JSESSIONID')
    expect(session?.httpOnly).toBe(true)
    await page.getByRole('button', { name: '退出登录' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/')
    await expect(page).toHaveURL(/\/login\?redirect=/)
    expect(errors).toEqual([])
  })
}

test('错误及重发旧验证码被后端拒绝，表单内容保留；重复注册提示已有账号', async ({
  page,
  mailbox,
}) => {
  const email = newEmail()
  await page.goto('/register')
  await fillRegistration(page, email)
  const oldCode = await requestCode(page, email, mailbox.codes)
  const latestCode = await requestCode(page, email, mailbox.codes)
  expect(latestCode).not.toBe(oldCode)
  await page.getByLabel('邮箱验证码').fill(oldCode)
  await page.getByRole('button', { name: '注册账号' }).click()
  await expect(page.getByRole('alert')).toContainText('验证码不正确、已使用或已过期')
  await expect(page.getByLabel('邮箱地址')).toHaveValue(email)
  await expect(page.getByLabel('昵称')).toHaveValue('手作测试')
  await page.getByLabel('邮箱验证码').fill(latestCode)
  await page.getByRole('button', { name: '注册账号' }).click()
  await expect(page).toHaveURL(/\/login\?notice=registered$/)
  await page.goto('/register')
  await fillRegistration(page, email)
  await page.getByLabel('邮箱验证码').fill(await requestCode(page, email, mailbox.codes))
  await page.getByRole('button', { name: '注册账号' }).click()
  await expect(page.getByRole('alert')).toContainText('该邮箱已注册')
})

test('登录返回原站内地址，外部地址不能作为跳转目标', async ({ page, mailbox }) => {
  const email = newEmail()
  await registerAccount(page, email, mailbox.codes)
  await page.goto('/?from=collection#saved')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await signIn(page, email)
  await expect(page).toHaveURL(`${frontendOrigin}/?from=collection#saved`)
  await page.getByRole('button', { name: '退出登录' }).click()
  await page.goto('/login?redirect=https%3A%2F%2Fexample.com')
  await signIn(page, email)
  await expect(page).toHaveURL(`${frontendOrigin}/`)
})

test('邮箱找回重置后旧密码失效、新密码可用，另一设备旧会话退出', async ({
  page,
  browser,
  mailbox,
}) => {
  const email = newEmail('163.com')
  const newPassword = 'ChangedCraft123'
  await registerAccount(page, email, mailbox.codes)
  await signIn(page, email)
  await expect(page.getByRole('heading', { name: '发现手作之美' })).toBeVisible()
  const otherContext = await browser.newContext()
  try {
    const other = await otherContext.newPage()
    await other.goto(`${frontendOrigin}/login`)
    await signIn(other, email)
    await expect(other.getByRole('heading', { name: '发现手作之美' })).toBeVisible()
    await page.getByRole('link', { name: '手作测试 · 个人中心', exact: true }).click()
    await page.getByRole('link', { name: /重新设置密码/ }).click()
    await page.getByLabel('邮箱地址').fill(email)
    await page.getByLabel('邮箱验证码').fill(await requestCode(page, email, mailbox.codes))
    await page.getByLabel('新密码', { exact: true }).fill(newPassword)
    await page.getByLabel('确认新密码', { exact: true }).fill(newPassword)
    await page.getByRole('button', { name: '重置密码', exact: true }).click()
    await expect(page).toHaveURL(/\/login\?notice=reset$/)
    await expect(page.getByRole('status')).toContainText('密码已重置')
    await other.reload()
    await expect(other).toHaveURL(/\/login/)
    await signIn(page, email)
    await expect(page.getByRole('alert')).toHaveText('邮箱或密码错误')
    await signIn(page, email, newPassword)
    await expect(page.getByRole('heading', { name: '发现手作之美' })).toBeVisible()
  } finally {
    await otherContext.close()
  }
})

test('SMTP 发送结果未知显示后端提示，不宣称验证码已发送', async ({ page, mailbox }) => {
  await page.goto('/register')
  await page.getByLabel('邮箱地址').fill(newEmail())
  mailbox.rejectNext = true
  await page.getByRole('button', { name: '发送验证码' }).click()
  await expect(page.getByRole('alert')).toContainText('验证码发送或保存结果无法确认')
  await expect(page.getByText(/验证码已发送/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: '发送验证码' })).toBeEnabled()
})

test('重发失败清除旧成功提示，不能继续把旧码展示为有效', async ({ page, mailbox }) => {
  const email = newEmail()
  await page.goto('/register')
  await page.getByLabel('邮箱地址').fill(email)
  await requestCode(page, email, mailbox.codes)
  await expect(page.getByRole('status')).toContainText('验证码已发送')
  mailbox.rejectNext = true
  await page.getByRole('button', { name: '重新发送' }).click()
  await expect(page.getByRole('alert')).toContainText('验证码发送或保存结果无法确认')
  await expect(page.getByText(/验证码已发送/)).toHaveCount(0)
})

test('服务端字段错误回显到表单；网络中断可重试', async ({ page }) => {
  await page.goto('/login')
  // UI 校验无法覆盖服务端所有地址语法，真实 Jakarta 校验须回显字段说明。
  await signIn(page, 'double..dot@qq.com')
  await expect(page.getByLabel('邮箱地址')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.field-error')).toHaveText('请输入正确的邮箱地址')
  await page.route('**/api/csrf', (route) => route.abort('failed'))
  await signIn(page, 'network-test@qq.com')
  await expect(page.getByRole('alert')).toContainText('暂时无法连接服务')
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeEnabled()
})

test('登录后会话查询断网时停留登录提示，不在首页与登录页循环', async ({ page, mailbox }) => {
  const email = newEmail()
  await registerAccount(page, email, mailbox.codes)
  await page.route('**/api/sessions/current', (route) => route.abort('failed'))
  await signIn(page, email)
  await expect(page.getByRole('status')).toContainText('暂时无法连接服务')
  await expect(page).toHaveURL(/\/login\?redirect=.*reason=connection/)
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeEnabled()
})

test('退出后延迟到达的旧会话响应不能恢复登录缓存', async ({ page, mailbox }) => {
  const email = newEmail()
  await registerAccount(page, email, mailbox.codes)
  await signIn(page, email)
  await expect(page.getByRole('heading', { name: '发现手作之美' })).toBeVisible()
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let captured = false
  await page.route('**/api/sessions/current', async (route) => {
    const response = await route.fetch()
    if (response.status() === 200 && !captured) {
      captured = true
      await gate
    }
    await route.fulfill({ response })
  })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => captured).toBe(true)
  await page.getByRole('button', { name: '退出登录' }).click()
  // 等待退出确已清空本人信息，再释放此前的 200 响应，稳定覆盖响应乱序。
  await expect(page.getByRole('heading', { name: '发现手作之美' })).toHaveCount(0)
  release!()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('link', { name: '立即注册' }).click()
  await expect(page).toHaveURL(/\/register$/)
})

test('窄屏与桌面布局无横向溢出，表单可用并保存预览', async ({ page }, testInfo) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const route of ['login', 'register', 'forgot-password']) {
      await page.goto(`/${route}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await page.screenshot({ path: testInfo.outputPath(`${route}-${width}.png`), fullPage: true })
    }
  }
})
