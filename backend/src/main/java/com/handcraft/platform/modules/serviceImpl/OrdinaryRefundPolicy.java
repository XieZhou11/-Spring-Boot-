package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.modules.entity.CustomRequest;
import com.handcraft.platform.modules.entity.TradeOrder;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Set;

/** 普通售后申请、凭证上传和状态恢复共用订单类型及原状态规则。 */
final class OrdinaryRefundPolicy {
    private static final Set<String> STOCK_STATES = Set.of("PENDING_SHIP", "SHIPPED", "COMPLETED");
    private static final Set<String> CUSTOM_STATES = Set.of("PAID", "IN_PRODUCTION", "PENDING_SHIP", "SHIPPED", "COMPLETED");

    private OrdinaryRefundPolicy() {}

    static boolean supports(TradeOrder order) {
        return order != null && ("CUSTOM".equals(order.getOrderType()) || "STOCK".equals(order.getOrderType()));
    }

    static boolean allowsOriginalStatus(TradeOrder order, String status) {
        if (!supports(order) || status == null) {
            return false;
        }
        return ("CUSTOM".equals(order.getOrderType()) ? CUSTOM_STATES : STOCK_STATES).contains(status);
    }

    static boolean eligible(TradeOrder order, LocalDateTime now) {
        if (order == null || !allowsOriginalStatus(order, order.getStatus())) {
            return false;
        }
        // 已完成的订单始终沿用第一次完成时间，截止时刻由结算窗口接续。
        return !"COMPLETED".equals(order.getStatus()) || (order.getOriginalCompletedAt() != null
                && now.isBefore(order.getOriginalCompletedAt().plusDays(7)));
    }

    static boolean matchesRequest(TradeOrder order, CustomRequest request) {
        if ("CUSTOM".equals(order.getOrderType())) {
            return request != null && Objects.equals(order.getRequestId(), request.getId())
                    && Objects.equals(order.getBuyerId(), request.getBuyerId());
        }
        return request == null && order.getRequestId() == null;
    }
}
