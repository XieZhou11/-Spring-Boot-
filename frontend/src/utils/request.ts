import axios from 'axios'
import type { ApiResult, CsrfData } from '@/types/api'

/** 直连后端；跨域由后端白名单处理，Cookie 用于原生 HttpSession。 */
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 15_000,
  withCredentials: true,
})

request.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase() || 'GET'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // 每次写请求读取当前令牌，避免后续登录/退出轮换令牌后使用旧值。
    const { data } = await request.get<ApiResult<CsrfData>>('/csrf')
    config.headers.set(data.data.headerName, data.data.token)
  }
  return config
})

request.interceptors.response.use((response) => {
  const result = response.data as ApiResult<unknown>
  if (result.code !== 0) {
    return Promise.reject(new Error(result.message || '请求失败'))
  }
  return response
})

export default request
