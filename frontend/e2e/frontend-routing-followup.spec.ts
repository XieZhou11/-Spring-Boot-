import { expect, test, type Page } from '@playwright/test'
import { api, origin } from './environment'

const work = { id: '19', title: '编号规范验收作品', categoryPath: [], mainImageIds: [], specificationImageIds: [], creatorId: '21', creatorNickname: '验收创作者' }

async function mockBrowsing(page: Page, roles: string[] = ['BUYER']) {
  let sessionStatus = 200
  let workReads = 0
  const session = { userId: '12', nickname: '验收账号', roles, activeRole: 'BUYER' }
  await page.route(`${api}/**`, async route => {
    const path = new URL(route.request().url()).pathname
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' }
    if (path === '/api/sessions/current') {
      await route.fulfill({ status: sessionStatus, headers, json: { code: sessionStatus === 200 ? 0 : sessionStatus, data: session, message: '会话暂不可用' } })
      return
    }
    if (/^\/api\/works\/[^/]+$/.test(path)) workReads++
    const data = path === '/api/works/19' ? work
      : path.endsWith('/interactions') || path.endsWith('/interaction') ? { likeCount: 0, favoriteCount: 0, commentCount: 0 }
        : path.endsWith('unread-count') ? { count: 0 }
      : path.endsWith('/categories') ? []
        : path.endsWith('/creator-certification') ? { certificationStatus: roles.includes('CREATOR') ? 'APPROVED' : 'NONE' }
          : path.endsWith('custom-request-quota') ? { used: 0, limit: 5, remaining: 5 }
            : { items: [], total: 0, size: 20 }
    await route.fulfill({ headers, json: { code: 0, data } })
  })
  return {
    session,
    setSessionStatus(status: number) { sessionStatus = status },
    workReads: () => workReads,
  }
}

test('R2 已登录时核验失败保留当前页面，重试后恢复原业务目标', async ({ page }) => {
  const server = await mockBrowsing(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '作品广场' })).toBeVisible()
  const keyword = page.getByRole('searchbox', { name: '作品关键词' })
  await keyword.fill('尚未应用的关键词')
  server.setSessionStatus(503)
  await page.getByRole('link', { name: '我的订单' }).click()
  await expect(page.getByRole('region', { name: '页面导航反馈' })).toContainText('暂时无法连接服务')
  await expect(page).toHaveURL(`${origin}/`)
  await expect(keyword).toHaveValue('尚未应用的关键词')
  server.setSessionStatus(200)
  await page.getByRole('button', { name: '重试打开页面' }).click()
  await expect(page).toHaveURL(`${origin}/orders`)
})

test('R6 已打开详情后切到非法编号，旧组件不得按新编号查询', async ({ page }) => {
  const server = await mockBrowsing(page)
  await page.goto('/works/19')
  await expect.poll(server.workReads).toBe(1)
  await expect(page.getByRole('heading', { name: work.title, exact: true })).toBeVisible()
  await page.locator('#app').evaluate(async root => {
    const app = (root as HTMLElement & { __vue_app__: { config: { globalProperties: { $router: { push(path: string): Promise<void> } } } } }).__vue_app__
    await app.config.globalProperties.$router.push('/works/bad-id')
  })
  await expect(page.getByRole('heading', { name: '资源编号无效' })).toBeVisible()
  expect(server.workReads()).toBe(1)
})

test('R2 首次核验失败不展示业务内容，401 仍通过登录回跳', async ({ page }) => {
  const server = await mockBrowsing(page)
  server.setSessionStatus(503)
  await page.goto('/orders?side=BUYER#test')
  await expect(page.getByRole('region', { name: '页面导航反馈' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '我的订单' })).toHaveCount(0)
  server.setSessionStatus(401)
  await page.getByRole('button', { name: '重试打开页面' }).click()
  await expect(page).toHaveURL(url => url.pathname === '/login' && url.searchParams.get('redirect') === '/orders?side=BUYER#test')
})

test('R5 R6 未匹配链接有返回入口，非法编号不发出详情请求', async ({ page }) => {
  const server = await mockBrowsing(page)
  await page.goto('/old-missing-link?tab=archive')
  await expect(page.getByRole('heading', { name: '找不到页面' })).toBeVisible()
  await expect(page.getByRole('link', { name: '返回作品广场' })).toBeVisible()
  for (const path of ['/works/not-an-id', '/works/9223372036854775808', '/requests/invalid/quotes', '/messages/conversations/0']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: '资源编号无效' })).toBeVisible()
    await expect(page).toHaveURL(`${origin}${path}`)
  }
  expect(server.workReads()).toBe(0)
})

test('R3 认证续接绑定原账号，刷新后仍保留查询与锚点', async ({ page }) => {
  const roles = ['BUYER']
  await mockBrowsing(page, roles)
  const target = '/requests?allCategories=true#results'
  await page.goto(target)
  await expect(page).toHaveURL(url => url.pathname === '/account/creator-certification' && url.searchParams.get('redirect') === target)
  await expect(page.getByRole('link', { name: '继续前往' })).toHaveCount(0)
  roles.push('CREATOR')
  await page.reload()
  await expect(page.getByRole('link', { name: '继续前往' })).toHaveAttribute('href', target)
  await page.getByRole('link', { name: '继续前往' }).click()
  await expect(page).toHaveURL(`${origin}${target}`)
  await page.goto('/account/creator-certification')
  await expect(page.getByRole('link', { name: '继续前往' })).toHaveCount(0)
})

test('R3 另一账号及非法续接地址均不会显示续接入口', async ({ page }) => {
  const server = await mockBrowsing(page, ['BUYER', 'CREATOR'])
  const key = 'craftflow-creator-destination'
  await page.addInitScript(({ key }) => {
    if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify({ userId: '99', path: '/creator/works' }))
  }, { key })
  await page.goto('/account/creator-certification')
  await expect(page.getByRole('heading', { name: '认证状态' })).toBeVisible()
  await expect(page.getByRole('link', { name: '继续前往' })).toHaveCount(0)
  await page.evaluate(({ key, userId }) => sessionStorage.setItem(key, JSON.stringify({ userId, path: '//example.com/creator/works' })), { key, userId: server.session.userId })
  await page.reload()
  await expect(page.getByRole('heading', { name: '认证状态' })).toBeVisible()
  await expect(page.getByRole('link', { name: '继续前往' })).toHaveCount(0)
})
