/** 与后端 Result<T> 对齐的统一接口响应。 */
export interface ApiResult<T> {
  code: number
  message: string
  data: T
}

/** Session 写请求所需的 CSRF 令牌及请求头名称。 */
export interface CsrfData {
  headerName: string
  token: string
}
