import { randomUUID } from 'node:crypto'
import type { Page, WebSocketRoute } from '@playwright/test'
import { test, expect } from './fixtures'
import { mutate, origin, prepareCreator, register } from './custom-request-support'

test.use({ storageMode: 'receiver' })

/** 真实HTTP创建业务关系；只有网络故障和重复推送在浏览器传输层注入。 */
async function createConversation(buyer: Page, creator: Page, categoryId: string, title: string) {
  const fields = {
    title, categoryId, purpose: '赠礼', materialPreference: '天然木材', specification: '长十二厘米',
    budgetMin: '100.00', budgetMax: '300.00', expectedShipDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    referenceImageIds: [], description: '希望采用传统手工工艺制作日常小物，表面细腻牢固，保留自然纹理，便于长期使用。', visibility: 'PUBLIC',
  }
  const created = await mutate(buyer, '/me/custom-requests', { ...fields, requestKey: randomUUID() })
  expect(created.status()).toBe(201)
  const draft = (await created.json()).data
  expect((await mutate(buyer, `/me/custom-requests/${draft.id}/publication`, { ...fields, version: draft.version }, 'put')).status()).toBe(200)
  const opened = await mutate(creator, `/custom-requests/${draft.id}/conversations`)
  expect(opened.status()).toBe(201)
  return (await opened.json()).data.id as string
}

test('无响应连接通过心跳恢复，重连补回期间保存的消息', async ({ page, browser, mailbox }) => {
  const admin = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await admin.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '心跳买家')
    const id = await createConversation(page, creator, categoryId, '心跳恢复定制')
    let muted = false; let pings = 0; let connections = 0
    await page.routeWebSocket('**/api/ws', ws => {
      connections++
      const server = ws.connectToServer()
      ws.onMessage(message => { if (message === 'PING') pings++; server.send(message) })
      server.onMessage(message => { if (!muted) ws.send(message) })
    })
    await page.clock.install()
    await page.goto(`/messages/conversations/${id}`)
    await expect.poll(() => pings, { timeout: 3000 }).toBe(1)
    await expect(page.getByRole('log')).toBeVisible()
    await page.waitForLoadState('networkidle')
    muted = true
    expect((await mutate(creator, `/conversations/${id}/messages`, { clientMessageKey: randomUUID(), content: '连接恢复后应自动补回这条消息', imageIds: [] })).status()).toBe(201)
    await page.clock.runFor(20_000)
    await expect.poll(() => pings).toBe(2)
    await page.clock.runFor(10_001)
    await expect(page.locator('.message-offline')).toBeVisible()
    muted = false
    await page.clock.runFor(1001)
    await expect.poll(() => connections).toBe(2)
    await page.clock.runFor(200)
    await expect(page.getByRole('log')).toContainText('连接恢复后应自动补回这条消息')
    await expect(page.locator('.message-offline')).toBeHidden()
  } finally { await admin.close(); await creatorContext.close() }
})

test('连续无心跳回应只自动重试五次，退出后不再连接', async ({ page, mailbox }) => {
  await register(page, mailbox.codes, '重试买家')
  let connections = 0; let pings = 0
  await page.routeWebSocket('**/api/ws', ws => {
    connections++
    ws.onMessage(message => { if (message === 'PING') pings++ })
  })
  await page.clock.install()
  await page.goto('/messages/conversations')
  await expect.poll(() => connections).toBe(1)
  // 路由回调早于页面onopen，收到真实PING后才推进时间，确保超时计时器已经建立。
  await expect.poll(() => pings).toBe(1)
  for (const [index, delay] of [1000, 2000, 4000, 8000, 16000].entries()) {
    await page.clock.runFor(10_001 + delay)
    await expect.poll(() => connections, { timeout: 3000 }).toBe(index + 2)
    await expect.poll(() => pings).toBe(index + 2)
  }
  await page.clock.runFor(90_000)
  expect(connections).toBe(6)
  await expect(page.locator('.message-offline')).toBeVisible()
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.clock.runFor(90_000)
  expect(connections).toBe(6)
})

test('每次连接仅首次心跳成功也不能无限恢复重试额度', async ({ page, mailbox }) => {
  await register(page, mailbox.codes, '短暂连接买家')
  let connections = 0; let initialPings = 0
  await page.routeWebSocket('**/api/ws', ws => {
    connections++
    let first = true
    ws.onMessage(message => {
      if (message === 'PING' && first) { first = false; initialPings++; ws.send(JSON.stringify({ type: 'PONG' })) }
    })
  })
  await page.clock.install()
  await page.goto('/messages/conversations')
  await expect.poll(() => initialPings).toBe(1)
  for (const [index, delay] of [1000, 2000, 4000, 8000, 16000].entries()) {
    await page.clock.runFor(30_001 + delay)
    await expect.poll(() => initialPings).toBe(index + 2)
  }
  await page.clock.runFor(90_000)
  expect(connections).toBe(6)
  await expect(page.locator('.message-offline')).toBeVisible()
})

test('无关会话不重查当前消息，同会话连续事件只刷新一次', async ({ page, browser, mailbox }) => {
  const admin = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await admin.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '事件买家')
    const first = await createConversation(page, creator, categoryId, '正在查看的定制')
    const second = await createConversation(page, creator, categoryId, '另一项定制')
    let transport: WebSocketRoute | undefined
    await page.routeWebSocket('**/api/ws', ws => { transport = ws; ws.connectToServer() })
    await page.goto(`/messages/conversations/${first}`)
    await expect(page.getByRole('log')).toBeVisible()
    await page.waitForLoadState('networkidle')
    const counts = { detail: 0, messages: 0, list: 0 }
    page.on('request', request => {
      if (request.method() !== 'GET') return
      const path = new URL(request.url()).pathname
      if (path === `/api/conversations/${first}`) counts.detail++
      if (path === `/api/conversations/${first}/messages`) counts.messages++
      if (path === '/api/me/conversations') counts.list++
    })
    transport!.send(JSON.stringify({ type: 'CONVERSATION_UPDATED', conversationId: second }))
    await expect.poll(() => counts.list).toBe(1)
    await page.waitForLoadState('networkidle')
    expect(counts.detail).toBe(0); expect(counts.messages).toBe(0)
    counts.list = 0
    for (let i = 0; i < 8; i++) transport!.send(JSON.stringify({ type: 'CONVERSATION_UPDATED', conversationId: first }))
    await expect.poll(() => counts.messages).toBe(1)
    await page.waitForLoadState('networkidle')
    expect(counts.detail).toBe(1); expect(counts.list).toBe(1)
    await expect(page.getByRole('link', { name: /正在查看的定制/ }).last()).toBeVisible()
  } finally { await admin.close(); await creatorContext.close() }
})

test('实时握手失败时首页仍显示持久化未读消息', async ({ page, browser, mailbox }) => {
  const admin = await browser.newContext({ baseURL: origin }); const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await admin.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '离线未读买家')
    const id = await createConversation(page, creator, categoryId, '握手失败的定制')
    expect((await mutate(creator, `/conversations/${id}/messages`, { clientMessageKey: randomUUID(), content: '即使实时连接不可用也要提示未读', imageIds: [] })).status()).toBe(201)
    // 仅把实时握手指向真实后端的不存在路径，HTTP登录和未读查询仍走正常接口。
    await page.addInitScript(() => {
      const NativeSocket = window.WebSocket
      window.WebSocket = class extends NativeSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          const endpoint = new URL(url)
          endpoint.pathname += '/unavailable-test'
          super(endpoint, protocols)
        }
      }
    })
    await page.goto('/')
    await expect(page.getByRole('link', { name: '消息中心', exact: true }).locator('.unread-badge')).toHaveText('1')
  } finally { await admin.close(); await creatorContext.close() }
})
