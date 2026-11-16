import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect } from './fixtures'
import { api } from './environment'

export const image = readFileSync(new URL('./avatar.png', import.meta.url))
/** 测试前置仍使用真实会话与 CSRF，服务端没有测试业务捷径。 */
export async function mutate(page: Page, path: string, method: 'post' | 'put' | 'delete' = 'post', data?: object) {
  const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
  return page.request[method](`${api}${path}`, { data, headers: { [csrf.headerName]: csrf.token } })
}
export async function register(page: Page, codes: Map<string, string>, nickname: string) {
  const email = `interact-${randomBytes(7).toString('hex')}@qq.com`
  expect((await mutate(page, '/email-verification-codes', 'post', { email })).status()).toBe(201)
  await expect.poll(() => codes.get(email)).toMatch(/^\d{6}$/)
  expect((await mutate(page, '/accounts', 'post', { email, nickname, password: 'CraftTest123', verificationCode: codes.get(email) })).status()).toBe(201)
  expect((await mutate(page, '/sessions', 'post', { email, password: 'CraftTest123' })).status()).toBe(201)
  return email
}
async function upload(page: Page, path: string) {
  const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
  const response = await page.request.post(`${api}${path}`, {
    headers: { [csrf.headerName]: csrf.token },
    multipart: { file: { name: 'handmade.png', mimeType: 'image/png', buffer: image } },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data.id as string
}
/** 经入驻、作品发布、管理员审核创建真正可浏览作品，不直接写业务状态。 */
export async function publishWork(creator: Page, admin: Page, codes: Map<string, string>, promote: (email: string) => Promise<void>) {
  const adminEmail = await register(admin, codes, '互动审核')
  await promote(adminEmail)
  const category = await mutate(admin, '/admin/categories', 'post', { name: `手作${randomBytes(3).toString('hex')}`, enabled: true, sortOrder: 1 })
  expect(category.status()).toBe(201)
  const parentId = (await category.json()).data.id
  const child = await mutate(admin, '/admin/categories', 'post', { parentId, name: '木作器物', enabled: true, sortOrder: 1 })
  expect(child.status()).toBe(201)
  const categoryId = (await child.json()).data.id
  await register(creator, codes, '山间木作')
  const creatorId = (await (await creator.request.get(`${api}/sessions/current`)).json()).data.userId as string
  const uploads: string[] = []
  for (let i = 0; i < 6; i++) uploads.push(await upload(creator, '/creator-application-images'))
  const application = await mutate(creator, '/me/creator-applications', 'post', {
    requestKey: randomUUID(), realName: '手作测试', contactPhone: '13800138000',
    province: '北京市', city: '市辖区', district: '东城区', categoryIds: [parentId], experienceYears: 5,
    introduction: '专注于原创手作的创作者，从选材到设计和每一个制作工序都由本人独立完成，希望用传统工艺带来舒适温暖的日常。',
    originalWorks: [0, 1, 2].map(i => ({ finishedImageIds: [uploads[i * 2]], processImageIds: [uploads[i * 2 + 1]] })),
    alipayAccount: '13800138000', payeeName: '手作测试', supportingDescription: '',
  })
  expect(application.status()).toBe(201)
  const applicationId = (await application.json()).data.id
  expect((await mutate(admin, `/admin/creator-applications/${applicationId}/review`, 'put', { decision: 'APPROVED', reason: '' })).status()).toBe(200)
  const content = {
    title: '山间手工木杯垫', categoryId, mainImageIds: [await upload(creator, '/work-images')], specificationImageIds: [],
    material: '胡桃木', specification: '直径十厘米', description: '独立设计和手工打磨的木杯垫，保留木材纹理，以天然木蜡油养护，请避免长时间浸泡。',
    processDescription: '经裁切、打磨、涂油后完成。', saleEnabled: false, customEnabled: false, stockPrice: null, customReferenceDays: null,
  }
  const draft = await mutate(creator, '/me/works', 'post', { ...content, requestKey: randomUUID() })
  expect(draft.status()).toBe(201)
  const work = (await draft.json()).data
  const submission = await mutate(creator, `/me/works/${work.id}/submission`, 'put', { ...content, version: work.version })
  expect(submission.status()).toBe(200)
  const version = (await submission.json()).data.version
  const review = await mutate(admin, `/admin/works/${work.id}/review`, 'put', { version, decision: 'APPROVED', reason: '' })
  expect(review.status()).toBe(200)
  expect((await review.json()).data.reviewStatus).toBe('ONLINE')
  return { workId: work.id as string, creatorId }
}
