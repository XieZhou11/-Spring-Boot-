import { test, expect } from './fixtures'
import { api, origin } from './environment'
import { image, mutate, publishWork, register } from './interaction-helpers'

test.use({ storageMode: 'receiver', databaseGroup: 'interactions', actionTimeout: 15_000 })

test('审核上架后互动、个人收藏关注、取消与下架失效', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const admin = await adminContext.newPage()
    const creator = await creatorContext.newPage()
    const { workId, creatorId } = await publishWork(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '寻木访客')
    await page.goto(`/works/${workId}`)
    await expect(page.getByRole('heading', { name: '山间手工木杯垫', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '点赞', exact: true }).click()
    await expect(page.getByRole('button', { name: '取消点赞', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '收藏', exact: true }).click()
    await page.getByRole('button', { name: '关注创作者', exact: true }).click()
    await page.getByLabel('评论内容', { exact: true }).fill('木纹的细节非常漂亮，很喜欢这样温暖的手作。')
    // 仅缩短真实签名响应的到期元数据，加速验证续签仍调用鉴权端点。
    let signatureReads = 0
    await page.route('**/api/work-comment-images', async route => {
      const response = await route.fetch()
      const json = await response.json()
      json.data.expiresAt = new Date(Date.now() + 1000).toISOString()
      await route.fulfill({ response, json })
    })
    await page.route('**/api/work-comment-images/*', async route => {
      signatureReads++
      const response = await route.fetch()
      const json = await response.json()
      json.data.expiresAt = new Date(Date.now() + 1000).toISOString()
      await route.fulfill({ response, json })
    })
    await page.getByLabel('评论图片', { exact: true }).setInputFiles({ name: 'comment.png', mimeType: 'image/png', buffer: image })
    await expect(page.getByRole('img', { name: '待发布评论图片 1', exact: true })).toBeVisible()
    await expect.poll(() => signatureReads, { timeout: 12_000 }).toBeGreaterThanOrEqual(2)
    await page.unroute('**/api/work-comment-images')
    await page.unroute('**/api/work-comment-images/*')
    await page.getByRole('button', { name: '发表评论', exact: true }).click()
    await expect(page.getByText('木纹的细节非常漂亮，很喜欢这样温暖的手作。', { exact: true })).toBeVisible()
    await expect(page.getByRole('img', { name: '评论图片 1', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: '取消收藏', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '取消关注', exact: true })).toBeVisible()
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`interactions-${width}.png`), fullPage: true })
    }
    const comments = (await (await page.request.get(`${api}/works/${workId}/comments`)).json()).data
    // 本人资源端点对其他用户隐藏评论存在性，管理员则明确禁止参与互动。
    expect((await mutate(creator, `/me/work-comments/${comments.items[0].id}`, 'delete')).status()).toBe(404)
    expect((await mutate(admin, `/me/work-comments/${comments.items[0].id}`, 'delete')).status()).toBe(403)
    await admin.goto(`/works/${workId}`)
    await expect(admin.getByText('木纹的细节非常漂亮，很喜欢这样温暖的手作。', { exact: true })).toBeVisible()
    await expect(admin.getByRole('button', { name: '发表评论', exact: true })).toHaveCount(0)
    await expect(admin.getByRole('button', { name: '点赞', exact: true })).toHaveCount(0)
    await page.goto('/account/favorites')
    await expect(page.getByRole('link', { name: /山间手工木杯垫/ }).first()).toBeVisible()
    // 封面加载后，标题及取消入口必须仍在卡片内部，不能只检查页面横向宽度。
    await expect.poll(() => page.locator('.saved-card').first().evaluate(card => {
      const bounds = card.getBoundingClientRect()
      return Array.from(card.querySelectorAll('h2, p, button')).every(child => child.getBoundingClientRect().bottom <= bounds.bottom)
    })).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('favorites-390.png'), fullPage: true })
    await page.getByRole('button', { name: '取消收藏', exact: true }).click()
    await expect(page.getByText('还没有收藏作品', { exact: true })).toBeVisible()
    await page.goto('/account/following')
    await expect(page.getByRole('link', { name: /山间木作/ }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('following-390.png'), fullPage: true })
    await page.getByRole('button', { name: '取消关注', exact: true }).click()
    await expect(page.getByText('还没有关注创作者', { exact: true })).toBeVisible()
    await page.goto(`/creators/${creatorId}`)
    await page.getByRole('button', { name: '关注创作者', exact: true }).click()
    await page.goto(`/works/${workId}`)
    await page.getByRole('button', { name: '收藏', exact: true }).click()
    const work = (await (await creator.request.get(`${api}/me/works/${workId}`)).json()).data
    expect((await mutate(creator, `/me/works/${workId}/publication`, 'put', { version: work.version, reason: '' })).status()).toBe(200)
    await page.goto('/account/favorites')
    await expect(page.getByText('已下架', { exact: true })).toBeVisible()
    await expect(page.getByText('山间手工木杯垫', { exact: true })).toHaveCount(0)
    await expect(page.locator('main img')).toHaveCount(0)
    await page.getByRole('button', { name: '取消收藏', exact: true }).click()
    await expect(page.getByText('还没有收藏作品', { exact: true })).toBeVisible()
    expect((await mutate(page, `/me/work-comments/${comments.items[0].id}`, 'delete')).status()).toBe(204)
    await page.goto(`/works/${workId}`)
    await expect(page.getByRole('alert')).toContainText('请求的资源不存在')
    await expect(page.getByRole('heading', { name: '山间手工木杯垫', exact: true })).toHaveCount(0)
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('收藏关注页面未登录时保留安全回跳地址', async ({ page }) => {
  for (const path of ['/account/favorites', '/account/following']) {
    await page.goto(path)
    await expect.poll(() => new URL(page.url()).searchParams.get('redirect')).toBe(path)
    expect(new URL(page.url()).pathname).toBe('/login')
  }
})

test('关系操作可重试，评论响应丢失保留输入且核对时不重发', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const { workId } = await publishWork(await creatorContext.newPage(), await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '慢慢手作')
    await page.goto(`/works/${workId}`)
    let relationRequests = 0
    await page.route(`**/api/me/favorite-works/${workId}`, async route => {
      relationRequests++
      const response = await route.fetch()
      if (relationRequests === 1) return route.abort('failed')
      return route.fulfill({ response })
    })
    await page.getByRole('button', { name: '收藏', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByRole('button', { name: '收藏', exact: true }).click()
    await expect(page.getByRole('button', { name: '取消收藏', exact: true })).toBeVisible()
    expect((await (await page.request.get(`${api}/me/favorite-works`)).json()).data.total).toBe(1)
    await page.unroute(`**/api/me/favorite-works/${workId}`)
    const text = '想知道这种温暖的木纹是怎样手工打磨出来的。'
    await page.getByLabel('评论内容', { exact: true }).fill(text)
    await page.getByLabel('评论图片', { exact: true }).setInputFiles({ name: 'network.png', mimeType: 'image/png', buffer: image })
    await expect(page.getByRole('img', { name: '待发布评论图片 1', exact: true })).toBeVisible()
    let posts = 0
    await page.route(`**/api/works/${workId}/comments`, async route => {
      if (route.request().method() !== 'POST') return route.continue()
      posts++
      const response = await route.fetch()
      expect(response.status()).toBe(201)
      return route.abort('failed')
    })
    await page.getByRole('button', { name: '发表评论', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('核对')
    await expect(page.getByLabel('评论内容', { exact: true })).toHaveValue(text)
    await expect(page.getByRole('img', { name: '待发布评论图片 1', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '发表评论', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '核对评论', exact: true }).click()
    await expect(page.getByText(text, { exact: true })).toBeVisible()
    expect(posts).toBe(1)
    expect((await (await page.request.get(`${api}/works/${workId}/comments`)).json()).data.total).toBe(1)
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('账号切换清除私有草稿并忽略前一账号的迟到关系响应', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  const secondContext = await browser.newContext({ baseURL: origin })
  let release = () => {}
  try {
    const { workId } = await publishWork(await creatorContext.newPage(), await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    const email = await register(await secondContext.newPage(), mailbox.codes, '新账号访客')
    await register(page, mailbox.codes, '旧账号访客')
    expect((await mutate(page, `/me/favorite-works/${workId}`, 'put')).status()).toBe(200)
    await page.goto(`/works/${workId}`)
    await expect(page.getByRole('button', { name: '取消收藏', exact: true })).toBeVisible()
    await page.getByLabel('评论内容', { exact: true }).fill('这份尚未发布的评论只属于前一个账号。')
    await page.getByLabel('评论图片', { exact: true }).setInputFiles({ name: 'private-draft.png', mimeType: 'image/png', buffer: image })
    await expect(page.getByRole('img', { name: '待发布评论图片 1', exact: true })).toBeVisible()
    let held = false
    let finished = false
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route(`**/api/works/${workId}/interactions`, async route => {
      if (held) return route.continue()
      const response = await route.fetch()
      held = true
      await gate
      try { await route.fulfill({ response }) } finally { finished = true }
    })
    await page.getByRole('button', { name: '核对评论', exact: true }).click()
    await expect.poll(() => held).toBe(true)
    // 模拟另一标签页登录新账号后，当前标签页恢复焦点核验真实会话。
    expect((await mutate(page, '/sessions', 'post', { email, password: 'CraftTest123' })).status()).toBe(201)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(page.getByRole('link', { name: /新账号访客.*个人中心/ })).toBeVisible()
    await expect(page.getByRole('button', { name: '收藏', exact: true })).toBeVisible()
    await expect(page.getByLabel('评论内容', { exact: true })).toHaveValue('')
    await expect(page.getByRole('img', { name: '待发布评论图片 1', exact: true })).toHaveCount(0)
    release()
    await expect.poll(() => finished).toBe(true)
    await expect(page.getByRole('button', { name: '收藏', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '取消收藏', exact: true })).toHaveCount(0)
  } finally { release(); await adminContext.close(); await creatorContext.close(); await secondContext.close() }
})

test('重读失败的草稿图片只恢复预览，不意外发表评论', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const { workId } = await publishWork(await creatorContext.newPage(), await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '图片访客')
    await page.goto(`/works/${workId}`)
    const text = '这份评论仍在编辑，恢复图片不应自动发表。'
    await page.getByLabel('评论内容', { exact: true }).fill(text)
    await page.route('**/api/work-comment-images', async route => {
      const response = await route.fetch()
      const json = await response.json()
      json.data.expiresAt = new Date(Date.now() - 1000).toISOString()
      await route.fulfill({ response, json })
    })
    await page.route('**/api/work-comment-images/*', route => route.abort('failed'))
    await page.getByLabel('评论图片', { exact: true }).setInputFiles({ name: 'retry.png', mimeType: 'image/png', buffer: image })
    const retry = page.getByRole('button', { name: '重新读取评论图片', exact: true })
    await expect(retry).toBeVisible()
    await page.unroute('**/api/work-comment-images/*')
    const accidentalPost = page.waitForRequest(request => request.url().endsWith(`/works/${workId}/comments`) && request.method() === 'POST', { timeout: 2000 }).then(() => true, () => false)
    await retry.click()
    await expect(page.getByRole('img', { name: '待发布评论图片 1', exact: true })).toBeVisible()
    expect(await accidentalPost).toBe(false)
    await expect(page.getByLabel('评论内容', { exact: true })).toHaveValue(text)
    expect((await (await page.request.get(`${api}/works/${workId}/comments`)).json()).data.total).toBe(0)
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('删除末页唯一评论后自动返回仍有内容的前页', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  page.on('dialog', dialog => dialog.accept())
  try {
    const { workId } = await publishWork(await creatorContext.newPage(), await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '分页访客')
    for (let index = 0; index < 21; index++) {
      expect((await mutate(page, `/works/${workId}/comments`, 'post', { content: `用于检查评论分页的第${index}条真实评论`, imageIds: [] })).status()).toBe(201)
    }
    await page.goto(`/works/${workId}`)
    await expect(page.locator('.work-comment')).toHaveCount(20)
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    await expect(page.locator('.work-comment')).toHaveCount(1)
    await page.getByRole('button', { name: '删除评论', exact: true }).click()
    await expect(page.locator('.work-comment')).toHaveCount(20)
    await expect(page.getByText('还没有评论，留下你的第一份共鸣。', { exact: true })).toHaveCount(0)
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('外部取消末页收藏和关注后刷新返回有效页', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const { workId, creatorId } = await publishWork(await creatorContext.newPage(), await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '列表分页访客')
    const userId = (await (await page.request.get(`${api}/sessions/current`)).json()).data.userId as string
    expect((await mutate(page, `/me/favorite-works/${workId}`, 'put')).status()).toBe(200)
    expect((await mutate(page, `/me/followed-creators/${creatorId}`, 'put')).status()).toBe(200)
    await mailbox.seedInteractionHistory(userId, workId, creatorId)
    for (const [path, resource, id] of [
      ['/account/favorites', 'favorite-works', workId],
      ['/account/following', 'followed-creators', creatorId],
    ] as const) {
      await page.goto(path)
      await expect(page.locator('.saved-card')).toHaveCount(20)
      await page.getByRole('button', { name: '下一页', exact: true }).click()
      await expect(page.locator('.saved-card')).toHaveCount(1)
      // 复用真实会话的独立HTTP请求，模拟另一标签取消，不触发本页remove回调。
      expect((await mutate(page, `/me/${resource}/${id}`, 'delete')).status()).toBe(204)
      await page.getByRole('button', { name: '刷新列表', exact: true }).click()
      await expect.soft(page.locator('.saved-card')).toHaveCount(20)
    }
  } finally { await adminContext.close(); await creatorContext.close() }
})
