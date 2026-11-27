import { expect, test, type Page } from '@playwright/test'
import { origin } from './environment'
import type { WorkVO } from '../src/types/work'

const time = '2026-11-26T00:00:00+08:00'
const items = Array.from({ length: 40 }, (_, index): WorkVO => ({
  id: String(index + 1), creatorId: '2', creatorNickname: '木作创作者', creatorAvatarUrl: null,
  creatorAvatarExpiresAt: null, title: `木工作品 ${index + 1}`, categoryId: '3', categoryPath: ['木工'],
  mainImageIds: [], specificationImageIds: [], description: '手工制作的木制摆件。', processDescription: '',
  material: '木材', specification: '15cm', saleEnabled: false, customEnabled: false, stockPrice: null,
  customReferenceDays: null, sourceOrderId: null, version: '1', reviewStatus: 'ONLINE', stockStatus: null,
  submittedAt: null, firstSubmittedAt: null, onlineAt: time, updatedAt: time, createdAt: time,
  reviewReason: null, purchasable: false, customizable: false, coverImage: null,
}))
const creator = {
  id: '2', nickname: '木作创作者', bio: null, avatarUrl: null, avatarExpiresAt: null,
  categories: [], province: null, city: null, paused: false, averageRating: null, reviewCount: 40,
  positiveRate: null, completedOrderCount: 0, publicWorkCount: 40,
}
const empty = { items: [], total: 0, page: 1, size: 20 }

/** 使用实际 Vue 页面与浏览器历史，按需要阻塞列表接口来模拟异步返回。 */
async function context(page: Page, options: { admin?: boolean; favoritesTotal?: () => number } = {}) {
  await page.setViewportSize({ width: 1366, height: 768 })
  const role = options.admin ? 'ADMIN' : 'BUYER'
  await page.routeWebSocket(/\/ws\//, () => { /* 本组测试只验证页面导航。 */ })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.slice(4)
    const number = Number(url.searchParams.get('page') || '1')
    const start = (number - 1) * 20
    const pagedItems = items.slice(start, start + 20)
    let data: unknown = { count: 0 }
    if (path === '/sessions/current') data = { userId: '1', nickname: '浏览账号', roles: [role], activeRole: role }
    if (path === '/categories') data = []
    if (path === '/works') data = { items: pagedItems, total: items.length, page: number, size: 20 }
    if (/^\/works\/\d+$/.test(path)) data = items[Number(path.split('/').at(-1)) - 1]
    if (path.endsWith('/comments')) data = empty
    if (path === '/creators/2') data = creator
    if (path === '/creators/2/reviews') data = { ...empty, page: number, total: 40 }
    if (path === '/me/favorite-works') {
      const total = options.favoritesTotal?.() ?? items.length
      data = { total, page: number, size: 20, items: items.slice(start, Math.min(start + 20, total)).map(item => ({
        workId: item.id, available: true, title: item.title, creatorNickname: item.creatorNickname, coverImage: null,
      })) }
    }
    if (path === '/me/followed-creators') {
      data = { total: 40, page: number, size: 20, items: pagedItems.map(item => ({
        ...creator, available: true, creatorId: item.id, nickname: `关注创作者 ${item.id}`,
      })) }
    }
    if (/^\/creators\/\d+$/.test(path) && path !== '/creators/2') data = { ...creator, id: path.split('/').at(-1) }
    if (/^\/creators\/\d+\/reviews$/.test(path) && path !== '/creators/2/reviews') data = empty
    await route.fulfill({
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' },
      json: { code: 0, message: '', data },
    })
  })
}

test('广场详情的页面返回恢复筛选、等待卡片并消费原历史条目', async ({ page }) => {
  await context(page)
  let listReads = 0
  await page.route(url => url.pathname === '/api/works', async route => {
    if (++listReads > 1) await expect(page.getByText('正在读取作品…')).toBeVisible()
    await route.fallback()
  })
  await page.goto('/?page=2&keyword=木工&sort=PRICE_DESC')
  const card = page.getByRole('link', { name: '木工作品 38', exact: true })
  await card.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(700)
  await card.press('Enter')
  await expect(page).toHaveURL('/works/38')
  await expect(page.getByRole('heading', { name: '木工作品 38', level: 1, exact: true })).toBeVisible()
  const length = await page.evaluate(() => history.length)
  await page.getByText('返回作品广场', { exact: true }).click()
  await expect(page).toHaveURL('/?page=2&keyword=木工&sort=PRICE_DESC')
  await expect(card).toBeFocused()
  await expect.poll(() => page.evaluate(y => Math.abs(window.scrollY - y), before)).toBeLessThanOrEqual(3)
  expect(await page.evaluate(() => history.length)).toBe(length)
  await page.goForward()
  await expect(page).toHaveURL('/works/38')
  await page.goBack()
  await expect(card).toBeFocused()
  await expect.poll(() => page.evaluate(y => Math.abs(window.scrollY - y), before)).toBeLessThanOrEqual(3)
})

test('收藏第 2 页返回原作品，列表变短时返回最后有效页', async ({ page }) => {
  let total = 40
  await context(page, { favoritesTotal: () => total })
  await page.goto('/account/favorites')
  await page.getByRole('button', { name: '下一页' }).click()
  const card = page.getByRole('link', { name: '木工作品 23', exact: true })
  await expect(card).toBeVisible()
  await card.press('Enter')
  await expect(page).toHaveURL('/works/23')
  await page.getByText('返回收藏作品', { exact: true }).click()
  await expect(page).toHaveURL('/account/favorites?page=2')
  await expect(card).toBeFocused()
  await page.goForward()
  await expect(page).toHaveURL('/works/23')
  total = 22
  await page.goBack()
  await expect(page).toHaveURL('/account/favorites?page=2')
  await expect(page.getByRole('heading', { name: '收藏作品', exact: true })).toBeFocused()
  await page.goForward()
  await expect(page).toHaveURL('/works/23')
  total = 20
  await page.goBack()
  await expect(page).toHaveURL('/account/favorites')
  await expect(page.getByRole('link', { name: '木工作品 1', exact: true })).toBeVisible()
})

test('关注第 2 页的创作者主页返回原关注列表', async ({ page }) => {
  await context(page)
  await page.goto('/account/following')
  await page.getByRole('button', { name: '下一页' }).click()
  const entry = page.getByRole('link', { name: '关注创作者 23', exact: true })
  await expect(entry).toBeVisible()
  await entry.press('Enter')
  await expect(page).toHaveURL('/creators/23')
  await page.getByText('返回关注创作者', { exact: true }).click()
  await expect(page).toHaveURL('/account/following?page=2')
  await expect(entry).toBeFocused()
})

test('创作者主页往返作品时恢复相互独立的作品和评价页码', async ({ page }) => {
  await context(page)
  await page.goto('/creators/2')
  const reviews = page.getByRole('region', { name: '交易评价' })
  await reviews.getByRole('button', { name: '下一页' }).click()
  await page.getByRole('navigation', { name: '作品分页', exact: true }).getByRole('button', { name: '下一页' }).click()
  const work = page.getByRole('link', { name: '木工作品 23', exact: true })
  await expect(work).toBeVisible()
  await work.press('Enter')
  await expect(page).toHaveURL('/works/23')
  await page.getByText('返回创作者主页', { exact: true }).click()
  await expect(page).toHaveURL(/\/creators\/2\?/)
  await expect(work).toBeFocused()
  await expect(reviews.getByText('第 2 页 · 共 40 条')).toBeVisible()
  await work.press('Enter')
  const profile = page.getByRole('link', { name: /木作创作者.*查看主页/ })
  await expect(profile).toBeVisible()
  await profile.press('Enter')
  await expect(page).toHaveURL('/creators/2')
  await page.getByText('返回作品详情', { exact: true }).click()
  await expect(page).toHaveURL('/works/23')
  await expect(profile).toBeFocused()
})

test('管理员从新标签直达作品时返回管理员的广场入口', async ({ page }) => {
  await context(page, { admin: true })
  await page.goto('/works/23')
  await page.getByText('返回作品广场', { exact: true }).click()
  await expect(page).toHaveURL('/discover')
})

test('创作者主页的作品和评价都缩短时保留各自最后有效页', async ({ page }) => {
  await context(page)
  await page.goto('/creators/2?workPage=3&reviewPage=4')
  await expect(page).toHaveURL('/creators/2?workPage=2&reviewPage=2')
  await expect(page.getByRole('link', { name: '木工作品 23', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '评价分页' })).toContainText('第 2 页')
})
