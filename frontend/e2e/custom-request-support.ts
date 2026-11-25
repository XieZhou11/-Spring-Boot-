import { randomUUID, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect } from './fixtures'
import { api } from './environment'

export { api, origin } from './environment'
export const image = readFileSync(new URL('./avatar.png', import.meta.url))
/** 测试通过真实注册、CSRF和会话准备参与人，绝不复用开发账号。 */
export async function mutate(page: Page, path: string, data?: object, method: 'post' | 'put' = 'post') {
  const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
  return page.request[method](`${api}${path}`, { data, headers: { [csrf.headerName]: csrf.token } })
}
export async function register(page: Page, codes: Map<string, string>, nickname: string) {
  const email = `demand-${randomBytes(6).toString('hex')}@qq.com`
  expect((await mutate(page, '/email-verification-codes', { email })).status()).toBe(201)
  await expect.poll(() => codes.get(email)).toMatch(/^\d{6}$/)
  expect((await mutate(page, '/accounts', { email, nickname, password: 'CraftTest123', verificationCode: codes.get(email) })).status()).toBe(201)
  expect((await mutate(page, '/sessions', { email, password: 'CraftTest123' })).status()).toBe(201)
  return email
}
export async function prepareCreator(page: Page, admin: Page, codes: Map<string, string>, promote: (email: string) => Promise<void>, approve = true) {
  await promote(await register(admin, codes, '需求审核员'))
  const parent = await mutate(admin, '/admin/categories', { name: `器物${randomBytes(3).toString('hex')}`, enabled: true, sortOrder: 1 })
  expect(parent.status()).toBe(201)
  const parentId = (await parent.json()).data.id as string
  const child = await mutate(admin, '/admin/categories', { name: '日用小物', parentId, enabled: true, sortOrder: 1 })
  expect(child.status()).toBe(201)
  const categoryId = (await child.json()).data.id as string
  await register(page, codes, '山间器物')
  const ids: string[] = []
  for (let i = 0; i < 6; i++) {
    const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
    const upload = await page.request.post(`${api}/creator-application-images`, { headers: { [csrf.headerName]: csrf.token }, multipart: { file: { name: 'craft.png', mimeType: 'image/png', buffer: image } } })
    expect(upload.status()).toBe(201)
    ids.push((await upload.json()).data.id)
  }
  const application = await mutate(page, '/me/creator-applications', { requestKey: randomUUID(), realName: '测试手艺', contactPhone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', categoryIds: [parentId], experienceYears: 5, introduction: '专注于原创手作的创作者，从选材到设计和每一个制作工序都由本人独立完成，希望用传统工艺带来舒适温暖的日常。', originalWorks: [0, 1, 2].map(i => ({ finishedImageIds: [ids[i * 2]], processImageIds: [ids[i * 2 + 1]] })), alipayAccount: '13800138000', payeeName: '测试手艺', supportingDescription: '' })
  expect(application.status()).toBe(201)
  const applicationId = (await application.json()).data.id as string
  if (approve) expect((await mutate(admin, `/admin/creator-applications/${applicationId}/review`, { decision: 'APPROVED', reason: '' }, 'put')).status()).toBe(200)
  return { categoryId, applicationId }
}

/** 同一主品类的第二位真实认证创作者，图片与申请材料均由本人提交。 */
export async function anotherCreator(page: Page, admin: Page, codes: Map<string, string>, categoryId: string) {
  await register(page, codes, '木间新作')
  const imageIds: string[] = []
  for (let index = 0; index < 6; index++) {
    const csrf = (await (await page.request.get(`${api}/csrf`)).json()).data
    const uploaded = await page.request.post(`${api}/creator-application-images`, { headers: { [csrf.headerName]: csrf.token }, multipart: { file: { name: 'creator.png', mimeType: 'image/png', buffer: image } } })
    expect(uploaded.status()).toBe(201)
    imageIds.push((await uploaded.json()).data.id)
  }
  const response = await mutate(page, '/me/creator-applications', { requestKey: randomUUID(), realName: '测试木匠', contactPhone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', categoryIds: [categoryId], experienceYears: 4, introduction: '专注于原创木作的手艺人，材料选用自然原木，每一件作品均经过手工锯切、打磨和上蜡，希望以耐用的手工器物陪伴生活。', originalWorks: [0, 1, 2].map(index => ({ finishedImageIds: [imageIds[index * 2]], processImageIds: [imageIds[index * 2 + 1]] })), alipayAccount: '13800138000', payeeName: '测试木匠', supportingDescription: '' })
  expect(response.status()).toBe(201)
  expect((await mutate(admin, `/admin/creator-applications/${(await response.json()).data.id}/review`, { decision: 'APPROVED', reason: '' }, 'put')).status()).toBe(200)
}

export async function fillRequest(page: Page, categoryId: string, title: string) {
  await page.getByLabel('需求标题', { exact: true }).fill(title)
  await page.getByLabel('需求品类', { exact: true }).selectOption(categoryId)
  await page.getByLabel('用途', { exact: true }).fill('生日赠礼')
  await page.getByLabel('材质偏好', { exact: true }).fill('天然原木')
  await page.getByLabel('尺寸规格', { exact: true }).fill('长度十二厘米，宽三厘米')
  await page.getByLabel('预算下限（元）', { exact: true }).fill('100')
  await page.getByLabel('预算上限（元）', { exact: true }).fill('300')
  await page.getByLabel('期望发货日期', { exact: true }).fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
  await page.getByLabel('需求描述', { exact: true }).fill('希望定制保留天然木纹的日常小物，表面细腻圆润，刻上名字，作为送给朋友的生日礼物。')
}
