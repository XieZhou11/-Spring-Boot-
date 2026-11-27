import { randomUUID } from 'node:crypto'
import { test, expect } from './fixtures'
import { api, mutate, origin, prepareCreator, register } from './custom-request-support'

test.use({ storageMode: 'receiver' })

/** 捕获页面实际发出的业务读取，防止离开详情时把缺失参数拼入接口。 */
test('需求详情与报价对比离开后不读取空编号，刷新和返回保留已选对象与筛选', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(120_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '导航验收买家')
    const ids: string[] = []
    for (const title of ['导航验收第一份需求', '导航验收第二份需求']) {
      const content = { title, categoryId, purpose: '日常阅读', materialPreference: '天然原木', specification: '十二厘米', budgetMin: '100.00', budgetMax: '300.00', expectedShipDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), description: '希望制作一枚原木书签，保留自然纹理，边角打磨圆润，制作前确认名字雕刻的位置和字体。', referenceImageIds: [], visibility: 'PUBLIC', invitedCreatorId: null, sourceWorkId: null }
      const draftResponse = await mutate(page, '/me/custom-requests', { ...content, requestKey: randomUUID() })
      expect(draftResponse.status()).toBe(201)
      const draft = (await draftResponse.json()).data
      expect((await mutate(page, `/me/custom-requests/${draft.id}/publication`, { ...content, version: draft.version }, 'put')).status()).toBe(200)
      ids.push(draft.id)
    }
    const invalidRequests: string[] = []
    page.on('request', request => {
      const path = new URL(request.url()).pathname
      if (path.startsWith('/api/custom-requests/') && !/^\/api\/custom-requests\/[1-9]\d*(?:\/|$)/.test(path)) invalidRequests.push(path)
    })
    await page.goto(`/requests/${ids[0]}`)
    await expect(page.getByRole('heading', { name: '导航验收第一份需求', exact: true })).toBeVisible()
    await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '我的需求', exact: true }).click()
    await expect(page).toHaveURL('/my-requests')
    await expect(page.getByRole('link', { name: '导航验收第二份需求', exact: true })).toBeVisible()
    expect.soft(invalidRequests).toEqual([])
    await page.getByLabel('需求状态').selectOption('OPEN')
    await page.getByRole('button', { name: '筛选需求', exact: true }).click()
    await expect(page).toHaveURL('/my-requests?status=OPEN')
    await page.getByRole('link', { name: '导航验收第二份需求', exact: true }).click()
    await expect(page.getByRole('heading', { name: '导航验收第二份需求', exact: true })).toBeVisible()
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/my-requests?status=OPEN')
    await expect(page.getByRole('link', { name: '导航验收第一份需求', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('需求状态', { exact: true })).toHaveValue('OPEN')
    await expect(page.getByRole('heading', { name: '导航验收第二份需求', exact: true })).toBeVisible()
    await page.setViewportSize({ width: 1366, height: 900 })
    const list = await page.getByRole('region', { name: '我的需求', exact: true }).boundingBox()
    const detail = await page.getByRole('region', { name: '需求详情', exact: true }).boundingBox()
    expect(list!.x + list!.width).toBeLessThan(detail!.x)
    await page.screenshot({ path: testInfo.outputPath('buyer-request-workspace-1366.png'), fullPage: true })
    await page.getByRole('link', { name: '导航验收第一份需求', exact: true }).click()
    await expect(page.getByRole('heading', { name: '导航验收第一份需求', exact: true })).toBeVisible()
    await page.getByRole('link', { name: '导航验收第二份需求', exact: true }).click()
    await expect(page.getByRole('heading', { name: '导航验收第二份需求', exact: true })).toBeVisible()
    const originalDetail = page.url()
    await page.getByRole('link', { name: '查看报价对比', exact: true }).click()
    await expect(page.getByRole('heading', { name: '暂无有效报价', exact: true })).toBeVisible()
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/my-requests?status=OPEN')
    await page.getByRole('link', { name: '需求详情', exact: true }).click()
    await expect(page).toHaveURL(originalDetail)
    await expect(page.getByRole('link', { name: '查看报价对比', exact: true })).toBeFocused()
    await expect(page.locator('#quotes')).toHaveCount(1)
    await page.goto(`${originalDetail}#quotes`)
    await page.reload()
    await expect(page.locator('#quotes')).toBeInViewport()
    await page.getByRole('navigation', { name: '需求导航', exact: true }).getByRole('link', { name: '我的需求', exact: true }).click()
    await expect(page).toHaveURL('/my-requests?status=OPEN')
    await expect(page.getByLabel('需求状态', { exact: true })).toHaveValue('OPEN')
    await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '我的需求', exact: true }).click()
    await expect(page).toHaveURL('/my-requests')
    await expect(page.getByRole('link', { name: '导航验收第一份需求', exact: true })).toBeVisible()
    expect(invalidRequests).toEqual([])
    await page.getByRole('link', { name: '导航验收第一份需求', exact: true }).click()
    await expect(page.getByRole('heading', { name: '导航验收第一份需求', exact: true })).toBeVisible()
    expect((await page.request.get(`${api}/custom-requests/${ids[0]}`)).status()).toBe(200)

    await creator.goto('/requests')
    await creator.getByLabel('筛选预算下限', { exact: true }).fill('150')
    await creator.getByRole('button', { name: '筛选需求', exact: true }).click()
    await expect(creator).toHaveURL('/requests?minBudget=150')
    await creator.getByRole('link', { name: '导航验收第一份需求', exact: true }).click()
    await expect(creator).toHaveURL(url => url.pathname === `/requests/${ids[0]}` && url.searchParams.get('returnTo') === '/requests?minBudget=150')
    await expect(creator.getByRole('heading', { name: '导航验收第一份需求', exact: true })).toBeVisible()
    await creator.getByRole('navigation', { name: '需求导航', exact: true }).getByRole('link', { name: '需求大厅', exact: true }).click()
    await expect(creator).toHaveURL('/requests?minBudget=150')
    await expect(creator.getByLabel('筛选预算下限', { exact: true })).toHaveValue('150')
  } finally {
    await adminContext.close()
    await creatorContext.close()
  }
})
