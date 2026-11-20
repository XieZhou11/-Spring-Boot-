package com.handcraft.platform.modules.dto;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
/** 售后队列默认仅展示普通待处理申请。 */
@Getter @Setter
public class AdminRefundQueryDTO {
    /** 申请状态或ALL。 */ @Pattern(regexp="WAIT_ADMIN|REFUNDED|REJECTED|WITHDRAWN|ALL") private String status="WAIT_ADMIN";
    /** 申请类型或ALL。 */ @Pattern(regexp="NORMAL|NO_START_TIMEOUT|ALL") private String applicationType="NORMAL";
    /** 按字面包含匹配的订单号。 */ @Size(max=32) private String orderNo;
    /** 起始页为一。 */ @Min(1) @Max(1000000) private int page=1;
    /** 每页最多五十条。 */ @Min(1) @Max(50) private int size=20;
}
