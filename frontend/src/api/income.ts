import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { PageVO } from '@/types/creator'
import type { AdminSettlementVO, CreatorSettlementVO } from '@/types/income'

async function get<T>(path: string, params?: object) { return (await request.get<ApiResult<T>>(path, { params })).data.data }

/** 创作者本人收入记录，只读分页查询。 */
export const getMySettlements = (params: object = {}) => get<PageVO<CreatorSettlementVO>>('/me/settlements', params)

/** 管理员资金记录，含已审核收款快照明文。 */
export const getAdminSettlements = (params: object = {}) => get<PageVO<AdminSettlementVO>>('/admin/settlements', params)
