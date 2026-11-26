import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { api, mutate, origin, prepareCreator, register } from './custom-request-support'

test.use({ storageMode: 'receiver' })

/** 用真实需求关系准备一条聊天未读；账号注册仅是测试数据准备。 */
async function createUnreadConversation(buyer: Page, creator: Page, categoryId: string) {
  const fields = {
    title: '角色更新未读回归', categoryId, purpose: '赠礼', materialPreference: '天然木材', specification: '长十二厘米',
    budgetMin: '100.00', budgetMax: '300.00', expectedShipDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    referenceImageIds: [], description: '希望采用传统手工工艺制作日常小物，表面细腻牢固，保留自然纹理，便于长期使用。', visibility: 'PUBLIC',
  }
  const created = await mutate(buyer, '/me/custom-requests', { ...fields, requestKey: randomUUID() })
  expect(created.status()).toBe(201)
  const draft = (await created.json()).data
  expect((await mutate(buyer, `/me/custom-requests/${draft.id}/publication`, { ...fields, version: draft.version }, 'put')).status()).toBe(200)
  const opened = await mutate(creator, `/custom-requests/${draft.id}/conversations`)
  expect(opened.status()).toBe(201)
  const id = (await opened.json()).data.id as string
  expect((await mutate(creator, `/conversations/${id}/messages`, { clientMessageKey: randomUUID(), content: '身份变更后不应保留这条聊天的未读数', imageIds: [] })).status()).toBe(201)
}

/** 读取浏览器正在使用的真实 store，检查后台没有入口展示的过期聊天状态。 */
async function chatUnread(page: Page) {
  return page.evaluate(async module => (await import(module)).useNotificationsStore().chatUnreadCount as number, '/src/stores/notifications.ts')
}

test('管理员保留系统通知及实时已读更新，后台导航不查询聊天未读', async ({ page, browser, mailbox }) => {
  const reviewer = await browser.newContext({ baseURL: origin })
  try {
    // 先经真实审核产生个人通知，再给同一隔离账号增加管理员标记。
    await prepareCreator(page, await reviewer.newPage(), mailbox.codes, mailbox.promoteAdmin)
    const account = (await (await page.request.get(`${api}/sessions/current`)).json()).data
    await mailbox.promoteAdmin(account.email)
    const chatRequests: string[] = []
    const unreadResponses: number[] = []
    const events: { type: string; count?: number }[] = []
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/me/conversations/unread-count') chatRequests.push(request.url()) })
    page.on('response', response => { if (new URL(response.url()).pathname === '/api/me/notifications/unread-count') unreadResponses.push(response.status()) })
    await page.routeWebSocket('**/api/ws', ws => {
      const server = ws.connectToServer()
      server.onMessage(message => {
        events.push(JSON.parse(String(message)) as { type: string; count?: number })
        ws.send(message)
      })
    })
    await page.goto('/admin/works')
    await expect(page.getByRole('heading', { name: '作品审核', exact: true })).toBeVisible()
    await expect.poll(() => events.some(event => event.type === 'PONG')).toBe(true)
    const topNotifications = page.locator('.admin-topbar').getByRole('link', { name: '系统通知', exact: true })
    const sidebarNotifications = page.locator('.admin-sidebar-bottom').getByRole('link', { name: '系统通知', exact: true })
    await expect(topNotifications).toHaveAttribute('href', '/messages/notifications')
    await sidebarNotifications.click()
    await expect(page).toHaveURL('/messages/notifications')
    await expect(sidebarNotifications).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.connection-indicator')).toHaveText('实时连接中')
    await expect(page.locator('.notification-card')).toContainText('创作者认证已通过')
    await expect(page.locator('.notification-link .unread-badge')).toHaveText('1')
    await page.getByRole('button', { name: '标为已读', exact: true }).click()
    await expect(page.locator('.notification-card .read-label')).toHaveText('已读')
    await expect.poll(() => events.some(event => event.type === 'UNREAD_UPDATED' && event.count === 0)).toBe(true)
    await expect(page.locator('.notification-link .unread-badge')).toHaveCount(0)
    await page.getByRole('link', { name: '品类管理', exact: true }).click()
    await expect(page.getByRole('heading', { name: '手作品类管理', exact: true })).toBeVisible()
    await topNotifications.click()
    await expect(page).toHaveURL('/messages/notifications')
    await page.waitForLoadState('networkidle')
    expect(unreadResponses.length).toBeGreaterThan(0)
    expect(unreadResponses.every(status => status === 200)).toBe(true)
    expect(chatRequests).toEqual([])
  } finally { await reviewer.close() }
})

test('买家仍查询聊天未读，同用户恢复管理员资格时清除旧数并忽略迟到响应', async ({ page, browser, mailbox }) => {
  const reviewer = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  let releaseResponse: (() => void) | undefined
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await reviewer.newPage(), mailbox.codes, mailbox.promoteAdmin)
    const email = await register(page, mailbox.codes, '角色更新买家')
    await createUnreadConversation(page, creator, categoryId)
    const chatResponses: number[] = []
    page.on('response', response => { if (new URL(response.url()).pathname === '/api/me/conversations/unread-count') chatResponses.push(response.status()) })
    await page.goto('/')
    await expect(page.getByRole('link', { name: '消息中心', exact: true }).locator('.unread-badge')).toHaveText('1')
    await page.waitForLoadState('networkidle')
    expect(chatResponses.length).toBeGreaterThan(0)
    expect(chatResponses.every(status => status === 200)).toBe(true)

    // 仅延迟真实的旧角色HTTP响应，不替换服务器计算的未读结果。
    let held = false
    let released = false
    const responseGate = new Promise<void>(resolve => { releaseResponse = resolve })
    await page.route('**/api/me/conversations/unread-count', async route => {
      const response = await route.fetch()
      held = true
      await responseGate
      await route.fulfill({ response })
      released = true
    })
    await page.evaluate(async module => { void (await import(module)).useNotificationsStore().refreshChatUnread() }, '/src/stores/notifications.ts')
    await expect.poll(() => held).toBe(true)
    await mailbox.promoteAdmin(email)
    // SPA导航会真实核验会话；userId不变，仅roles改变，不能靠整页刷新清空store。
    await page.getByRole('link', { name: /个人中心/ }).click()
    await expect(page.locator('.identity-label')).toHaveText('管理员身份')
    await expect.poll(() => chatUnread(page)).toBe(0)
    releaseResponse!()
    await expect.poll(() => released).toBe(true)
    await page.waitForLoadState('networkidle')
    expect(await chatUnread(page)).toBe(0)
    const requestsAfterPromotion: string[] = []
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/me/conversations/unread-count') requestsAfterPromotion.push(request.url()) })
    await page.evaluate(async module => { await (await import(module)).useNotificationsStore().refreshChatUnread() }, '/src/stores/notifications.ts')
    expect(requestsAfterPromotion).toEqual([])
  } finally {
    releaseResponse?.()
    await reviewer.close()
    await creatorContext.close()
  }
})
