package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.OrderPaymentDTO;
import com.handcraft.platform.modules.vo.OrderPaymentPreviewVO;
import java.time.LocalDate;

/** 定制订单模拟付款，写事务完成后由控制器独立读取订单聚合。 */
public interface OrderPaymentService {
    /** 按订单自然幂等键原子支付，首次成功true，成功重试false。 */
    boolean pay(Long userId,Long orderId,OrderPaymentDTO input);
    /** 按北京支付日期及快照工期生成需要买家确认的条款和发货日期。 */
    OrderPaymentPreviewVO preview(LocalDate paymentDate,int durationDays);
}
