import { test, expect } from './fixtures'
import { origin } from './environment'
import { publishWork, register } from './interaction-helpers'

test.use({ storageMode: 'receiver', databaseGroup: 'content-reports', actionTimeout: 15_000 })

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
    await page.getByLabel('说明', { exact: true }).fill('作品描述涉嫌夸大宣传，请管理员核实。')
    await page.getByRole('button', { name: '提交举报', exact: true }).click()
    await expect(page.getByText('举报已提交，管理员将核查处理', { exact: false })).toBeVisible()

    // 创作者发表评论后，访客举报该评论。
    await creator.goto(`/works/${workId}`)
    await creator.getByLabel('评论内容', { exact: true }).fill('感谢关注，后续会分享更多制作过程的细节。')
    await creator.getByRole('button', { name: '发表评论', exact: true }).click()
    await expect(creator.getByText('感谢关注，后续会分享更多制作过程的细节。', { exact: true })).toBeVisible()
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
    await expect(page.getByText(/举报作品/).first()).toBeVisible()
    await expect(page.getByText(/举报评论/).first()).toBeVisible()
    await expect(page.getByText(/举报创作者主页/).first()).toBeVisible()
    await page.getByRole('link', { name: /查看详情/ }).first().click()
    await expect(page.getByRole('heading', { name: /举报 #\d+/ })).toBeVisible()
    await expect(page.getByText('处理中', { exact: true })).toBeVisible()

    // 管理员在内容举报队列隐藏违规评论。
    await admin.goto('/admin/content-reports')
    await admin.getByRole('button', { name: /举报评论/ }).click()
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
    await expect(page.getByText('感谢关注，后续会分享更多制作过程的细节。', { exact: true })).toHaveCount(0)

    // 管理员暂停被举报主页的新业务，创作者收到持久化系统通知。
    await admin.goto('/admin/content-reports')
    await admin.getByRole('button', { name: /创作者主页/ }).click()
    await admin.getByLabel('处理依据', { exact: true }).fill('主页宣传与交付记录不符，暂停新业务。')
    await admin.getByRole('button', { name: '暂停新业务', exact: true }).click()
    await expect(admin.getByText('PAUSED', { exact: true })).toBeVisible()
    await creator.goto('/messages/notifications')
    await expect(creator.getByText('账号新业务已被暂停', { exact: false })).toBeVisible()
    await page.goto(`/creators/${creatorId}`)
    await expect(page.getByText('创作者暂时停止承接新业务', { exact: true })).toBeVisible()
  } finally {
    await adminContext.close()
    await creatorContext.close()
  }
})
