package com.handcraft.platform.modules.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/** 支付生成的定制五节点初始参考计划。 */
@Getter @Setter
public class OrderProgressNode {
    /** 节点编号。 */
    private Long id;
    /** 所属定制订单编号。 */
    private Long orderId;
    /** 固定节点标识。 */
    private String nodeCode;
    /** 一至五的固定顺序。 */
    private Integer sortOrder;
    /** 支付时固定的自然日参考完成日。 */
    private LocalDate plannedFinishDate;
    /** 初始NOT_STARTED，开工后才解锁。 */
    private String status;
    /** 实际打卡或跳过时间，未处理为空。 */
    private LocalDateTime handledAt;
    /** 支付生成节点的时间。 */
    private LocalDateTime createdAt;
}
