package com.handcraft.platform.modules.vo;

/** 仅作者可见的已退款现货恢复信息。 */
public record StockRecoveryVO(
    /** 当前售出关联的原现货订单编号。 */
    String originalOrderId,
    /** 展示给作者的原订单号。 */
    String originalOrderNo,
    /** 需由作者确认的可售依据，按原订单发货事实确定。 */
    String confirmation
) {}
