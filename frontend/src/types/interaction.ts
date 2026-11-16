import type { ImageVO } from './creator'
/** 公开互动统计与当前账号状态。 */
export interface InteractionStats {
  /** 点赞数。 */ likeCount: number
  /** 收藏数。 */ favoriteCount: number
  /** 评论数。 */ commentCount: number
  /** 本人点赞状态。 */ liked: boolean
  /** 本人收藏状态。 */ favorited: boolean
}
/** 评论展示，不返回隐藏或已删除正文。 */
export interface WorkComment {
  /** 评论编号。 */ id: string
  /** 作品编号。 */ workId: string
  /** 作者编号。 */ authorId: string
  /** 公开昵称。 */ authorNickname: string
  /** 头像签名。 */ avatarUrl: string | null
  /** 头像有效期。 */ avatarExpiresAt: string | null
  /** 评论正文。 */ content: string
  /** 图片编号。 */ imageIds: string[]
  /** 图片签名。 */ images: ImageVO[]
  /** 发布时间。 */ createdAt: string
  /** 本人可删除。 */ canDelete: boolean
}
/** 失效收藏仅保留编号、时间和状态。 */
export interface FavoriteWork {
  /** 作品编号。 */ workId: string
  /** 当前公开可见。 */ available: boolean
  /** 公开标题。 */ title: string | null
  /** 作者编号。 */ creatorId: string | null
  /** 作者昵称。 */ creatorNickname: string | null
  /** 封面签名。 */ coverImage: ImageVO | null
  /** 收藏时间。 */ favoritedAt: string
}
/** 本人关注列表。 */
export interface FollowedCreator {
  /** 创作者编号。 */ creatorId: string
  /** 公开昵称。 */ nickname: string | null
  /** 公开简介。 */ bio: string | null
  /** 头像签名。 */ avatarUrl: string | null
  /** 头像有效期。 */ avatarExpiresAt: string | null
  /** 暂停新业务。 */ paused: boolean
  /** 认证有效。 */ available: boolean
  /** 关注时间。 */ followedAt: string
}
