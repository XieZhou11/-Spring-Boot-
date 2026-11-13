import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { AddressDTO, AddressVO, ProfileUpdateDTO, ProfileVO } from '@/types/account'

/** 本人资源复用会话 Cookie 与 CSRF，身份和地址归属由服务端判断。 */
export async function getProfile() {
  return (await request.get<ApiResult<ProfileVO>>('/me/profile')).data.data
}

export async function updateProfile(input: ProfileUpdateDTO) {
  return (await request.put<ApiResult<ProfileVO>>('/me/profile', input)).data.data
}

export async function uploadAvatar(file: File) {
  const input = new FormData()
  input.append('file', file)
  // 云端上传可能持续超过普通 JSON 请求，覆盖默认 15 秒，留足服务端超时及补偿时间。
  return (await request.put<ApiResult<ProfileVO>>('/me/avatar', input, { timeout: 60_000 })).data.data
}

export async function getAddresses() {
  return (await request.get<ApiResult<AddressVO[]>>('/me/addresses')).data.data
}

export async function saveAddress(input: AddressDTO, id?: string) {
  return id
    ? (await request.put<ApiResult<AddressVO>>(`/me/addresses/${id}`, input)).data.data
    : (await request.post<ApiResult<AddressVO>>('/me/addresses', input)).data.data
}

export async function deleteAddress(id: string) {
  await request.delete<ApiResult<null>>(`/me/addresses/${id}`)
}

export async function setDefaultAddress(id: string) {
  return (await request.put<ApiResult<AddressVO>>(`/me/addresses/${id}/default`)).data.data
}
