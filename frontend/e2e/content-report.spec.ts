import { test, expect } from './fixtures'
import { api, origin } from './environment'
import { image, mutate, publishWork, register } from './interaction-helpers'

test.use({ storageMode: 'receiver', databaseGroup: 'content-reports', actionTimeout: 15_000 })

test('消息中心的我的举报保留页签，等待列表响应后显示空状态', async ({ page, mailbox }) => {
  await page.setViewportSize({ width: 1107, height: 822 })
  await register(page, mailbox.codes, '举报列表访客')
  let release = () => {}
  const hold = new Promise<void>(resolve => { release = resolve })
  // 仅延迟真实列表请求，等待结果和空列表都由实际页面呈现。
  await page.route(url => url.pathname === '/api/me/reports', async route => {
    await hold
    await route.continue()
  })
  const tabs = page.getByRole('navigation', { name: '消息中心', exact: true })
  try {
    await page.goto('/messages/notifications')
    await tabs.getByRole('link', { name: '我的举报', exact: true }).click()
    await expect(page).toHaveURL('/me/reports')
    await expect(page.getByRole('heading', { name: '消息中心', exact: true })).toBeVisible()
    await expect(tabs.getByRole('link', { name: '我的举报', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('status').filter({ hasText: '正在读取举报列表' })).toBeVisible()
    await expect(page.getByText('还没有提交过举报。')).toHaveCount(0)
  } finally {
    release()
  }
  await expect(page.getByText('还没有提交过举报。')).toBeVisible()
  await tabs.getByRole('link', { name: '交易会话', exact: true }).click()
  await expect(page).toHaveURL('/messages/conversations')
  await expect(page.getByText('暂无会话', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '查看我的需求', exact: true })).toHaveCount(0)
  await tabs.getByRole('link', { name: '系统通知', exact: true }).click()
  await expect(page).toHaveURL('/messages/notifications')
})

/** 作品、评论与主页举报提交、我的举报列表及后台内容举报处置全链路。 */
test('举报入口提交、我的举报列表与后台隐藏评论处置', async ({ page, browser, mailbox }) => {
  test.setTimeout(300_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const admin = await adminContext.newPage()
    const creator = await creatorContext.newPage()
    const { workId, creatorId } = await publishWork(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '治理访客')

    // 访客举报已上架作品。
    await page.goto(`/works/${workId}`)
    await page.getByRole('button', { name: '举报作品', exact: true }).click()
    const workReport = page.getByLabel('说明', { exact: true })
    const workReportText = '作品描述涉嫌夸大宣传，请管理员核实。'
    await workReport.fill(workReportText)
    // 独立的评论读取失败时，作品举报草稿仍可继续提交。
    await page.route(url => url.pathname === `/api/works/${workId}/comments`, route => route.abort('failed'), { times: 1 })
    await page.getByRole('button', { name: '核对评论', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('请检查网络后重试')
    await expect(workReport).toHaveValue(workReportText)
    await page.getByRole('button', { name: '提交举报', exact: true }).click()
    await expect(page.getByText('举报已提交，管理员将核查处理', { exact: false })).toBeVisible()

    // 创作者发表评论后，访客举报该评论。
    const comment = '感谢关注，后续会分享更多制作过程的细节。关于选材、切割和打磨的完整记录会在完成后统一整理，并附上本轮工序照片，供大家对照讨论。照片中的半成品仍处于打磨阶段，请以最终成品为准。'
    await creator.goto(`/works/${workId}`)
    await creator.getByLabel('评论内容', { exact: true }).fill(comment)
    await creator.getByLabel('评论图片', { exact: true }).setInputFiles({ name: 'report-target.png', mimeType: 'image/png', buffer: image })
    await expect(creator.getByRole('img', { name: '待发布评论图片 1', exact: true })).toBeVisible()
    await creator.getByRole('button', { name: '发表评论', exact: true }).click()
    await expect(creator.getByText(comment, { exact: true })).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: '举报评论', exact: true }).click()
    await page.getByLabel('说明', { exact: true }).fill('这条评论包含引导站外交易的内容。')
    await page.getByRole('button', { name: '提交评论举报', exact: true }).click()
    await expect(page.getByText('举报已提交，管理员将核查处理', { exact: false })).toBeVisible()

    // 访客举报创作者主页。
    await page.goto(`/creators/${creatorId}`)
    await page.getByRole('button', { name: '举报主页', exact: true }).click()
    await page.getByLabel('说明', { exact: true }).fill('主页简介中的宣传内容与实际交付能力不符。')
    await page.getByRole('button', { name: '提交主页举报', exact: true }).click()
    await expect(page.getByText('举报已提交，管理员将核查处理', { exact: false })).toBeVisible()

    // 我的举报列表展示全部类型举报并可进入详情补充材料。
    await page.goto('/me/reports')
    await expect(page.getByRole('heading', { name: '我的举报' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
    await expect(page.getByText(/举报作品/).first()).toBeVisible()
    await expect(page.getByText(/举报评论/).first()).toBeVisible()
    await expect(page.getByText(/举报创作者主页/).first()).toBeVisible()
    await page.getByRole('link', { name: /查看详情/ }).first().click()
    await expect(page.getByRole('heading', { name: /举报 #\d+/ })).toBeVisible()
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
    await expect(page.getByText('处理中', { exact: true })).toBeVisible()

    // 管理员可以从队列打开目标作品，核对原评论全文和通过举报范围签名的图片。
    await admin.goto('/admin/content-reports')
    await admin.getByRole('button', { name: /举报作品/ }).click()
    await expect(admin.getByRole('link', { name: '查看作品审核材料' })).toHaveAttribute('href', `/admin/works/${workId}?status=ALL`)
    const originalImageRead = admin.waitForResponse(response => /\/api\/admin\/reports\/\d+\/comment-images\/\d+$/.test(response.url()))
    await admin.getByRole('button', { name: /举报评论/ }).click()
    const original = admin.getByRole('region', { name: '原评论' })
    await expect(original.getByText(comment, { exact: true })).toBeVisible()
    const originalImage = original.getByRole('img', { name: '原评论图片 1' })
    await expect(originalImage).toBeVisible()
    await expect.poll(() => originalImage.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
    const signed = await originalImageRead
    expect(signed.status()).toBe(200)
    expect((await page.request.get(signed.url())).status()).toBe(404)
    await admin.getByLabel('处理依据', { exact: true }).fill('评论内容与站外交易引导相关，予以隐藏。')
    await admin.getByRole('button', { name: '隐藏评论', exact: true }).click()
    await expect(admin.getByText('HIDDEN', { exact: true })).toBeVisible()
    // 已处理举报从待处理队列消失，其余待处理举报仍在；可在已处理筛选中查看结论。
    await expect(admin.getByRole('button', { name: /举报评论/ })).toHaveCount(0)
    await admin.getByRole('combobox', { name: '举报状态筛选' }).selectOption('PROCESSED')
    await expect(admin.getByText(/已处置 ·/).first()).toBeVisible()

    // 评论隐藏后公开列表不再展示，作品评论区计数归零。
    await page.goto(`/works/${workId}`)
    await expect(page.getByText('0 评论', { exact: false })).toBeVisible()
    await expect(page.getByText(comment, { exact: true })).toHaveCount(0)

    // 作者自删走公开作品入口，已提交举报仍可在举报记录中查到。
    const selfDeletedComment = '这条正常讨论用于核对作者删除和举报记录是否彼此独立。'
    const selfDeletedReport = '为这条评论提交的核验说明。'
    await creator.goto('/works/' + workId)
    await creator.getByLabel('评论内容', { exact: true }).fill(selfDeletedComment)
    await creator.getByRole('button', { name: '发表评论', exact: true }).click()
    await expect(creator.getByText(selfDeletedComment, { exact: true })).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: '举报评论', exact: true }).click()
    await page.getByLabel('说明', { exact: true }).fill(selfDeletedReport)
    await page.getByRole('button', { name: '提交评论举报', exact: true }).click()
    await expect(page.getByText('举报已提交，管理员将核查处理', { exact: false })).toBeVisible()
    creator.once('dialog', dialog => dialog.accept())
    await creator.getByRole('button', { name: '删除评论', exact: true }).click()
    await expect(creator.getByText(selfDeletedComment, { exact: true })).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('0 评论', { exact: false })).toBeVisible()
    await page.goto('/me/reports')
    const retainedReport = page.getByRole('article').filter({ hasText: selfDeletedReport })
    await retainedReport.getByRole('link', { name: '查看详情', exact: true }).click()
    await expect(page.getByText(selfDeletedReport, { exact: true })).toBeVisible()

    // 管理员暂停被举报主页的新业务，创作者收到持久化系统通知。
    await admin.goto('/admin/content-reports')
    await admin.getByRole('button', { name: /创作者主页/ }).click()
    await expect(admin.getByRole('link', { name: '查看创作者主页' })).toHaveAttribute('href', `/creators/${creatorId}`)
    await admin.getByLabel('处理依据', { exact: true }).fill('主页宣传与交付记录不符，暂停新业务。')
    await expect(admin.getByRole('button', { name: '暂停新业务', exact: true })).toBeDisabled()
    await admin.getByLabel('恢复条件', { exact: true }).fill('提交更新后的真实履约证明。')
    await admin.getByRole('button', { name: '暂停新业务', exact: true }).click()
    await expect(admin.getByText('PAUSED', { exact: true })).toBeVisible()
    await creator.goto('/messages/notifications')
    const pauseNotification = creator.locator('.notification-card').filter({ hasText: '账号新业务已被暂停' })
    await expect(pauseNotification).toBeVisible()
    await pauseNotification.getByRole('button', { name: '查看举报', exact: true }).click()
    await expect(creator).toHaveURL(/\/reports\/\d+$/)
    await expect(creator.getByRole('button', { name: '对处置结论提出异议' })).toBeVisible()
    await expect(creator.getByRole('navigation', { name: '主导航' })).toBeVisible()
    await page.goto(`/creators/${creatorId}`)
    await expect(page.getByText('创作者暂时停止承接新业务', { exact: true })).toBeVisible()
  } finally {
    await adminContext.close()
    await creatorContext.close()
  }
})

test('创作者主页换账号清除评价举报材料并忽略旧账号的迟到响应', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  let releaseRead = () => {}
  const holdRead = new Promise<void>(resolve => { releaseRead = resolve })
  try {
    const creator = await creatorContext.newPage()
    const { creatorId } = await publishWork(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    const newEmail = await register(page, mailbox.codes, '新评价访客')
    await register(page, mailbox.codes, '原评价举报人')
    const session = await page.request.get(`${api}/sessions/current`)
    expect(session.status()).toBe(200)
    const oldUserId = (await session.json()).data.userId
    const reviewId = '92001'
    const createdAt = '2026-11-25T10:00:00+08:00'
    const publicReview = { id: reviewId, buyerNickname: '交易买家', rating: 5, content: '确认收货后留下交易评价。', images: [], canReport: true, createdAt }
    const existingReport = { id: '93001', reviewId, reporterId: oldUserId, status: 'PENDING', reasonCode: 'OTHER', decisionReason: null }
    // 真实会话和主页负责上下文切换，受控评价响应负责精确重现迟到顺序。
    await page.route(url => url.pathname === `/api/creators/${creatorId}/reviews`, route => route.fulfill({
      json: { code: 0, data: { page: 1, size: 20, total: 1, items: [publicReview] } },
    }))
    let reads = 0
    await page.route(`**/api/reviews/${reviewId}/reports`, async route => {
      if (++reads === 2) await holdRead
      await route.fulfill({ json: { code: 0, data: [existingReport] } })
    })
    await page.goto(`/creators/${creatorId}`)
    await page.getByRole('button', { name: '查询关联举报', exact: true }).click()
    await expect(page.getByText('举报 #93001', { exact: false })).toBeVisible()
    await page.getByLabel('补充证据', { exact: true }).fill('待提交的私有举报证据')
    await page.getByRole('button', { name: '举报评价', exact: true }).click()
    await page.getByLabel('说明', { exact: true }).fill('原账号未提交的评价举报')
    await page.getByRole('button', { name: '查询关联举报', exact: true }).click()
    await expect.poll(() => reads).toBe(2)

    expect((await mutate(page, '/sessions', 'post', { email: newEmail, password: 'CraftTest123' })).status()).toBe(201)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(page.getByRole('link', { name: /新评价访客.*个人中心/ })).toBeVisible()
    await expect(page.getByText('确认收货后留下交易评价。', { exact: true })).toBeVisible()
    await expect(page.getByText('举报 #93001', { exact: false })).toHaveCount(0)
    await expect(page.getByLabel('补充证据', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('说明', { exact: true })).toHaveCount(0)

    const lateRead = page.waitForResponse(response => response.url().endsWith(`/api/reviews/${reviewId}/reports`))
    releaseRead()
    await (await lateRead).finished()
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(page.getByText('举报 #93001', { exact: false })).toHaveCount(0)
    await page.getByRole('button', { name: '举报评价', exact: true }).click()
    await expect(page.getByLabel('说明', { exact: true })).toHaveValue('')
  } finally {
    releaseRead()
    await adminContext.close()
    await creatorContext.close()
  }
})
