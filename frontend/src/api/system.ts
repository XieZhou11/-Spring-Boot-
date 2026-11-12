import request from '@/utils/request'
import type { ApiResult } from '@/types/api'

/** 联调检查，只表示后端 HTTP 应用可响应。 */
export async function getHealth() {
  const { data } = await request.get<ApiResult<{ status: string }>>('/health')
  return data.data
}
