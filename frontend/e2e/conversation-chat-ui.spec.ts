import { expect, test, type Page } from '@playwright/test'
import type { ProfileVO } from '../src/types/account'
import type { ChatMessageVO, ConversationVO } from '../src/types/customRequest'
import { api } from './environment'

test.use({ timezoneId: 'America/Los_Angeles' })

const now = new Date('2026-11-27T16:10:00Z')
const ownAvatar = '/test-chat-avatars/own.svg'
const initialOtherAvatar = '/test-chat-avatars/other.svg?signature=initial'
const renewedOtherAvatar = '/test-chat-avatars/other.svg?signature=renewed'
const avatarImage = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#b45309"/></svg>'
const session = { userId: '11', nickname: '测试买家', email: 'buyer@example.test', roles: ['BUYER'], activeRole: 'BUYER' }
const messages: ChatMessageVO[] = [
  { id: '1', senderId: '11', createdAt: '2026-11-27T15:59:10Z', content: '这是昨天的第一条消息。' },
  { id: '2', senderId: '11', createdAt: '2026-11-27T15:59:50Z', content: '这是同一分钟内的第二条消息。' },
  { id: '3', senderId: '11', createdAt: '2026-11-27T16:00:10Z', content: '这是今天的第一条消息。' },
  { id: '4', senderId: '12', createdAt: '2026-11-27T16:00:50Z', content: '收到，今天继续沟通。' },
].map(message => ({
  ...message, conversationId: '71', seqNo: message.id, clientMessageKey: message.id,
  referencedNodeId: null, referencedNodeCode: null, imageIds: [],
}))

const conversation: ConversationVO = {
  id: '71', requestId: null, orderId: null, orderTitle: null, orderStatus: null, orderAmount: null,
  canPayOrder: false,
  orderCoverImageId: null, requestTitle: null, requestStatus: null, otherUserId: '12', otherNickname: '测试创作者',
  otherAvatarUrl: null, otherAvatarExpiresAt: null, unreadCount: 0, lastMessageAt: messages[3]!.createdAt,
  lastMessageSeq: '4', readSeq: '4', canSend: true, sendDisabledReason: null, archivedAt: null, archiveReason: null,
}

/** 保留真实会话页面和渲染，仅用浏览器拦截替代后端及头像对象。 */
async function mockChat(page: Page, currentConversation = () => conversation, role: 'BUYER' | 'CREATOR' = 'BUYER') {
  let profileReads = 0
  const profile: ProfileVO = { ...session, bio: null, avatarUrl: ownAvatar, avatarExpiresAt: null }
  await page.routeWebSocket('**/api/ws', socket => socket.onMessage(message => {
    if (message === 'PING') socket.send(JSON.stringify({ type: 'PONG' }))
  }))
  await page.route('**/test-chat-avatars/**', route => {
    if (new URL(route.request().url()).searchParams.get('signature') === 'initial') return route.fulfill({ status: 403 })
    return route.fulfill({ contentType: 'image/svg+xml', body: avatarImage })
  })
  await page.route(`${api}/**`, async route => {
    const { pathname, searchParams } = new URL(route.request().url())
    let data: unknown = null
    if (pathname === '/api/sessions/current') data = { ...session, roles: [role], activeRole: role }
    if (pathname.endsWith('/unread-count')) data = { count: 0 }
    if (pathname === '/api/me/conversations') data = { items: [currentConversation()], total: 1, page: 1, size: 20 }
    if (pathname === '/api/conversations/71') data = currentConversation()
    if (pathname === '/api/conversations/71/messages') data = { items: searchParams.has('afterSeq') ? [] : messages, hasMore: false }
    if (pathname === '/api/me/profile') {
      profileReads++
      data = profile
    }
    await route.fulfill({ json: { code: 0, data } })
  })
  return () => profileReads
}

test('浏览器位于洛杉矶时仍按上海日期和分钟展示聊天时间', async ({ page }) => {
  await page.clock.setFixedTime(now)
  await mockChat(page)
  await page.goto('/messages/conversations/71')

  const log = page.getByRole('log', { name: '沟通消息' })
  await expect(log.getByRole('article')).toHaveCount(4)
  await expect(log.locator('.chat-group-time')).toHaveText(['23:59', '00:00'])
  await expect(log.getByRole('separator')).toHaveText(['昨天', '今天'])
  await expect(page.getByRole('region', { name: /关联订单信息|关联需求信息/ })).toHaveCount(0)
})

test('一条会话中的多条本人消息共用一次头像资料查询', async ({ page }) => {
  await page.clock.setFixedTime(now)
  const profileReads = await mockChat(page)
  await page.goto('/messages/conversations/71')

  const avatars = page.getByRole('log', { name: '沟通消息' }).getByRole('img', { name: '我的头像', exact: true })
  await expect(avatars).toHaveCount(3)
  await expect.poll(() => avatars.evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
  expect(profileReads()).toBe(1)
})

test('对方头像加载失败后显示昵称首字，续签后以新地址恢复', async ({ page }) => {
  await page.clock.install({ time: now })
  let renewed = false
  await mockChat(page, () => ({
    ...conversation,
    otherAvatarUrl: renewed ? renewedOtherAvatar : initialOtherAvatar,
    otherAvatarExpiresAt: renewed ? '2026-11-27T16:20:00Z' : '2026-11-27T16:10:30Z',
  }))
  const failedImage = page.waitForResponse(response => response.url().endsWith(initialOtherAvatar) && response.status() === 403)
  await page.goto('/messages/conversations/71')
  await failedImage

  const reply = page.getByRole('log', { name: '沟通消息' }).getByRole('article').filter({ hasText: '收到，今天继续沟通。' })
  await expect(reply.getByText('测', { exact: true })).toBeVisible()
  renewed = true
  await page.clock.fastForward(31_000)

  const avatar = reply.getByRole('img', { name: '测试创作者的头像', exact: true })
  await expect(avatar).toHaveAttribute('src', renewedOtherAvatar)
  await expect.poll(() => avatar.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
})

for (const scenario of [
  { role: 'CREATOR', canPay: false, action: '查看订单' },
  { role: 'BUYER', canPay: true, action: '去支付' },
] as const) {
  test(`待付款订单会话为${scenario.role === 'BUYER' ? '买家' : '创作者'}提供「${scenario.action}」入口`, async ({ page }) => {
    await mockChat(page, () => ({
      ...conversation, orderId: '92', orderTitle: '定制木作', orderStatus: 'PENDING_PAY',
      orderAmount: '180.00', canPayOrder: scenario.canPay,
    }), scenario.role)
    await page.goto('/messages/conversations/71')

    const card = page.getByRole('region', { name: '关联订单信息', exact: true })
    await expect(card.getByRole('link', { name: '定制木作', exact: true })).toHaveAttribute('href', '/orders/92')
    await expect(card.getByText('待付款', { exact: true })).toBeVisible()
    await expect(card.getByText('¥ 180.00', { exact: true })).toBeVisible()
    await expect(card.getByRole('link', { name: scenario.action, exact: true })).toHaveAttribute('href', '/orders/92')
    await expect(card.getByRole('link', { name: scenario.canPay ? '查看订单' : '去支付', exact: true })).toHaveCount(0)
  })
}

test('选满三张消息图片后仍可重试预览并移除附件', async ({ page }) => {
  await mockChat(page)
  const imageUrl = '/test-chat-avatars/attachment.svg'
  const expiresAt = new Date(Date.now() + 300_000).toISOString()
  let uploaded = 0
  let secondImageReads = 0
  await page.route(`${api}/csrf`, route => route.fulfill({ json: { code: 0, data: { headerName: 'X-CSRF-TOKEN', token: 'test-token' } } }))
  await page.route(`${api}/conversations/71/images`, route => route.fulfill({
    json: { code: 0, data: { id: String(++uploaded), url: imageUrl, expiresAt } },
  }))
  // 第二张图片的首次签名读取失败，用户仍可重试或删除该附件。
  await page.route(`${api}/conversation-images/*`, route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)
    if (id === '2' && secondImageReads++ === 0) {
      return route.fulfill({ status: 503, json: { code: 503, message: '签名暂不可用', data: null } })
    }
    return route.fulfill({ json: { code: 0, data: { id, url: imageUrl, expiresAt } } })
  })
  await page.goto('/messages/conversations/71')

  const composer = page.locator('.chat-compose')
  const upload = composer.getByRole('button', { name: '消息图片上传', exact: true })
  await upload.focus()
  const fileChooser = page.waitForEvent('filechooser')
  await upload.press('Enter')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBTsAAAAASUVORK5CYII=', 'base64')
  await (await fileChooser).setFiles(['first.png', 'second.png', 'third.png'].map(name => ({ name, mimeType: 'image/png', buffer: png })))

  const thirdImage = composer.getByRole('img', { name: '消息图片 3', exact: true })
  await expect(thirdImage).toBeVisible()
  await expect(upload).toBeDisabled()
  await composer.getByRole('button', { name: '重新读取图片', exact: true }).click()
  await expect(composer.getByRole('img', { name: '消息图片 2', exact: true })).toBeVisible()
  await composer.getByRole('button', { name: '移除消息图片3', exact: true }).click()
  await expect(thirdImage).toHaveCount(0)
  await expect(upload).toBeEnabled()
})
