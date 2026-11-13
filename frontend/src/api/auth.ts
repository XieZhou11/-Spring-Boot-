import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type {
  AccountVO,
  LoginDTO,
  PasswordResetDTO,
  RegistrationDTO,
  SessionVO,
  VerificationCodeVO,
} from '@/types/auth'

/** 账号接口沿用 REST 资源路径，Cookie 与 CSRF 由请求封装处理。 */
export async function login(input: LoginDTO) {
  const { data } = await request.post<ApiResult<SessionVO>>('/sessions', input)
  return data.data
}

export async function register(input: RegistrationDTO) {
  const { data } = await request.post<ApiResult<AccountVO>>('/accounts', input)
  return data.data
}

export async function sendVerificationCode(email: string) {
  const { data } = await request.post<ApiResult<VerificationCodeVO>>('/email-verification-codes', {
    email,
  })
  return data.data
}

export async function resetPassword(input: PasswordResetDTO) {
  await request.post<ApiResult<null>>('/password-resets', input)
}

export async function getCurrentSession() {
  const { data } = await request.get<ApiResult<SessionVO>>('/sessions/current')
  return data.data
}

export async function logout() {
  await request.delete<ApiResult<null>>('/sessions/current')
}
