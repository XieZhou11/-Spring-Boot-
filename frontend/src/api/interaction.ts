import request from '@/utils/request'
import type { ApiResult } from '@/types/api'
import type { ImageVO, PageVO } from '@/types/creator'
import type { InteractionStats, WorkComment, FavoriteWork, FollowedCreator } from '@/types/interaction'
/** 互动请求统一复用会话与CSRF。 */
async function get<T>(path: string, params?: object) {
  return (await request.get<ApiResult<T>>(path, { params })).data.data
}
export const getInteractions = (id: string) => get<InteractionStats>(`/works/${id}/interactions`)
export const getComments = (id: string, page = 1) => get<PageVO<WorkComment>>(`/works/${id}/comments`, { page })
export const getFavorites = (page = 1) => get<PageVO<FavoriteWork>>('/me/favorite-works', { page })
export const getFollowing = (page = 1) => get<PageVO<FollowedCreator>>('/me/followed-creators', { page })
export const getFollowState = (id: string) => get<{ following: boolean }>(`/me/followed-creators/${id}`)
export const getCommentImage = (id: string) => get<ImageVO>(`/work-comment-images/${id}`)
export async function setReaction(id: string, kind: 'like' | 'favorite', active: boolean) {
  const path = `/me/${kind === 'like' ? 'work-likes' : 'favorite-works'}/${id}`
  if (active) return (await request.put<ApiResult<{ active: boolean }>>(path)).data.data.active
  await request.delete(path)
  return false
}
export async function setFollow(id: string, active: boolean) {
  const path = `/me/followed-creators/${id}`
  if (active) return (await request.put<ApiResult<{ following: boolean }>>(path)).data.data.following
  await request.delete(path)
  return false
}
export async function postComment(id: string, content: string, imageIds: string[]) {
  return (await request.post<ApiResult<WorkComment>>(`/works/${id}/comments`, { content, imageIds })).data.data
}
export async function deleteComment(id: string) { await request.delete(`/me/work-comments/${id}`) }
export async function uploadCommentImage(file: File) {
  const data = new FormData()
  data.append('file', file)
  return (await request.post<ApiResult<ImageVO>>('/work-comment-images', data, { timeout: 60_000 })).data.data
}
