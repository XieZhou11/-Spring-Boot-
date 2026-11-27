import { test, expect } from './fixtures'
import { anotherCreator, api, fillRequest, image, mutate, origin, prepareCreator, register } from './custom-request-support'

test.use({ storageMode: 'receiver', actionTimeout: 15_000 })

test('新增二级品类后旧需求可定标、旧作品可直购且能按新末级发起同类定制', async ({ page: buyer, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const admin = await adminContext.newPage()
    const creator = await creatorContext.newPage()
    const { categoryId: rootId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin, true, false)
    await register(buyer, mailbox.codes, '存量品类买家')
    const address = await mutate(buyer, '/me/addresses', {
      recipientName: '存量品类收件人', phone: '13800138000', province: '北京市',
      city: '市辖区', district: '东城区', detailAddress: '存量品类测试路一号', isDefault: true,
    })
    expect(address.status()).toBe(201)

    const title = '可定制的存量木杯垫'
    const csrf = (await (await creator.request.get(`${api}/csrf`)).json()).data
    const upload = await creator.request.post(`${api}/work-images`, {
      headers: { [csrf.headerName]: csrf.token },
      multipart: { file: { name: 'work.png', mimeType: 'image/png', buffer: image } },
    })
    expect(upload.status()).toBe(201)
    const work = {
      title, categoryId: rootId, mainImageIds: [(await upload.json()).data.id], specificationImageIds: [],
      material: '天然原木', specification: '直径十厘米',
      description: '原木切割及手工打磨的杯垫，边缘圆润，使用环保木蜡油保养，平时可用干布轻擦。',
      processDescription: '', saleEnabled: true, customEnabled: true, stockPrice: '138.60', customReferenceDays: 15,
    }
    const draftResponse = await mutate(creator, '/me/works', { ...work, requestKey: crypto.randomUUID() })
    expect(draftResponse.status()).toBe(201)
    const draft = (await draftResponse.json()).data
    const submission = await mutate(creator, `/me/works/${draft.id}/submission`, { ...work, version: draft.version }, 'put')
    expect(submission.status()).toBe(200)
    const pending = (await submission.json()).data
    expect((await mutate(admin, `/admin/works/${draft.id}/review`, { version: pending.version, decision: 'APPROVED', reason: '' }, 'put')).status()).toBe(200)

    await buyer.goto('/my-requests/new')
    await fillRequest(buyer, rootId, '旧一级上的原木小物需求')
    await buyer.getByRole('button', { name: '发布需求', exact: true }).click()
    await expect(buyer).toHaveURL(/\/requests\/\d+$/)
    const requestPath = new URL(buyer.url()).pathname
    const quote = await mutate(creator, `/custom-requests/${requestPath.split('/').at(-1)}/quotes`, {
      requestKey: crypto.randomUUID(), goodsAmount: '170.00', durationDays: 12,
      proposal: '选用优质木材，顺纹切割并采用细砂纸打磨，先与买家确认规格和刻印内容，再做环保木蜡油养护。',
      additionalAgreement: '', imageIds: [],
    })
    expect(quote.status()).toBe(201)

    // 保存引用原一级品类的草稿，覆盖新增子类前已打开及之后再续编的入口。
    await buyer.goto(`/works/${draft.id}`)
    await buyer.getByRole('link', { name: /发起同类定制/ }).click()
    await fillRequest(buyer, rootId, '根据存量木杯垫另行制作')
    await buyer.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(buyer).toHaveURL(/\/my-requests\/\d+\/edit$/)
    const editPath = new URL(buyer.url()).pathname

    const child = await mutate(admin, '/admin/categories', { name: '手工杯垫', parentId: rootId, enabled: true, sortOrder: 1 })
    expect(child.status()).toBe(201)
    const childId = (await child.json()).data.id as string
    expect((await mutate(admin, '/admin/categories', { name: '暂停的杯垫类', parentId: rootId, enabled: false, sortOrder: 2 })).status()).toBe(201)

    // 已打开的编辑页收到明确拒绝后可直接重选，未保存的文字与来源仍保留。
    const requestTitle = buyer.getByLabel('需求标题', { exact: true })
    await requestTitle.fill('根据存量木杯垫另行制作并刻印')
    const rejectedPublication = buyer.waitForResponse(response =>
      response.request().method() === 'PUT' && response.url().endsWith('/publication'),
    )
    await buyer.getByRole('button', { name: '发布需求', exact: true }).click()
    expect((await rejectedPublication).status()).toBe(400)
    await expect(requestTitle).toHaveValue('根据存量木杯垫另行制作并刻印')
    const categories = buyer.getByLabel('需求品类', { exact: true })
    await expect(categories.getByRole('option', { name: '请选择末级品类', exact: true })).toHaveJSProperty('selected', true)
    await expect(categories.locator('option')).toHaveCount(2)
    await expect(buyer.getByText('请选择原作品主品类下启用的末级品类', { exact: true })).toBeVisible()
    await expect(buyer.getByText(`参考作品：${title}`, { exact: false })).toBeVisible()
    await expect(buyer.getByText('指定创作者：', { exact: false })).toContainText('山间器物')
    await categories.selectOption(childId)
    await buyer.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(buyer.getByText('草稿已保存', { exact: true })).toBeVisible()
    await buyer.reload()
    await expect(buyer).toHaveURL(editPath)
    await expect(categories).toHaveValue(childId)
    await buyer.getByRole('button', { name: '发布需求', exact: true }).click()
    await expect(buyer).toHaveURL(/\/requests\/\d+$/)
    const published = await buyer.request.get(`${api}/custom-requests/${new URL(buyer.url()).pathname.split('/').at(-1)}`)
    expect(published.status()).toBe(200)
    expect((await published.json()).data).toMatchObject({
      categoryId: childId, sourceWorkId: draft.id, invitedCreatorId: draft.creatorId, visibility: 'DIRECTED',
    })

    await buyer.goto(`${requestPath}/quotes`)
    await buyer.getByRole('button', { name: '选择此方案', exact: true }).click()
    await buyer.getByRole('button', { name: '确认定标并生成订单', exact: true }).click()
    await expect(buyer).toHaveURL(/\/orders\/\d+$/)

    await buyer.goto(`/?purchasable=true&customizable=true&categoryId=${rootId}`)
    await buyer.getByRole('link', { name: title, exact: true }).click()
    await expect(buyer).toHaveURL(url => url.pathname === `/works/${draft.id}`)
    await buyer.getByRole('link', { name: /发起同类定制/ }).click()
    await expect(categories.getByRole('option', { name: '请选择末级品类', exact: true })).toHaveJSProperty('selected', true)
    await expect(categories.locator('option')).toHaveCount(2)
    await buyer.goto(`/works/${draft.id}`)
    await buyer.getByRole('button', { name: '立即购买现货', exact: true }).click()
    await buyer.getByRole('dialog', { name: '确认现货直购订单' }).getByRole('button', { name: /^确认购买/ }).click()
    await expect(buyer).toHaveURL(/\/orders\/\d+$/)
    const stockOrder = await buyer.request.get(`${api}${new URL(buyer.url()).pathname}`)
    expect(stockOrder.status()).toBe(200)
    expect((await stockOrder.json()).data.orderType).toBe('STOCK')
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('买家保存不完整草稿、恢复、发布、关闭复制，普通买家无大厅权限', async ({ page, browser, mailbox }) => {
  test.setTimeout(180_000)
  const adminContext = await browser.newContext()
  const creatorContext = await browser.newContext()
  try {
    const { categoryId } = await prepareCreator(await creatorContext.newPage(), await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '定制买家')
    await page.goto('/my-requests/new')
    await expect(page.getByRole('heading', { name: '发布定制需求', exact: true })).toBeVisible()
    await page.getByLabel('需求标题', { exact: true }).fill('手工原木书签定制')
    await page.getByLabel('预算下限（元）', { exact: true }).fill('1')
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByLabel('预算下限（元）', { exact: true }).fill('100')
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(page).toHaveURL(/\/my-requests\/\d+\/edit$/)
    await page.reload()
    await expect(page.getByLabel('需求标题', { exact: true })).toHaveValue('手工原木书签定制')
    await page.getByLabel('需求品类', { exact: true }).selectOption(categoryId)
    await page.getByLabel('用途', { exact: true }).fill('送给爱读书的朋友')
    await page.getByLabel('材质偏好', { exact: true }).fill('天然胡桃木')
    await page.getByLabel('尺寸规格', { exact: true }).fill('长 12 厘米、宽 3 厘米')
    await page.getByLabel('预算下限（元）', { exact: true }).fill('100')
    await page.getByLabel('预算上限（元）', { exact: true }).fill('300')
    await page.getByLabel('期望发货日期', { exact: true }).fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
    await page.getByLabel('需求描述', { exact: true }).fill('希望制作一枚保留天然木纹的原木书签，表面细腻圆润，可以刻上朋友名字，作为生日礼物。')
    await page.getByLabel('参考图片', { exact: true }).setInputFiles({ name: 'reference.png', mimeType: 'image/png', buffer: image })
    await expect(page.getByRole('img', { name: '参考图片 1', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '发布需求', exact: true }).click()
    await expect(page).toHaveURL(/\/requests\/\d+$/)
    await expect(page.getByRole('heading', { name: '手工原木书签定制' })).toBeVisible()
    expect((await page.request.get(`${api}/custom-requests`)).status()).toBe(403)
    await page.getByRole('button', { name: '关闭需求', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确认关闭', exact: true }).click()
    await expect(page.getByRole('region', { name: '需求详情' }).getByText('已关闭', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '复制为新草稿', exact: true }).click()
    await expect(page).toHaveURL(/\/my-requests\/\d+\/edit$/)
    await expect(page.getByLabel('需求标题', { exact: true })).toHaveValue('手工原木书签定制')
    await expect(page.getByLabel('需求范围', { exact: true })).toHaveValue('PUBLIC')
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('公开咨询图文、多端推送与丢响应重试，关闭后历史保留', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(240_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage()
    const { categoryId } = await prepareCreator(creator, await adminContext.newPage(), mailbox.codes, mailbox.promoteAdmin)
    await register(page, mailbox.codes, '沟通买家')
    await page.goto('/my-requests/new')
    await fillRequest(page, categoryId, '生日原木小物定制')
    await page.getByRole('button', { name: '发布需求', exact: true }).click()
    await expect(page).toHaveURL(/\/requests\/\d+$/)
    const requestId = page.url().split('/').at(-1)!
    expect((await mutate(creator, '/me/custom-requests', { requestKey: crypto.randomUUID(), title: '创作者自己的未完成草稿' })).status()).toBe(201)
    await creator.goto('/requests')
    await creator.getByLabel('筛选预算下限', { exact: true }).fill('300')
    await creator.getByRole('button', { name: '筛选需求', exact: true }).click()
    await creator.getByRole('link', { name: '我的需求', exact: true }).first().click()
    await expect(creator.getByRole('link', { name: '创作者自己的未完成草稿', exact: true })).toBeVisible()
    await creator.getByRole('link', { name: '需求大厅', exact: true }).first().click()
    await creator.getByRole('link', { name: '生日原木小物定制', exact: true }).click()
    await creator.getByRole('button', { name: '进入需求沟通', exact: true }).click()
    await expect(creator).toHaveURL(/\/messages\/conversations\/\d+$/)
    const conversationId = creator.url().split('/').at(-1)!
    await creator.getByLabel('沟通内容', { exact: true }).fill('你好，可以手工雕刻名字，请问希望哪种字体？')
    await creator.getByRole('button', { name: '发送', exact: true }).click()
    await expect(creator.locator('.chat-message')).toHaveCount(1)
    await page.goto('/messages/conversations')
    await page.getByRole('link', { name: /山间器物/ }).click()
    await expect(page.getByRole('log')).toContainText('希望哪种字体')
    const list = await page.locator('.conversation-list').boundingBox()
    const detail = await page.locator('.conversation-detail').boundingBox()
    expect(list!.x + list!.width).toBeLessThanOrEqual(detail!.x)
    // 消息脱离个人中心后，未发送草稿仍应阻止切换到通知页。
    await page.getByLabel('沟通内容', { exact: true }).fill('暂未发送的草稿')
    await page.getByRole('link', { name: '系统通知', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click()
    await expect(page).toHaveURL(`/messages/conversations/${conversationId}`)
    await expect(page.getByLabel('沟通内容', { exact: true })).toHaveValue('暂未发送的草稿')
    await page.getByLabel('沟通内容', { exact: true }).fill('')
    await page.bringToFront()
    await expect.poll(async () => (await (await page.request.get(`${api}/me/conversations/unread-count`)).json()).data.count).toBe(0)
    // 模拟服务端已提交但HTTP响应丢失；重试后仅有一条持久消息。
    await page.route(`**/api/conversations/${conversationId}/messages`, async route => {
      if (route.request().method() !== 'POST') return route.continue()
      const response = await route.fetch(); expect(response.status()).toBe(201)
      await route.abort('failed')
    })
    await page.getByLabel('沟通内容', { exact: true }).fill('想要简洁的手写体，可以先给我看一下参考吗？')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.getByRole('button', { name: '重试确认发送', exact: true })).toBeVisible()
    await page.unroute(`**/api/conversations/${conversationId}/messages`)
    await page.getByRole('button', { name: '重试确认发送', exact: true }).click()
    await expect(page.locator('.chat-message')).toHaveCount(2)
    await expect(creator.getByRole('log')).toContainText('简洁的手写体', { timeout: 3000 })
    await page.context().setOffline(true)
    await creator.getByLabel('沟通内容', { exact: true }).fill('离线期间补充：我会先准备两款字体供你选择。')
    await creator.getByRole('button', { name: '发送', exact: true }).click()
    await expect(creator.locator('.chat-message')).toHaveCount(3)
    await page.context().setOffline(false)
    await page.bringToFront()
    await page.getByRole('button', { name: '刷新消息', exact: true }).click()
    await expect(page.getByRole('log')).toContainText('离线期间补充')
    // 标签页可见但消息区域位于屏幕外时，仍应保留未读。
    await page.setViewportSize({ width: 390, height: 360 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await creator.getByLabel('沟通内容', { exact: true }).fill('屏幕外的新消息：请确认书签末端是否需要打孔。')
    await creator.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.getByRole('log')).toContainText('屏幕外的新消息')
    await expect.poll(async () => (await (await page.request.get(`${api}/me/conversations/unread-count`)).json()).data.count).toBeGreaterThan(0)
    await page.locator('.chat-message').filter({ hasText: '屏幕外的新消息' }).scrollIntoViewIfNeeded()
    await expect(page.locator('.chat-message').filter({ hasText: '屏幕外的新消息' })).toBeInViewport()
    await expect.poll(async () => (await (await page.request.get(`${api}/me/conversations/unread-count`)).json()).data.count).toBe(0)
    await page.setViewportSize({ width: 1440, height: 1000 })
    const uploadResult = creator.waitForResponse(r => r.url().endsWith(`/conversations/${conversationId}/images`) && r.request().method() === 'POST')
    const fileChooser = creator.waitForEvent('filechooser')
    await creator.getByRole('button', { name: '消息图片上传', exact: true }).click()
    await (await fileChooser).setFiles({ name: 'sample.png', mimeType: 'image/png', buffer: image })
    const uploaded = await uploadResult
    expect(uploaded.status()).toBe(201)
    const imageId = (await uploaded.json()).data.id as string
    await expect(creator.getByRole('img', { name: '消息图片 1', exact: true })).toBeVisible()
    // 上传后仍是发送者的临时内容，只有持久化到消息后收件方才可读取。
    expect((await page.request.get(`${api}/conversation-images/${imageId}`)).status()).toBe(404)
    await creator.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.getByRole('log').getByRole('img', { name: '消息图片 1', exact: true })).toBeVisible({ timeout: 3000 })
    expect((await page.request.get(`${api}/conversation-images/${imageId}`)).status()).toBe(200)
    await page.screenshot({ path: testInfo.outputPath('request-chat-1440.png'), fullPage: true })
    for (const width of [1440, 390]) { await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true) }
    await page.screenshot({ path: testInfo.outputPath('request-chat-390.png'), fullPage: true })
    const control = await page.context().newPage()
    await control.goto(`/requests/${requestId}`)
    await control.getByRole('button', { name: '关闭需求', exact: true }).click()
    await control.getByRole('dialog').getByRole('button', { name: '确认关闭', exact: true }).click()
    await expect(creator.getByLabel('沟通内容', { exact: true })).toHaveCount(0)
    await expect(creator.getByRole('log').getByRole('img', { name: '消息图片 1', exact: true })).toBeVisible()
    expect((await page.request.get(`${api}/conversation-images/${imageId}`)).status()).toBe(200)
    await page.reload()
    await expect(page.getByRole('log')).toContainText('简洁的手写体')
  } finally { await adminContext.close(); await creatorContext.close() }
})

test('单人定向邀约从报价走到定标，原会话保留且作品入口带入来源', async ({ page, browser, mailbox }, testInfo) => {
  test.setTimeout(240_000)
  const adminContext = await browser.newContext({ baseURL: origin })
  const creatorContext = await browser.newContext({ baseURL: origin })
  const outsiderContext = await browser.newContext({ baseURL: origin })
  try {
    const creator = await creatorContext.newPage(); const admin = await adminContext.newPage(); const outsider = await outsiderContext.newPage()
    const { categoryId, applicationId } = await prepareCreator(creator, admin, mailbox.codes, mailbox.promoteAdmin)
    const creatorId = (await (await creator.request.get(`${api}/sessions/current`)).json()).data.userId as string
    const application = (await (await creator.request.get(`${api}/me/creator-applications/${applicationId}`)).json()).data
    await anotherCreator(outsider, admin, mailbox.codes, application.categoryIds[0])
    await register(page, mailbox.codes, '定向买家')
    await page.goto(`/creators/${creatorId}`)
    await page.getByRole('link', { name: '邀请定制', exact: false }).click()
    await expect(page.getByLabel('需求范围', { exact: true })).toHaveValue('DIRECTED')
    await fillRequest(page, categoryId, '专属刻字书签定制')
    await page.getByRole('button', { name: '发布需求', exact: true }).click()
    await expect(page).toHaveURL(/\/requests\/\d+$/)
    const requestId = new URL(page.url()).pathname.split('/').at(-1)!
    expect((await outsider.request.get(`${api}/custom-requests/${requestId}`)).status()).toBe(404)
    expect((await mutate(outsider, `/custom-requests/${requestId}/quotes`, {
      requestKey: crypto.randomUUID(),
      goodsAmount: '180.00',
      durationDays: 10,
      proposal: '使用天然胡桃木，沿木纹切割打磨并刻字，采用木蜡油养护，制作前先确认尺寸及字体。',
      additionalAgreement: '',
      imageIds: [],
    })).status()).toBe(404)
    const hallResponse = await creator.request.get(`${api}/custom-requests?allCategories=true`)
    expect(hallResponse.status()).toBe(200)
    expect((await hallResponse.json()).data.items.map((item: { id: string }) => item.id)).not.toContain(requestId)
    await creator.goto('/creator/invitations')
    await creator.getByRole('link', { name: '专属刻字书签定制', exact: true }).click()
    await creator.getByRole('button', { name: '进入需求沟通', exact: true }).click()
    await expect(creator).toHaveURL(/\/messages\/conversations\/\d+$/)
    const conversationId = new URL(creator.url()).pathname.split('/').at(-1)!
    expect((await outsider.request.get(`${api}/conversations/${conversationId}`)).status()).toBe(404)
    const originalMessage = '可以先确认刻字位置和字体。'
    await creator.getByLabel('沟通内容', { exact: true }).fill(originalMessage)
    await creator.getByRole('button', { name: '发送', exact: true }).click()
    await expect(creator.getByRole('log')).toContainText(originalMessage)

    await creator.goto(`/requests/${requestId}#quotes`)
    await creator.getByLabel('报价金额（元）', { exact: true }).fill('180.00')
    await creator.getByLabel('工期（自然日）', { exact: true }).fill('10')
    await creator.getByLabel('方案说明', { exact: true }).fill('选用天然胡桃木，沿木纹切割并手工打磨，刻字位置、字体及尺寸确认后再制作，最后使用环保木蜡油养护。')
    await creator.getByRole('button', { name: '提交报价', exact: true }).click()
    await expect(creator.locator('.quote-record')).toContainText('有效报价')

    const addressResponse = await mutate(page, '/me/addresses', {
      recipientName: '定向测试收件人',
      phone: '13800138000',
      province: '北京市',
      city: '市辖区',
      district: '东城区',
      detailAddress: '定向测试路一号',
      isDefault: true,
    })
    expect(addressResponse.status()).toBe(201)
    const { id: addressId } = (await addressResponse.json()).data
    await page.goto(`/requests/${requestId}`)
    await page.getByRole('link', { name: '查看报价对比', exact: true }).click()
    await expect(page.getByRole('table', { name: '报价方案对比' })).toContainText('180.00')
    await page.getByRole('button', { name: '选择此方案', exact: true }).click()
    await expect(page.getByLabel('选择收货地址', { exact: true })).toHaveValue(addressId)
    await page.getByRole('button', { name: '确认定标并生成订单', exact: true }).click()
    await expect(page).toHaveURL(/\/orders\/\d+$/)
    const orderId = new URL(page.url()).pathname.split('/').at(-1)!
    const ordersResponse = await page.request.get(`${api}/me/orders`)
    expect(ordersResponse.status()).toBe(200)
    expect((await ordersResponse.json()).data.total).toBe(1)
    await page.getByRole('link', { name: '进入订单沟通', exact: true }).click()
    await expect(page).toHaveURL(`/messages/conversations/${conversationId}`)
    await expect(page.getByRole('log')).toContainText(originalMessage)
    const buyerCard = page.getByRole('region', { name: '关联订单信息' })
    await expect(buyerCard).toContainText('待付款')
    await expect(buyerCard).toContainText('180.00')
    await expect(buyerCard.getByRole('link', { name: '去支付', exact: true })).toHaveAttribute('href', `/orders/${orderId}`)
    await page.screenshot({ path: testInfo.outputPath('directed-order-conversation.png'), fullPage: true })
    await creator.goto(`/messages/conversations/${conversationId}`)
    const creatorCard = creator.getByRole('region', { name: '关联订单信息' })
    await expect(creatorCard.getByRole('link', { name: '查看订单', exact: true })).toHaveAttribute('href', `/orders/${orderId}`)
    await expect(creatorCard.getByRole('link', { name: '去支付', exact: true })).toHaveCount(0)

    const csrf = (await (await creator.request.get(`${api}/csrf`)).json()).data
    const uploaded = await creator.request.post(`${api}/work-images`, { headers: { [csrf.headerName]: csrf.token }, multipart: { file: { name: 'work.png', mimeType: 'image/png', buffer: image } } })
    expect(uploaded.status()).toBe(201)
    const content = { title: '原木刻字参考作品', categoryId, mainImageIds: [(await uploaded.json()).data.id], specificationImageIds: [], material: '胡桃木', specification: '十二厘米', description: '手工打磨的原木书签，保留天然木纹，使用天然木蜡油养护，日常使用请保持干燥，避免长时间浸泡。', processDescription: '', saleEnabled: false, customEnabled: true, stockPrice: null, customReferenceDays: 15 }
    const draft = (await (await mutate(creator, '/me/works', { ...content, requestKey: crypto.randomUUID() })).json()).data
    const pending = (await (await mutate(creator, `/me/works/${draft.id}/submission`, { ...content, version: draft.version }, 'put')).json()).data
    expect((await mutate(admin, `/admin/works/${draft.id}/review`, { version: pending.version, decision: 'APPROVED', reason: '' }, 'put')).status()).toBe(200)
    await page.goto(`/works/${draft.id}`)
    // 作品互动与来源定制入口共存，不能因组件接入丢失作者或原作品上下文。
    await page.getByRole('button', { name: '收藏 收藏数 0', exact: true }).click()
    await expect(page.getByRole('button', { name: '取消收藏 收藏数 1', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '关注创作者', exact: true }).click()
    await expect(page.getByRole('button', { name: '取消关注', exact: true })).toBeVisible()
    await page.getByRole('link', { name: /发起同类定制/ }).click()
    await expect(page.getByLabel('需求品类', { exact: true })).toHaveValue(categoryId)
    await expect(page.getByLabel('需求范围', { exact: true })).toHaveValue('DIRECTED')
    await expect(page.getByText('指定创作者：', { exact: false })).toContainText('山间器物')
    await expect(page.getByText('参考作品：原木刻字参考作品', { exact: false })).toBeVisible()
  } finally { await adminContext.close(); await creatorContext.close(); await outsiderContext.close() }
})
