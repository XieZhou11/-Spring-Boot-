package com.handcraft.platform.modules.vo;

import java.time.OffsetDateTime;
import java.util.List;

/** 订单评价及当前用户可执行的评价操作。 */
public record OrderReviewVO(
        /** 评价编号，未评价时为空。 */ String id,
        /** 关联订单编号。 */ String orderId,
        /** 评价买家昵称。 */ String buyerNickname,
        /** 总体星级，未评价时为空。 */ Integer rating,
        /** 评价文字，未评价时为空。 */ String content,
        /** 评价图片及访问地址。 */ List<ImageVO> images,
        /** 评价时间。 */ OffsetDateTime createdAt,
        /** 当前用户能否在订单详情查看该评价。 */ boolean canView,
        /** 当前用户是否可举报。 */ boolean canReport,
        /** 当前买家是否可创建评价。 */ boolean canCreate,
        /** 新评价截止时刻。 */ OffsetDateTime reviewDeadlineAt) {}
