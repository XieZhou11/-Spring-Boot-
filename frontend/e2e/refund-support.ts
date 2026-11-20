import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expect } from './fixtures'
import { api, image, mutate } from './custom-request-support'
import type { OrderVO } from '../src/types/quote'

/** 从真实需求、报价、定标、付款和制作准备售后订单，测试不直接插入业务状态。 */
export async function refundOrder(buyer: Page, creator: Page, categoryId: string, title: string, shipped = true): Promise<OrderVO> {
  const fields = { title, categoryId, purpose: '纪念赠礼', materialPreference: '天然木材', specification: '十二厘米书签', budgetMin: '100.00', budgetMax: '300.00', expectedShipDate: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), description: '希望定制一枚保留天然木纹的书签，边缘圆润并刻上名字，制作前确认字体和位置，用作朋友的生日纪念。', referenceImageIds: [], visibility: 'PUBLIC', invitedCreatorId: null, sourceWorkId: null }
  const draft = await mutate(buyer, '/me/custom-requests', { ...fields, requestKey: randomUUID() }); expect(draft.status()).toBe(201)
  const request = (await draft.json()).data
  expect((await mutate(buyer, `/me/custom-requests/${request.id}/publication`, { ...fields, version: request.version }, 'put')).status()).toBe(200)
  const quoteResponse = await mutate(creator, `/custom-requests/${request.id}/quotes`, { requestKey: randomUUID(), goodsAmount: '180.00', durationDays: 10, proposal: '天然胡桃木手工制作，圆角打磨，涂木蜡油，雕刻前确认字体和名字位置，保留制作阶段的实际照片。', additionalAgreement: '', imageIds: [] }); expect(quoteResponse.status()).toBe(201)
  const quote = (await quoteResponse.json()).data
  const address = await mutate(buyer, '/me/addresses', { recipientName: '售后测试收件人', phone: '13800138000', province: '北京市', city: '市辖区', district: '东城区', detailAddress: '售后验收测试路一号', isDefault: true }); expect(address.status()).toBe(201)
  const award = await mutate(buyer, `/custom-requests/${request.id}/award`, { requestKey: randomUUID(), quoteId: quote.id, addressId: (await address.json()).data.id, confirmedEstimatedShipDate: quote.estimatedShipDate }, 'put'); expect(award.status()).toBe(201)
  const pending = (await award.json()).data
  const paid = await mutate(buyer, `/orders/${pending.id}/payment`, { termsConfirmed: true, termsVersion: pending.paymentPreview.termsVersion, confirmedShipDate: pending.paymentPreview.shipDate }, 'put'); expect(paid.status()).toBe(201)
  if (!shipped) return (await paid.json()).data
  const started = await mutate(creator, `/orders/${pending.id}/production-start`, undefined, 'put'); expect(started.status()).toBe(201)
  const order = (await started.json()).data as OrderVO
  const csrf = (await (await creator.request.get(`${api}/csrf`)).json()).data
  const upload = await creator.request.post(`${api}/orders/${order.id}/progress-images`, { headers: { [csrf.headerName]: csrf.token }, multipart: { file: { name: 'stage.png', mimeType: 'image/png', buffer: image } } }); expect(upload.status()).toBe(201)
  const imageId = (await upload.json()).data.id
  for (const node of order.progressNodes.slice(0, 4)) expect((await mutate(creator, `/orders/${order.id}/progress-nodes/${node.id}/check-in`, { requestKey: randomUUID(), content: '阶段已按原始方案完成，保存真实制作照片。', imageIds: [imageId] }, 'put')).status()).toBe(201)
  const shipment = await mutate(creator, `/orders/${order.id}/shipment`, { requestKey: randomUUID(), content: '成品包装保护已完成，交付承运并保留凭证。', imageIds: [imageId], trackingNo: 'REFUND20261119001' }, 'put'); expect(shipment.status()).toBe(201)
  return (await shipment.json()).data
}
