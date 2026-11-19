import { randomUUID } from 'node:crypto'
import { test, expect } from './fixtures'
import { api, mutate, origin, prepareCreator, register } from './custom-request-support'

test.use({ storageMode: 'receiver' })

/** 捕获页面实际发出的业务读取，防止离开详情时把缺失参数拼入接口。 */
test('需求详情与报价对比离开后不读取空编号，返回与切换对象保持正确内容', async ({ page, browser, mailbox }) => {
  test.setTimeout(120_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const { categoryId } = await prepareCreator(await creatorContext.newPage(), await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
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
    await page.getByRole('link', { name: '导航验收第二份需求', exact: true }).click()
    await expect(page.getByRole('heading', { name: '导航验收第二份需求', exact: true })).toBeVisible()
    await page.getByRole('link', { name: '查看报价对比', exact: true }).click()
    await expect(page.getByRole('heading', { name: '暂无有效报价', exact: true })).toBeVisible()
    await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '我的需求', exact: true }).click()
    await expect(page).toHaveURL('/my-requests')
    await expect(page.getByRole('link', { name: '导航验收第一份需求', exact: true })).toBeVisible()
    expect(invalidRequests).toEqual([])
    await page.getByRole('link', { name: '导航验收第一份需求', exact: true }).click()
    await expect(page.getByRole('heading', { name: '导航验收第一份需求', exact: true })).toBeVisible()
    expect((await page.request.get(`${api}/custom-requests/${ids[0]}`)).status()).toBe(200)
  } finally {
    await adminContext.close()
    await creatorContext.close()
  }
})
