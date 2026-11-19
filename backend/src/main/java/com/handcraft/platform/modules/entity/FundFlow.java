package com.handcraft.platform.modules.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/** 仅追加的模拟资金流水，不含任何可消费余额。 */
@Getter @Setter
public class FundFlow {
    /** 流水主键。 */
    private Long id;
    /** 对外唯一流水号。 */
    private String flowNo;
    /** 所属订单编号。 */
    private Long orderId;
    /** 支付、退款或结算类型。 */
    private String flowType;
    /** 本次金额，支付取订单成交快照。 */
    private BigDecimal amount;
    /** SUCCESS成功或FAILED失败。 */
    private String result;
    /** 服务端生成的全局自然幂等键。 */
    private String idempotencyKey;
    /** 北京时间的实际发生时刻，精确到毫秒。 */
    private LocalDateTime occurredAt;
}
