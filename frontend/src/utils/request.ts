import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import type { ApiResult, CsrfData } from '@/types/api'

/** 保留业务码和字段错误，页面不需要解析 Axios 的内部结构。 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number = 0,
    readonly code: number = 0,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
  }
}

let unauthorizedHandler: (() => void) | undefined
let authenticationRevision = 0
const requestRevisions = new WeakMap<InternalAxiosRequestConfig, number>()

/** 身份变更后，较早请求的 401 不能清除较新的会话。 */
export function advanceAuthenticationRevision() {
  authenticationRevision++
}

/** 由应用入口绑定过期处理，避免请求层与路由/store 循环依赖。 */
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

function responseError(result: ApiResult<unknown> | undefined, status: number) {
  const fields: Record<string, string> = {}
  const data = result?.data as { fieldErrors?: { field: string; message: string }[] } | undefined
  if (Array.isArray(data?.fieldErrors)) {
    for (const violation of data.fieldErrors) {
      if (!fields[violation.field]) fields[violation.field] = violation.message
    }
  }
  return new ApiError(result?.message || '服务暂时不可用，请稍后重试', status, result?.code, fields)
}

/** 直连后端；跨域由后端白名单处理，Cookie 用于原生 HttpSession。 */
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 15_000,
  withCredentials: true,
})

request.interceptors.request.use(async (config) => {
  requestRevisions.set(config, authenticationRevision)
  const method = config.method?.toUpperCase() || 'GET'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // 每次写请求读取当前令牌，避免后续登录/退出轮换令牌后使用旧值。
    const { data } = await request.get<ApiResult<CsrfData>>('/csrf')
    config.headers.set(data.data.headerName, data.data.token)
  }
  return config
})

request.interceptors.response.use(
  (response) => {
    // REST 删除成功无响应体，不能按统一 JSON 业务码误判失败。
    if (response.status === 204) return response
    const result = response.data as ApiResult<unknown>
    if (result.code !== 0) {
      return Promise.reject(responseError(result, response.status))
    }
    return response
  },
  (error: unknown) => {
    if (axios.isAxiosError<ApiResult<unknown>>(error)) {
      const status = error.response?.status || 0
      // 会话查询由 store 按版本处理，避免恢复旧响应或在导航中重复重定向。
      if (
        status === 401 &&
        error.config &&
        !['/sessions', '/sessions/current'].includes(error.config.url || '') &&
        requestRevisions.get(error.config) === authenticationRevision
      )
        unauthorizedHandler?.()
      if (!error.response) {
        return Promise.reject(
          new ApiError(
            error.code === 'ECONNABORTED'
              ? '请求超时，请稍后重试'
              : '暂时无法连接服务，请检查网络后重试',
          ),
        )
      }
      return Promise.reject(responseError(error.response.data, status))
    }
    return Promise.reject(error)
  },
)

export default request
