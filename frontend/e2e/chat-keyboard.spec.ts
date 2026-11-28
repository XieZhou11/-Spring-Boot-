import { expect, test, type Page } from '@playwright/test'
import type { ChatMessageVO, ConversationVO } from '../src/types/customRequest'
import { api } from './environment'

const conversation: ConversationVO = {
  id: '71', requestId: null, orderId: null, orderTitle: null, orderStatus: null, orderAmount: null,
  canPayOrder: false, orderCoverImageId: null, requestTitle: null, requestStatus: null,
  otherUserId: '12', otherNickname: '测试创作者', otherAvatarUrl: null, otherAvatarExpiresAt: null,
  unreadCount: 0, lastMessageAt: null, lastMessageSeq: '0', readSeq: '0', canSend: true,
  sendDisabledReason: null, archivedAt: null, archiveReason: null,
}

/** 保留真实输入、滚动和表单事件，仅拦截浏览器发出的会话请求。 */
async function openChat(page: Page) {
  const sent: ChatMessageVO[] = []
  await page.routeWebSocket('**/api/ws', socket => socket.onMessage(message => {
    if (message === 'PING') socket.send(JSON.stringify({ type: 'PONG' }))
  }))
  await page.route(`${api}/**`, async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = null
    if (path === '/api/sessions/current') data = { userId: '11', nickname: '验收买家', roles: ['BUYER'], activeRole: 'BUYER' }
    if (path === '/api/csrf') data = { headerName: 'X-CSRF-TOKEN', token: 'test-csrf' }
    if (path.endsWith('/unread-count')) data = { count: 0 }
    if (path === '/api/me/conversations') data = { items: [conversation], total: 1, page: 1, size: 20 }
    if (path === '/api/conversations/71') data = conversation
    if (path === '/api/conversations/71/messages') {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as Pick<ChatMessageVO, 'content' | 'imageIds' | 'clientMessageKey'>
        const id = String(sent.length + 1)
        const message = { ...body, id, conversationId: '71', seqNo: id, senderId: '11', createdAt: new Date().toISOString(), referencedNodeId: null, referencedNodeCode: null }
        sent.push(message)
        data = message
      } else data = { items: [], hasMore: false }
    }
    await route.fulfill({ json: { code: 0, data } })
  })
  await page.goto('/messages/conversations/71')
  return { input: page.getByRole('textbox', { name: '沟通内容', exact: true }), sent }
}

test('Shift+Enter 换行，Enter 与发送按钮各提交一条消息', async ({ page }) => {
  const { input, sent } = await openChat(page)
  await input.fill('第一行')
  await input.press('Shift+Enter')
  await expect(input).toHaveValue('第一行\n')
  expect(sent).toHaveLength(0)
  await input.press('End')
  await page.keyboard.insertText('第二行')
  await input.press('Enter')
  const log = page.getByRole('log', { name: '沟通消息' })
  await expect(log).toContainText('第二行')
  expect(sent.map(message => message.content)).toEqual(['第一行\n第二行'])
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()

  await input.fill('用按钮发送')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await expect(log).toContainText('用按钮发送')
  expect(sent.map(message => message.content)).toEqual(['第一行\n第二行', '用按钮发送'])
})

test('输入法候选确认保留草稿，下一次明确按 Enter 才发送', async ({ page }) => {
  const { input, sent } = await openChat(page)
  await input.fill('确认后的中文')
  const events = await input.evaluate(element => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const composingEnter = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })
    element.dispatchEvent(composingEnter)
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '确认后的中文' }))
    const trailingEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    element.dispatchEvent(trailingEnter)
    return { composingPrevented: composingEnter.defaultPrevented, trailingPrevented: trailingEnter.defaultPrevented }
  })
  expect(events).toEqual({ composingPrevented: false, trailingPrevented: true })
  await expect(input).toHaveValue('确认后的中文')
  await expect(input).toBeEnabled()
  expect(sent).toHaveLength(0)
  await input.press('Enter')
  await expect(page.getByRole('log', { name: '沟通消息' })).toContainText('确认后的中文')
  expect(sent.map(message => message.content)).toEqual(['确认后的中文'])
})

test('长消息隐藏输入框滚动条并仍可使用滚轮', async ({ page }) => {
  const { input } = await openChat(page)
  await input.fill(Array.from({ length: 16 }, (_, index) => `第 ${index + 1} 行草稿`).join('\n'))
  await expect(input).toHaveCSS('scrollbar-width', 'none')
  await input.hover()
  await input.evaluate(element => { element.scrollTop = 0 })
  await page.mouse.wheel(0, 120)
  await expect.poll(() => input.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
})
