package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;
import java.util.List;

/** 创作者公开评价列表项。 */
public record CreatorReviewVO(
        /** 评价编号。 */ String id,
        /** 买家公开昵称。 */ String buyerNickname,
        /** 总体星级。 */ int rating,
        /** 评价文字。 */ String content,
        /** 评价图片及访问地址。 */ List<ImageVO> images,
        /** 当前访客是否可举报。 */ boolean canReport,
        /** 评价时间。 */ OffsetDateTime createdAt) {}
