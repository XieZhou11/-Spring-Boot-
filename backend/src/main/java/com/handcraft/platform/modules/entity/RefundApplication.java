package com.handcraft.platform.modules.entity;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;
/** 全额退款申请原文、售前状态和服务端处理结果；历史申请不被新申请覆盖。 */
@Getter @Setter
public class RefundApplication {
    /** 申请编号。 */ private Long id;
    /** 原订单编号。 */ private Long orderId;
    /** 申请买家编号。 */ private Long buyerId;
    /** NORMAL普通或NO_START_TIMEOUT系统退款。 */ private String applicationType;
    /** 售后前状态。 */ private String originalOrderStatus;
    /** 固定退款原因。 */ private String reasonCode;
    /** 买家范围创建幂等键，历史系统退款为空。 */ private String createRequestKey;
    /** 已提交新补证次数。 */ private Long version;
    /** 原申请说明。 */ private String description;
    /** 初始凭证编号JSON。 */ private String imageIds;
    /** 处理状态。 */ private String status;
    /** 是否需退货，待裁定为空。 */ private Boolean returnRequired;
    /** 已核实退回运单。 */ private String returnTrackingNo;
    /** 服务端核实退回时间。 */ private LocalDateTime returnConfirmedAt;
    /** 核实退回管理员。 */ private Long returnConfirmedBy;
    /** 无需退货依据。 */ private String noReturnBasis;
    /** 处理管理员；撤回和系统退款为空。 */ private Long handlerId;
    /** 裁定或撤回原因。 */ private String decisionReason;
    /** 原申请时间及本次售后暂停起点。 */ private LocalDateTime createdAt;
    /** 终局时间。 */ private LocalDateTime finishedAt;
    /** 最近处理时间。 */ private LocalDateTime updatedAt;
}
