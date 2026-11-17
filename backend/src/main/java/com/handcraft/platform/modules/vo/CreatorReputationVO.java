package com.handcraft.platform.modules.vo;

/** 空评分和空好评率表示暂无评价，不能按零分排序。 */
public record CreatorReputationVO(
        /** 有效评价平均星级，保留一位小数；无评价为空。 */
        String averageRating,
        /** 可见且订单未退款的有效评价数。 */
        long reviewCount,
        /** 已有收货完成事实且当前未退款的订单数，包含售后处理中。 */
        long completedOrderCount,
        /** 四至五星占有效评价的百分比，保留一位小数；无评价为空。 */
        String positiveRate) {}
